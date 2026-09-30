#!/usr/bin/env node
// Worktree reclamation — stdout is the report. `report` classifies (removes nothing); `reclaim` also removes what's reclaimable.
// Self-contained, no relative imports, no shell strings — never touches the main checkout or an untracked/unregistered path.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
} from 'node:path';
import { pathToFileURL } from 'node:url';

/** One clear line, no stack trace. */
const die = (msg) => {
  console.error(`FAIL  ${msg}`);
  process.exit(1);
};

// --- Process helpers ---------------------------------------------------------
/** Runs `cmd` via an explicit argv array, never a shell string; never throws on a non-zero exit.
 *  Returns `{ ok, stdout, stderr, status }` — callers decide what a non-zero exit means. */
function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    ...opts,
  });
  if (res.error)
    return {
      ok: false,
      stdout: '',
      stderr: String(res.error.message ?? res.error),
      status: null,
    };
  return {
    ok: res.status === 0,
    stdout: res.stdout ?? '',
    stderr: res.stderr ?? '',
    status: res.status,
  };
}

const git = (args, opts) => run('git', args, opts);
const gitOut = (args, opts) => {
  const res = git(args, opts);
  return res.ok ? res.stdout.trim() : null;
};

// --- Pure functions (exported for this repository's own layer 1 checks) -----

/** Parses `git worktree list --porcelain`, one record per entry, main worktree first.
 *  `branch` is `null` for a detached HEAD; `locked`/`lockReason` come off the `locked` line, which may carry no reason. */
export function parsePorcelain(text) {
  const records = [];
  let cur = null;
  for (const line of (text ?? '').split('\n')) {
    if (line.startsWith('worktree ')) {
      cur = {
        path: line.slice('worktree '.length).trim(),
        head: null,
        branch: null,
        locked: false,
        lockReason: null,
        detached: false,
      };
      records.push(cur);
    } else if (!cur) {
      continue;
    } else if (line.startsWith('HEAD ')) {
      cur.head = line.slice('HEAD '.length).trim();
    } else if (line.startsWith('branch ')) {
      cur.branch = line
        .slice('branch '.length)
        .trim()
        .replace(/^refs\/heads\//, '');
    } else if (line === 'detached') {
      cur.detached = true;
    } else if (line === 'locked' || line.startsWith('locked ')) {
      cur.locked = true;
      cur.lockReason =
        line === 'locked' ? null : line.slice('locked '.length).trim();
    }
  }
  return records;
}

/** Correlation ladder, first hit wins — pure (no I/O), so directly unit-testable.
 *  Returns `{ number, rung }` or `null`; `#0` is never a real issue/PR number here, so it's not a correlation. */
export function correlate({
  upstreamMergeRef,
  branch,
  dirBasename,
  headSubject,
}) {
  const fromRef = (ref) => {
    const m = /^refs\/heads\/(\d+)-/.exec(ref ?? '');
    return m ? Number(m[1]) : null;
  };

  const upstream = fromRef(upstreamMergeRef);
  if (upstream != null && upstream > 0)
    return { number: upstream, rung: 'upstream-branch' };

  const branchMatch = /^(\d+)-/.exec(branch ?? '');
  if (branchMatch && Number(branchMatch[1]) > 0)
    return { number: Number(branchMatch[1]), rung: 'branch-name' };

  const dirMatch = /^impl-(\d+)$/.exec(dirBasename ?? '');
  if (dirMatch && Number(dirMatch[1]) > 0)
    return { number: Number(dirMatch[1]), rung: 'directory-basename' };

  const subjectMatch = /^#(\d+)\b/.exec(headSubject ?? '');
  if (subjectMatch && Number(subjectMatch[1]) > 0)
    return { number: Number(subjectMatch[1]), rung: 'head-subject' };

  return null;
}

/** Precedence: outside → protected → locked → dirty → active/done/no-work/unresolved — so e.g. locked-and-done reports locked-and-reclaimable.
 *  `isAncestor` is consulted only when `itemState` is `null`; a correlated item's state always wins. */
export function classifyCandidate({
  isOutside,
  isProtected,
  locked,
  dirty,
  itemState,
  isAncestor,
}) {
  if (isOutside) return { state: 'outside', removable: false };
  if (isProtected) return { state: 'active', removable: false };

  let base;
  if (itemState === 'OPEN') base = 'active';
  else if (itemState === 'CLOSED' || itemState === 'MERGED') base = 'done';
  else if (itemState == null && isAncestor === true) base = 'no-work';
  else base = 'unresolved';

  const otherwiseRemovable = base === 'done' || base === 'no-work';

  if (locked) return { state: 'locked', removable: false, otherwiseRemovable };
  if (otherwiseRemovable && dirty)
    return { state: 'dirty', removable: false, otherwiseRemovable: true };
  return { state: base, removable: otherwiseRemovable };
}

// --- gh -----------------------------------------------------------------------
/** `gh api graphql` exits non-zero whenever `errors` is present, even when `data` is still usable.
 *  So this always returns the parsed body when there is one; only unparseable stdout is a hard failure. */
function ghGraphql(query) {
  const res = run('gh', ['api', 'graphql', '-f', `query=${query}`]);
  const text = res.stdout || res.stderr;
  try {
    return { ok: true, body: JSON.parse(text) };
  } catch {
    return {
      ok: false,
      body: null,
      error:
        res.stderr.trim().split('\n')[0] ||
        'gh api graphql produced no parseable output',
    };
  }
}

/** One `issueOrPullRequest(number:)` alias per number, one round trip.
 *  Returns `Map<number, 'OPEN'|'CLOSED'|'MERGED'|null>` — `null` means NOT_FOUND/absent, never treated as done. */
function resolveStates(owner, name, numbers) {
  if (numbers.length === 0) return { ok: true, states: new Map() };
  const aliases = numbers
    .map(
      (n) =>
        `n${n}: issueOrPullRequest(number: ${n}) { __typename ... on Issue { state } ... on PullRequest { state } }`,
    )
    .join(' ');
  const query = `query { repository(owner: "${owner}", name: "${name}") { ${aliases} } }`;
  const { ok, body, error } = ghGraphql(query);
  if (!ok) return { ok: false, states: new Map(), error };
  const repoData = body?.data?.repository;
  const states = new Map();
  for (const n of numbers) {
    const node = repoData?.[`n${n}`];
    states.set(n, node?.state ?? null);
  }
  return { ok: true, states };
}

// --- git facts ------------------------------------------------------------
const worktreeList = (mainRoot) =>
  gitOut(['worktree', 'list', '--porcelain'], { cwd: mainRoot });
const configRepoRoot = (path) =>
  gitOut(['-C', path, 'rev-parse', '--show-toplevel']);

function readConfig(mainRoot) {
  const path = join(mainRoot, '.claude', 'port.config.json');
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

/** `origin/<integration>` if the remote-tracking ref exists locally, else the local branch; `null` if neither exists.
 *  Never fetches — a stale ref only makes `no-work` under-report, never over-report, the safe direction. */
function resolveIntegrationRef(mainRoot, integration) {
  const remote = gitOut([
    '-C',
    mainRoot,
    'rev-parse',
    '--verify',
    '--quiet',
    `refs/remotes/origin/${integration}`,
  ]);
  if (remote) return `origin/${integration}`;
  const local = gitOut([
    '-C',
    mainRoot,
    'rev-parse',
    '--verify',
    '--quiet',
    `refs/heads/${integration}`,
  ]);
  if (local) return integration;
  return null;
}

function isAncestorOfIntegration(mainRoot, sha, integrationRef) {
  const res = git([
    '-C',
    mainRoot,
    'merge-base',
    '--is-ancestor',
    sha,
    integrationRef,
  ]);
  return res.status === 0;
}

function headSubjectOf(mainRoot, sha) {
  return gitOut(['-C', mainRoot, 'log', '-1', '--format=%s', sha]);
}

function upstreamMergeRefOf(mainRoot, branch) {
  if (!branch) return null;
  return gitOut(['-C', mainRoot, 'config', '--get', `branch.${branch}.merge`]);
}

/** A `git status --porcelain` failure fails toward dirty, not clean — the one check whose job is never discarding uncommitted work,
 *  so unlike every other uncertain fact here it must not under-report. `files: -1` marks "unknown count". */
function isDirty(path) {
  const res = git(['-C', path, 'status', '--porcelain']);
  if (!res.ok) return { dirty: true, files: -1 };
  const files = res.stdout.split('\n').filter((l) => l.trim() !== '').length;
  return { dirty: files > 0, files };
}

// --- Orphan directories -------------------------------------------------------
/** Directories beside a registered worktree that git doesn't track at all — reported only, never deleted here.
 *  Scanned from the registered worktrees' own parent dirs, never a hard-coded path — a repo with none scans nothing. */
function findOrphanDirs(mainRoot, candidates) {
  const registered = new Set(candidates.map((c) => resolve(c.path)));
  registered.add(resolve(mainRoot));
  const parents = new Set(candidates.map((c) => dirname(resolve(c.path))));
  const orphans = [];
  for (const parent of parents) {
    if (!existsSync(parent)) continue;
    for (const entry of readdirSync(parent)) {
      const full = resolve(join(parent, entry));
      if (registered.has(full)) continue;
      let stat;
      try {
        stat = statSync(full);
      } catch {
        continue;
      }
      if (!stat.isDirectory()) continue;
      if (existsSync(join(full, '.git'))) continue; // git tracks it under some other name
      orphans.push(full);
    }
  }
  return orphans;
}

// --- CLI ----------------------------------------------------------------------
function parseArgs(argv) {
  const opts = {
    issue: null,
    max: 5,
    protect: [],
    offline: false,
    json: false,
    unlock: false,
    forceDirty: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--issue') opts.issue = Number(argv[++i]);
    else if (a === '--max') opts.max = Number(argv[++i]);
    else if (a === '--protect') opts.protect.push(argv[++i]);
    else if (a === '--offline') opts.offline = true;
    else if (a === '--json') opts.json = true;
    else if (a === '--unlock') opts.unlock = true;
    else if (a === '--force-dirty') opts.forceDirty = true;
    else
      die(
        `unrecognized argument '${a}'. usage: node worktrees.mjs <report|reclaim> [--issue N] [--max K] [--protect <path>]... [--offline] [--json] [--unlock] [--force-dirty]`,
      );
  }
  return opts;
}

function main() {
  const [mode, ...rest] = process.argv.slice(2);
  if (mode !== 'report' && mode !== 'reclaim') {
    die(
      'unrecognized mode. usage: node worktrees.mjs <report|reclaim> [--issue N] [--max K] [--protect <path>]... [--offline] [--json] [--unlock] [--force-dirty]',
    );
  }
  const opts = parseArgs(rest);

  const mainRoot = configRepoRoot(process.cwd());
  if (!mainRoot)
    die('not a git repository (git rev-parse --show-toplevel failed).');

  const cfg = readConfig(mainRoot);
  if (!cfg)
    die(
      '.claude/port.config.json was not found, or does not parse, at the repository root — this repository is not port-managed.',
    );
  const integration = cfg.branches?.integration ?? 'dev';
  const repo = cfg.repo;
  if (!repo) die('.claude/port.config.json declares no `repo`.');
  const [owner, name] = repo.split('/');

  // Resolving the integration ref and checking ancestry are both purely local git facts — neither is gated on `--offline`.
  // Only the `gh issueOrPullRequest` resolution below is.
  const integrationRef = resolveIntegrationRef(mainRoot, integration);
  if (!integrationRef) {
    die(
      `neither 'origin/${integration}' nor a local '${integration}' branch exists — the 'no-work' rung has nothing to compare against.`,
    );
  }

  const porcelain = worktreeList(mainRoot);
  if (porcelain === null) die('`git worktree list --porcelain` failed.');
  const records = parsePorcelain(porcelain);
  if (records.length === 0)
    die(
      '`git worktree list --porcelain` produced no entries — not a git repository?',
    );

  const mainResolved = resolve(records[0].path);
  const protectedSet = new Set(opts.protect.map((p) => resolve(p)));

  const candidates = records.slice(1).map((r) => {
    const relPath = relative(mainResolved, resolve(r.path));
    const isOutside =
      relPath === '' || relPath.startsWith('..') || isAbsolute(relPath);
    return { ...r, isOutside };
  });

  // Correlate every candidate not fenced out.
  for (const c of candidates) {
    if (c.isOutside) {
      c.correlation = null;
      continue;
    }
    const upstreamMergeRef = c.branch
      ? upstreamMergeRefOf(mainRoot, c.branch)
      : null;
    const headSubject = c.head ? headSubjectOf(mainRoot, c.head) : null;
    c.correlation = correlate({
      upstreamMergeRef,
      branch: c.branch,
      dirBasename: basename(c.path),
      headSubject,
    });
  }

  // Resolve every correlated number in one round trip.
  const numbers = [
    ...new Set(
      candidates.filter((c) => c.correlation).map((c) => c.correlation.number),
    ),
  ];
  let states = new Map();
  if (!opts.offline && numbers.length > 0) {
    const result = resolveStates(owner, name, numbers);
    if (!result.ok)
      die(`gh issueOrPullRequest resolution failed: ${result.error}`);
    states = result.states;
  }

  // Ancestor check for every uncorrelated, non-outside candidate — local git
  // only, so this runs the same whether or not --offline was passed.
  for (const c of candidates) {
    if (c.isOutside || c.correlation) continue;
    c.isAncestor = !c.head
      ? null
      : isAncestorOfIntegration(mainRoot, c.head, integrationRef);
  }

  // Classify every candidate, `outside` ones included — classifyCandidate's precedence puts `outside` first,
  // and the report must be fully populated for it too, even though it's never removable.
  for (const c of candidates) {
    if (c.isOutside) {
      const classified = classifyCandidate({
        isOutside: true,
        isProtected: false,
        locked: false,
        dirty: false,
        itemState: null,
        isAncestor: null,
      });
      c.itemState = null;
      c.dirtyFiles = 0;
      c.state = classified.state;
      c.otherwiseRemovable = false;
      c.removable = false;
      c.reason = describeReason(c);
      continue;
    }

    const itemState = c.correlation
      ? (states.get(c.correlation.number) ?? null)
      : null;
    const base = classifyCandidate({
      isOutside: false,
      isProtected: false,
      locked: false,
      dirty: false,
      itemState,
      isAncestor: c.isAncestor ?? null,
    });
    const shouldCheckDirty = base.removable || c.locked;
    const dirtyInfo = shouldCheckDirty
      ? isDirty(c.path)
      : { dirty: false, files: 0 };
    c.itemState = itemState;
    c.dirtyFiles = dirtyInfo.files;
    const classified = classifyCandidate({
      isOutside: c.isOutside,
      isProtected: protectedSet.has(resolve(c.path)),
      locked: c.locked && !opts.unlock,
      dirty: dirtyInfo.dirty && !opts.forceDirty,
      itemState,
      isAncestor: c.isAncestor ?? null,
    });
    c.state = classified.state;
    c.otherwiseRemovable = classified.otherwiseRemovable ?? false;
    c.removable =
      classified.removable &&
      (opts.issue == null || c.correlation?.number === opts.issue);
    c.reason = describeReason(c);
  }

  // Removal (reclaim only), oldest first by directory mtime, capped at --max.
  let removedCount = 0;
  let removalFailed = false;
  if (mode === 'reclaim') {
    const removable = candidates
      .filter((c) => c.removable)
      .sort((a, b) => mtimeOf(a.path) - mtimeOf(b.path));
    for (const c of removable) {
      if (removedCount >= opts.max) break;
      if (c.locked && opts.unlock) {
        const unlockRes = git(['-C', mainRoot, 'worktree', 'unlock', c.path]);
        if (!unlockRes.ok) {
          c.error = `unlock failed: ${unlockRes.stderr.trim()}`;
          removalFailed = true;
          continue;
        }
      }
      const removeRes = git([
        '-C',
        mainRoot,
        'worktree',
        'remove',
        '--force',
        c.path,
      ]);
      if (!removeRes.ok) {
        c.error =
          removeRes.stderr.trim().split('\n')[0] ||
          'git worktree remove failed';
        removalFailed = true;
        continue;
      }
      c.removed = true;
      removedCount++;
      if (c.branch) {
        const branchRes = git(['-C', mainRoot, 'branch', '-d', c.branch]);
        c.branchDeleted = branchRes.ok;
        if (!branchRes.ok)
          c.branchRetainedReason =
            branchRes.stderr.trim().split('\n')[0] || 'unmerged';
      }
    }
    git(['-C', mainRoot, 'worktree', 'prune']);
  }

  const orphanDirs = findOrphanDirs(
    mainRoot,
    candidates.filter((c) => !c.isOutside),
  );

  report({ mainRoot, integrationRef, candidates, orphanDirs, opts });
  process.exit(removalFailed ? 2 : 0);
}

function mtimeOf(path) {
  try {
    return statSync(path).mtimeMs;
  } catch {
    return 0;
  }
}

function describeReason(c) {
  switch (c.state) {
    case 'active':
      return c.itemState === 'OPEN'
        ? `#${c.correlation.number} open`
        : 'protected';
    case 'done':
      return `#${c.correlation.number} ${c.itemState === 'MERGED' ? 'merged' : 'closed'} (${c.correlation.rung})`;
    case 'no-work':
      return `no work not already on the integration branch`;
    case 'locked': {
      const base = c.lockReason ? `locked: ${c.lockReason}` : 'locked';
      // Only calls this reclaimable when the item is actually done/no-work — never for a still-active locked worktree.
      // worktree-clean's SKILL.md step 3 gates `--unlock` on this exact wording.
      if (!c.otherwiseRemovable) return base;
      const dirtyClause =
        c.dirtyFiles === -1
          ? '; uncommitted status could not be checked too'
          : c.dirtyFiles > 0
            ? `; ${c.dirtyFiles} uncommitted file(s) too`
            : '';
      const forcedFlag = c.dirtyFiles !== 0 ? ' and forced' : '';
      return `${base}${dirtyClause} — reclaimable once unlocked${dirtyClause ? forcedFlag : ''}: git worktree unlock "${c.path}"`;
    }
    case 'dirty': {
      const prefix = c.correlation ? `#${c.correlation.number} ` : '';
      const count = c.dirtyFiles === -1 ? 'an unknown number of' : c.dirtyFiles;
      return `${prefix}otherwise reclaimable, but ${count} uncommitted file(s)`;
    }
    case 'outside':
      return 'registered path is outside the main worktree — never touched';
    case 'unresolved':
    default:
      return c.correlation
        ? `#${c.correlation.number} could not be resolved`
        : 'no upstream branch, no #N subject, and HEAD is not on the integration branch';
  }
}

function report({ mainRoot, integrationRef, candidates, orphanDirs, opts }) {
  const visible = candidates;
  const removed = visible.filter((c) => c.removed).length;
  const kept = visible.length - removed;
  const byState = {};
  for (const c of visible) byState[c.state] = (byState[c.state] ?? 0) + 1;

  if (opts.json) {
    console.log(
      JSON.stringify(
        {
          mainRoot,
          integrationRef,
          candidates: visible.map((c) => ({
            path: c.path,
            branch: c.branch,
            head: c.head,
            state: c.state,
            reason: c.reason,
            rung: c.correlation?.rung ?? null,
            issue: c.correlation?.number ?? null,
            locked: c.locked,
            lockReason: c.lockReason,
            dirtyFiles: c.dirtyFiles ?? 0,
            removed: !!c.removed,
            branchDeleted: c.branchDeleted ?? null,
            error: c.error ?? null,
          })),
          orphanDirs,
          summary: { registered: visible.length, removed, kept, byState },
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log(
    `Worktrees: ${visible.length} registered · removed ${removed} · kept ${kept}.`,
  );
  for (const c of visible) {
    const tag = c.removed ? 'removed' : c.state;
    const suffix = c.error ? ` — FAILED: ${c.error}` : '';
    console.log(`${tag}\t${c.path} — ${c.reason}${suffix}`);
    if (c.removed && c.branch && c.branchDeleted === false) {
      console.log(
        `  branch '${c.branch}' retained — ${c.branchRetainedReason}`,
      );
    }
  }
  if (orphanDirs.length > 0) {
    console.log(
      `${orphanDirs.length} orphan directory(ies), untracked, never deleted here: ${orphanDirs.join(', ')} — run /port:worktree-clean.`,
    );
  }
  const unresolved = visible.filter((c) => c.state === 'unresolved');
  if (unresolved.length > 0) {
    console.log(
      `${unresolved.length} unresolved (${unresolved.map((c) => basename(c.path)).join(', ')}) — run /port:worktree-clean.`,
    );
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main();
}
