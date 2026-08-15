#!/usr/bin/env node
// Node, not `sh -c`, so this runs the same on plain Windows shells as on Git Bash.
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

// '#' (git's default) makes rebase/--amend strip our '#NNN' subjects as
// comments, and the commit-msg hook doesn't run on that path to catch it.
let commentChar = gitConfig('--get', 'core.commentChar');
if (commentChar !== COMMENT_CHAR) {
  gitConfig('core.commentChar', COMMENT_CHAR);
  commentChar = gitConfig('--get', 'core.commentChar');
}

if (commentChar !== COMMENT_CHAR) {
  // Non-fatal: CI enforces this outcome anyway, so don't fail every install over it.
  console.warn(
    `hooks:check: warning — could not set core.commentChar (got ${commentChar || '<unset>'}). Rebases may strip '#NNN' subjects. Fix with: git config core.commentChar ';'`,
  );
  console.log(`hooks:check: hooks active (${hooksPath})`);
} else {
  console.log(
    `hooks:check: hooks active (${hooksPath}) · core.commentChar=${COMMENT_CHAR}`,
  );
}
