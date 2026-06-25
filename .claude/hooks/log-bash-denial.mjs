// PreToolUse hook (matcher: Bash) for the agent pipeline.
//
// Logs every Bash command that is NOT on the permission allowlist to the base
// repo's `.agents/denials.log` (gitignored), so the /pipeline cockpit can
// surface clustered denials without interrupting the human. This is
// logging-only: it ALWAYS exits 0 and never blocks — the actual denial is done
// by the stage agents' `permissionMode: dontAsk`. Hooks run as the harness (not
// an agent tool call), so using Node here is fine and cross-platform.
import { execSync } from 'node:child_process';
import { appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

try {
  const data = JSON.parse(readFileSync(0, 'utf8')); // PreToolUse JSON on stdin
  const cmd = (data?.tool_input?.command ?? '').trim();
  if (!cmd) process.exit(0);

  // Mirror settings.json `permissions.allow` for Bash — these are NOT logged.
  const allowed = [/^gh\s/, /^git\s/, /^npm\s/, /^npx\s+shadcn/];
  if (allowed.some((re) => re.test(cmd))) process.exit(0);

  // Resolve the base repo root from any worktree so the cockpit reads one log.
  let root = process.cwd();
  try {
    root = resolve(
      execSync('git rev-parse --git-common-dir', { encoding: 'utf8' }).trim(),
      '..',
    );
  } catch {
    /* fall back to cwd */
  }

  const dir = join(root, '.agents');
  mkdirSync(dir, { recursive: true });
  const who =
    data?.agent ?? data?.subagent_type ?? data?.session_id ?? 'unknown';
  appendFileSync(
    join(dir, 'denials.log'),
    `${new Date().toISOString()}\t${who}\t${cmd.replace(/\s+/g, ' ').slice(0, 500)}\n`,
  );
} catch {
  /* never block or fail the tool call */
}
process.exit(0);
