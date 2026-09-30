# Pipeline Notes (Aplio-specific)

Operational knowledge specific to this repo's pipeline setup that the port
plugin has no equivalent for. The plugin's own docs
(`${CLAUDE_PLUGIN_ROOT}/docs/PIPELINE.md`, `RECOVERY.md`, `FORMATS.md`) cover
everything generic; this file covers what's unique to Aplio's infrastructure.

## Preview-database concurrency

Every open PR with a Vercel preview deployment holds one Neon branch, and
Neon branches are a finite project-wide pool. This bounds the pipeline, so
every stage agent and the cockpit need the same picture of it.

- **Budget** — **10 branches total, 2 permanently held** (`dev`,
  `production`), so **~8 PRs can hold a preview database at once**. Verified
  against the live inventory on 2026-08-13; the `vercel-dev` branch #412
  assumed was a third permanent holder **does not exist**, so there is
  nothing there to reclaim. In-flight PR count is bounded by the branch
  quota, not by agent capacity. Reclamation is automatic (branch auto-delete
  on merge plus Neon's own sweep) — never a manual cleanup step. The
  branch-budget check prints the full inventory to its run log, so
  re-verify with `gh run view <id> --log` rather than trusting these numbers
  indefinitely.
- **Fingerprint — read the `run-neon-check` first.**
  `.github/workflows/neon-branch-check.yml` runs on every PR push and
  **fails when the project is at its cap**, so a red one means quota, full
  stop. Read its message with:

  ```bash
  gh api "repos/SGAOperations/aplio/commits/<headRefOid>/check-runs" --jq '.check_runs[] | select(.name=="run-neon-check") | .output.title'
  # → "10/10 Neon branches used — no preview database available"
  ```

  **Not** `gh pr checks --json description` — that field is blank for
  _every_ check run (Vercel's included); it is populated only for
  StatusContexts like `Vercel`. The full branch inventory is in the run log
  (`gh run view <id> --log`). **It is deliberately not a required check** —
  never add it to branch protection, or it becomes a second merge blocker on
  top of `Vercel`.
  - **It reports the project, not this PR.** At capacity every open PR's
    budget check goes red, including PRs whose preview is fine — a PR that
    already holds a branch keeps deploying, because the cap only blocks
    _new_ branches. So a red budget check plus a green `Vercel` is a
    coherent state, and never means this PR is broken.
  - **Fallback, when it hasn't run** (secrets unconfigured, or a Dependabot
    PR, which the workflow skips): `Vercel` red while `run-prettier-check` /
    `run-linting-check` / `run-tsc-check` are green, on **two or more open
    PRs at once**. A **single** PR red on its own stays ambiguous — treat it
    as a build break.
  - **What you cannot read:** the `Vercel` check's own description is
    generic (`Deployment has failed — run this Vercel CLI command: npx
vercel inspect … --logs`), naming neither Neon nor the quota, and
    `vercel` is deny-listed so its one instruction can't be followed. The
    Vercel **build log is human-only** — never expect to read it.
  - In `gh pr view --json statusCheckRollup`, `Vercel` is a **StatusContext**
    (`.context` / `.state`) while the Actions checks are CheckRuns (`.name` /
    `.conclusion`) — read `(.name // .context)` and
    `(.conclusion // .state)`.

- **Degrade, don't halt** — a red `Vercel` check is an **infrastructure
  condition, never a code finding**. The review stage must not raise it and
  must not route the PR to needs-revision over it; the revise stage must
  never try to fix it. Planning, implementation, review, and revision all
  continue normally; **only the merge gate waits**, because `Vercel` is a
  required status check on `dev` and `main`.
- **Recovery** — merging a PR into `dev` frees exactly **one** slot
  (`delete_branch_on_merge` is on). The cockpit then labels **one** blocked
  `approved` PR `refresh branch`, and the revise stage runs in refresh mode:
  rebase onto the base branch, force-push, nothing else. **The push is the
  redeploy** — no Vercel CLI, no retry subsystem. Triage line: **check the
  Neon branch count before debugging Prisma.**
