---
name: release
description: Cut a release end-to-end — open a version-bump PR and a dev→main release PR with a minimal ticket-led changelog, then watch for the release PR to merge and automatically publish the GitHub Release + tag with short user-facing notes (approval-gated). Manual only. Usage: /release <version>
disable-model-invocation: true
allowed-tools: Read, Edit, Write, AskUserQuestion, ScheduleWakeup, Bash(git *), Bash(gh *), Bash(npm version *)
---

# Release — cut a version

**Trigger:** Manual — a human runs `/release <version>`.
**Input:** `$ARGUMENTS` — the target version (bare semver `1.2.3`, or `v1.2.3`; the leading `v` is stripped).
**Repo:** `SGAOperations/aplio`. **Assignee for both PRs:** `b-at-neu`.

## What it does (one invocation, end to end)

You run this **once**. It then:

1. Opens the **bump PR** (`package.json`) and the **release PR** (`dev → main`).
2. **Watches** — re-checking on its own schedule via `ScheduleWakeup` — until you merge the release PR into `main`. You never re-run it.
3. Once merged, drafts short **user-facing** release notes, **gets your approval**, and creates the GitHub Release + tag.

It is **state-driven**: every run (your first call _and_ each self-scheduled wake-up) inspects `origin/main` and the PRs and continues from wherever things stand — so if a session ends, simply invoking `/release <version>` again resumes cleanly.

## 0. Preflight (every run)

1. **Parse the version.** Strip a leading `v`, trim whitespace. Bare value `<version>` (e.g. `1.2.3`), tagged form `v<version>`. If empty or not `X.Y.Z` (optionally `-prerelease`), **stop**: `Usage: /release <version> (e.g. /release 1.2.3)`.
2. **Sync:** `git fetch origin`; `git rev-parse --verify origin/dev origin/main` (both must exist).

## State detection (every run — pick the phase)

```bash
git show origin/main:package.json                                                   # version on main
gh release view v<version> --repo SGAOperations/aplio                               # already published?
gh pr list --repo SGAOperations/aplio --base main --head dev --state all --json number,state,title --jq '.'
```

Route to exactly one phase:

- A `v<version>` **release already exists** → **Done.** Report the release URL and stop.
- `main`'s version **==** `<version>` (release merged), or the release PR state is **MERGED**, and no release exists yet → **Phase B (Publish).**
- A release PR exists and is **OPEN** → **Wait** (skip Phase A; go straight to "Watch for the merge").
- The release PR was **CLOSED unmerged** → **stop** and report (release abandoned; nothing to publish).
- Otherwise (no release PR yet, `main` not at `<version>`) → **Phase A (open the PRs).**

---

## Phase A — open the PRs

Guard: only run Phase A if the working tree is clean (`git status --porcelain` empty) and `git log --oneline origin/main..origin/dev` is **non-empty**. If the tree is dirty, **stop** (commit/stash first). If nothing is ahead, **stop**: `Nothing to release — origin/dev has no commits ahead of origin/main.`

### Part 1 — Bump PR (`bump/v<version>` → `dev`)

1. **Branch off the latest dev** (the bump rides into the release):
   ```bash
   git checkout -b bump/v<version> origin/dev
   ```
   If `bump/v<version>` already exists locally or on origin, **stop** — that version is already in flight.
2. **Bump the version** (updates `package.json` **and** `package-lock.json`, no tag, no commit):
   ```bash
   npm version <version> --no-git-tag-version --allow-same-version
   ```
   If `npm version` is unavailable, fall back to the **Edit** tool: change the `"version"` field in `package.json`, plus the root `"version"` and the `packages.""` version in `package-lock.json`. Never hand-edit other lockfile entries.
3. **Commit** with the exact subject. Write `.temp/commit-msg.txt` (Write tool) per the CLAUDE.md commit rules (Co-Authored-By trailer), subject exactly:
   ```
   bump version to v<version>
   ```
   Then:
   ```bash
   git add package.json package-lock.json
   git commit -F .temp/commit-msg.txt
   git push -u origin HEAD:bump/v<version>
   ```
4. **Open the bump PR** (base `dev`). Write a one-line body to `.temp/bump-pr.md`:
   ```
   Bumps the package version to v<version>. Merge this before the release PR.
   ```
   ```bash
   gh pr create --repo SGAOperations/aplio --base dev --head bump/v<version> \
     --title "bump version to v<version>" --body-file .temp/bump-pr.md --assignee b-at-neu
   ```
   Note the bump PR URL.

### Part 2 — Release PR (`dev → main`)

The body is **minimal**: short bullets only, **ticket number first** (`- #169 short description`). No paragraphs, no per-change detail.

1. **Gather the changes** — everything on `dev` not yet on `main`:
   ```bash
   git log --oneline --no-merges origin/main..origin/dev
   ```
   Extract every `#<n>` token from the subjects (our convention is `#<n> message`; merge commits read `Merge pull request #<n>`). Dedupe, newest-first.
2. **Resolve each number** (PR metadata first, commit subject as fallback):
   ```bash
   gh pr view <n> --repo SGAOperations/aplio --json number,title,author,labels --jq '{number,title,login:.author.login,bot:.author.is_bot,labels:[.labels[].name]}'
   ```
   - **Title:** use the PR title; strip a leading `#<n> ` and any conventional prefix (`fix:`, `chore:` …). If `gh pr view` fails, fall back to the commit subject.
   - **Dependabot vs. normal:** route to **Dependabot** if the author is a bot whose login contains `dependabot`, **or** the PR carries a `dependencies`/`dependabot` label. Everything else → **Changes**.
   - A commit with **no** `#<n>` and not a merge → a fallback **Changes** bullet using its subject (no number).
3. **Build the body** at `.temp/release-pr.md` (Write tool). One short line per bullet. Omit the Dependabot section if there are none:

   ```
   ## Release v<version>

   ### Changes
   - #169 short description
   - #153 short description

   ### Dependabot
   - #115 react-day-picker → v10

   ### Testing plan
   - [ ] <a concrete thing a user does in the app> → <what they should see>
   - [ ] <another user-facing check> → <expected result>
   ```

   Write **2–10** testing bullets, scaled to the release's size/risk (a single small fix → ~2; a large multi-feature release → up to 10). Every bullet is a **user-facing functional test** — an action a person actually performs in the app to confirm the change works (navigate, submit a form, edit, filter, check the result), each with its expected outcome. **Never** include build / lint / type-check / "checks pass" / CI bullets. Derive the bullets from the user-visible changes in this release.

4. **Open (or update) the release PR** — a `dev → main` PR is long-lived, so reuse an open one:
   ```bash
   gh pr list --repo SGAOperations/aplio --base main --head dev --state open --json number --jq '.[0].number'
   ```
   - **None open:** `gh pr create --repo SGAOperations/aplio --base main --head dev --title "Release v<version>" --body-file .temp/release-pr.md --assignee b-at-neu`
   - **One open:** `gh pr edit <existing-number> --repo SGAOperations/aplio --title "Release v<version>" --body-file .temp/release-pr.md`

After both PRs exist, tell the human once: **merge the bump PR into `dev` first, then merge the release PR into `main`** — and that you'll watch and publish automatically. Then fall through to "Watch for the merge".

---

## Watch for the merge (the wait)

You cannot finish until the human merges the release PR into `main`. Poll on a schedule instead of blocking:

1. Check the release PR's state:
   ```bash
   gh pr view <release-pr-number> --repo SGAOperations/aplio --json state,mergedAt --jq '{state,mergedAt}'
   ```
2. **If `MERGED`** → go to **Phase B**.
3. **If `CLOSED`** (not merged) → stop and report (release abandoned).
4. **If `OPEN`** → schedule the next check and end the turn:
   - Call **`ScheduleWakeup`** with `delaySeconds: 120` (~2 min — about how long the merge usually takes here) and `prompt` set **exactly** to `/release <version>` (so the wake re-enters this command and re-detects state), and a `reason` like `watching release PR #<n> to merge into main`.
   - Then stop for this turn. When the wake-up fires, this command runs again from "State detection" and either keeps waiting or moves to Phase B. **Do not** spin in a tight loop or block the turn waiting.

(~2 min between checks matches the typical merge time here; the wake-up re-enters the command, so each check is cheap.)

---

## Phase B — publish the GitHub Release + tag

Runs once `main` is at `<version>` / the release PR is merged. The notes here are **even shorter than the release PR**: single plain-language bullets, **only what's relevant to a user**. Exclude all behind-the-scenes work — Dependabot bumps, pipeline/tooling/`.claude`/CI/docs/refactors/chores. No ticket numbers.

1. **Confirm state.** `gh release view v<version>` must not exist. If `main` isn't at `<version>` yet, go back to "Watch for the merge" (don't publish early).
2. **Find the previous release** (for the change range):
   ```bash
   gh release list --repo SGAOperations/aplio --limit 1 --json tagName --jq '.[0].tagName'
   ```
   If there is no previous release, the range is the full history of `main`.
3. **Gather user-facing changes** between the previous tag and `main`:
   ```bash
   git log --oneline --no-merges <prev-tag>..origin/main
   ```
   Resolve `#<n>` to PR titles/labels with `gh pr view` (as in Part 2). **Keep only user-visible features and fixes.** Drop anything internal/behind-the-scenes (Dependabot, `.claude`/pipeline/tooling/CI/docs/test-only/refactor/chore). When unsure whether a change is user-relevant, **leave it out** — these notes are for users, not maintainers.
4. **Draft the notes** to `.temp/release-notes.md` (Write tool) — bullets only, each one short and in plain user language:
   ```
   - Plain description of a user-visible change
   - Another user-visible change
   ```
   (No heading — the release title is `v<version>`. No ticket numbers, no internal items. If nothing is user-facing, use a single line like `- Maintenance and dependency updates`.)
5. **Get approval — required before creating anything.** Present the drafted notes to the human verbatim (an `AskUserQuestion`, or just show the draft and ask them to approve or edit). Apply any edits and re-show. **Do not run `gh release create` until the human explicitly approves.**
6. **Create the release + tag** (this creates the `v<version>` tag at `main`'s HEAD):
   ```bash
   gh release create v<version> --repo SGAOperations/aplio \
     --target $(git rev-parse origin/main) --title "v<version>" \
     --notes-file .temp/release-notes.md --latest
   ```
7. **Handoff:** report the release URL.

---

## Notes & guardrails

- **Never push to `main` or `dev` directly**, never run `gh pr merge`, never create a tag by hand — the tag is created only by `gh release create` in Phase B, only after approval.
- **Phase B never publishes without explicit human approval of the notes.**
- The wait is driven by `ScheduleWakeup` re-entering `/release <version>`; you invoke the command only once.
- File-based bodies/notes only (`gh ... --body-file` / `--notes-file`) — never inline `--body`/`--notes` for multi-line markdown (escaping breaks cross-platform).
- If anything is ambiguous (dirty tree, missing branch, version already in flight, nothing to release, PR closed unmerged), **stop and report** rather than guessing.
