#!/usr/bin/env node
// Verifies husky's hook activation actually took (core.hooksPath points at a
// populated .husky/_ dir) instead of silently no-oping, and pins
// core.commentChar so git stops eating our '#NNN' subjects as comments.
// Node instead of a `sh -c` one-liner so it runs the same under a plain
// Windows shell, not just Git Bash — `npm run` doesn't resolve through git's
// bundled shell the way git hooks themselves do.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const COMMENT_CHAR = ';';

function gitConfig(...args) {
  try {
    return execFileSync('git', ['config', ...args], {
      encoding: 'utf8',
    }).trim();
  } catch {
    return '';
  }
}

const hooksPath = gitConfig('core.hooksPath');

if (!hooksPath || !existsSync(`${hooksPath}/husky.sh`)) {
  console.error(
    `hooks:check: git hooks are inactive (core.hooksPath=${hooksPath || '<unset>'} missing or incomplete). Run npm ci or npm run prepare to activate.`,
  );
  process.exit(1);
}

// Git's default comment char is '#', so every path that re-reads a commit
// message through the editor machinery (rebase, `--amend`) strips the mandated
// '#NNN …' subject as a comment — and the commit-msg hook doesn't run there to
// catch it. 'auto' is overwritten too: the hook needs a fixed character to skip.
let commentChar = gitConfig('--get', 'core.commentChar');
if (commentChar !== COMMENT_CHAR) {
  gitConfig('core.commentChar', COMMENT_CHAR);
  commentChar = gitConfig('--get', 'core.commentChar');
}

if (commentChar !== COMMENT_CHAR) {
  // Non-fatal: CI (run-commit-message-check) enforces the outcome regardless,
  // so failing every `npm ci` — including Vercel's install — over a config
  // write would be disproportionate.
  console.warn(
    `hooks:check: warning — could not set core.commentChar (got ${commentChar || '<unset>'}). Rebases may strip '#NNN' subjects. Fix with: git config core.commentChar ';'`,
  );
  console.log(`hooks:check: hooks active (${hooksPath})`);
} else {
  console.log(
    `hooks:check: hooks active (${hooksPath}) · core.commentChar=${COMMENT_CHAR}`,
  );
}
