---
name: worktree-clean
description: Reclaim disk space from stale pipeline worktrees — prune git registrations and force-delete orphaned agent worktree directories left under .claude/worktrees/ (the node_modules-laden leftovers git's own remove/prune can't clear on Windows). Run manually from the main checkout when worktrees accumulate.
disable-model-invocation: true
allowed-tools: Read, Bash
---

# Clean up pipeline worktrees

Pipeline agents run in isolated worktrees under `.claude/worktrees/agent-*`. On Windows, once an agent has run `npm ci`, the harness often **de-registers** the worktree (removes its `.git` file) but **can't delete the directory** — the populated `node_modules` (and long/`(app)`-parenthesized paths) defeat `git worktree remove` (`Invalid argument`) and `git worktree prune` (which only clears registrations whose directory is already gone). These **orphan directories** then accumulate (hundreds of MB of `node_modules` each). The cockpit deliberately does **not** force-delete them in its autonomous loop; this skill does it, interactively, run by you from the **main checkout**.

> **Scope guard:** this skill only ever deletes directories **directly under `.claude/worktrees/`**. Never delete anything outside that directory, never the main checkout, and never a worktree of an **in-flight** pipeline item (check `gh pr list`/the cockpit first if unsure).

## Steps

1. **Prune dangling registrations** (safe — only affects worktrees whose dir is already gone):

   ```bash
   git worktree prune
   ```

2. **List what git still tracks** vs **what's on disk:**

   ```bash
   git worktree list                       # registered worktrees (paths git knows about)
   ls -1 .claude/worktrees/                # every directory actually on disk
   ```

3. **Identify the deletable set:**
   - **Orphans** — directories under `.claude/worktrees/` that do **not** appear in `git worktree list` (no `.git` file; git doesn't track them). These are always safe to delete.
   - **Registered-but-done** — a worktree that _is_ listed but whose PR is merged/closed (confirm with `gh pr list`). For these, try `git worktree remove --force "<exact listed path>"` first; if it fails with `Invalid argument`, fall through to the force-delete below and then re-run `git worktree prune`.

   Show the human the list (with sizes if useful: `du -sh .claude/worktrees/* 2>/dev/null`) and confirm before deleting.

4. **Force-delete each orphan directory** (Windows-robust — handles locked `node_modules` and long paths that `rm -rf` / git choke on). Run one per directory so each is visible/approved:

   ```bash
   powershell -NoProfile -Command "Remove-Item -LiteralPath '.claude/worktrees/<dir>' -Recurse -Force"
   # fallback if PowerShell balks on a path:
   cmd //c rmdir /s /q ".claude\\worktrees\\<dir>"
   ```

5. **Final prune** to clear any registrations the deletions exposed:

   ```bash
   git worktree prune
   git worktree list   # confirm only the main checkout + genuinely in-flight worktrees remain
   ```

After this, `.claude/worktrees/` on disk should match `git worktree list`.
