#!/usr/bin/env node
// Verifies husky's hook activation actually took (core.hooksPath points at a
// populated .husky/_ dir) instead of silently no-oping. Node instead of a
// `sh -c` one-liner so it runs the same under a plain Windows shell, not just
// Git Bash — `npm run` doesn't resolve through git's bundled shell the way
// git hooks themselves do.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

function getHooksPath() {
  try {
    return execFileSync('git', ['config', 'core.hooksPath'], {
      encoding: 'utf8',
    }).trim();
  } catch {
    return '';
  }
}

const hooksPath = getHooksPath();

if (!hooksPath || !existsSync(`${hooksPath}/husky.sh`)) {
  console.error(
    `hooks:check: git hooks are inactive (core.hooksPath=${hooksPath || '<unset>'} missing or incomplete). Run npm ci or npm run prepare to activate.`,
  );
  process.exit(1);
}

console.log(`hooks:check: hooks active (${hooksPath})`);
