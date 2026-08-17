---
name: release
description: Cut a release end-to-end — work out the next version from what has merged since the last release and confirm the bump with the operator, open a version-bump PR and a dev→main release PR with a minimal ticket-led changelog, then watch for the release PR to merge and automatically publish the GitHub Release + tag with short user-facing notes (approval-gated). Manual only. Usage: /release
disable-model-invocation: true
allowed-tools: Read, Edit, Write, AskUserQuestion, ScheduleWakeup, Bash(git *), Bash(gh *), Bash(npm version *)
---

# Release — cut a version

**Trigger:** Manual — a human runs `/release`.
**Input:** none. The version is always derived from repository state (§0.5) — adopted from a release already in flight, or chosen by the operator from computed candidates.
**Repo:** `SGAOperations/aplio`. **Assignee for both PRs:** the operator running `/release`.

## What it does (one invocation, end to end)

You run this **once**. It then:

1. **Works out the version** — on a fresh cycle it gathers everything merged since the last release, computes the major / minor / patch candidates, recommends one with its reasoning, and asks you to confirm.
2. Opens the **bump PR** (`package.json`) and the **release PR** (`dev → main`).
3. **Watches** — re-checking on its own schedule via `ScheduleWakeup` — until you merge the release PR into `main`. You never re-run it.
4. Once merged, drafts short **user-facing** release notes, **gets your approval**, and creates the GitHub Release + tag.

It is **state-driven**: every run (your first call _and_ each self-scheduled wake-up) resolves the version and the phase from `origin/main` and the open PRs, then continues from wherever things stand — so if a session ends, simply invoking `/release` again resumes cleanly.

## 0. Preflight (every run)

**Sync:** `git fetch origin`; `git rev-parse --verify origin/dev origin/main` (both must exist).

## 0.5 Resolve the version (every run)

**One release is in flight at a time.** Take the first case that matches — in 1–4 a release already exists, so its version is adopted and nothing is asked:

1. **An open bump branch** — `git ls-remote --heads origin "bump/v*"`. The branch is deleted when its PR merges, so its presence means in flight; the version is its `v<X.Y.Z>` suffix. More than one match → **stop** and report (releases don't overlap).
2. **An open release PR** —
   ```bash
   gh pr list --repo SGAOperations/aplio --base main --head dev --state open --json number,title --jq '.[0]'
   ```
   Parse `Release v<X.Y.Z>` from the title. If it was renamed and doesn't parse, fall back to `git show origin/dev:package.json` — the bump rides into the release, so `dev` holds it.
3. **A merged release, not yet published** — `git show origin/main:package.json`. If `gh release view v<version>` does **not** exist, that is the version → Phase B.
4. **A bump already merged into `dev`** — `git show origin/dev:package.json`. If its version differs from `origin/main`'s, `dev` carries a bump whose branch is gone and whose release PR was never opened (a run that died between Part 1 and Part 2, then the bump PR got merged). Adopt `dev`'s version → Phase A, which skips Part 1 and opens the release PR. Without this case the fresh cycle would prompt for a version that can diverge from the one `dev` already holds.
5. **None of the above** → a fresh cycle. Go to "Fresh cycle — propose the version"; that step is the only place a version is ever asked for.

Everything below uses the resolved `<version>` (bare `1.2.3`; tagged form `v1.2.3`). Wake-ups always land in cases 1–4, so they never re-prompt.

## State detection (every run — pick the phase)

```bash
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

## Gather merged work

The version recommendation and the release-PR changelog are built from this **one** list. Run it **once per invocation** and reuse the result.

1. **Range — since the last published release**, deliberately not `origin/main..origin/dev`: `main` carries release-merge commits that were never part of a published release, so the tag is what "since last time" actually means.
   ```bash
   gh release list --repo SGAOperations/aplio --limit 1 --json tagName --jq '.[0].tagName'
   git log --oneline --no-merges <prev-tag>..origin/dev
   ```
   No previous release → the full history of `origin/dev`.
2. **Empty** → **stop**: `Nothing to release — origin/dev has no commits ahead of origin/main.` Never prompt for a version with nothing to release.
3. **Extract every `#<n>`** from the subjects (our convention is `#<n> message`; merge commits read `Merge pull request #<n>`). Dedupe, newest-first.
4. **Resolve each number** (PR metadata first, commit subject as fallback):
   ```bash
   gh pr view <n> --repo SGAOperations/aplio --json number,title,author,labels --jq '{number,title,login:.author.login,bot:.author.is_bot,labels:[.labels[].name]}'
   ```
   Keep `{number, title, labels, dependabot}` per ticket. **Dependabot** = the author is a bot whose login contains `dependabot`, **or** the PR carries a `dependencies`/`dependabot` label. A commit with **no** `#<n>` and not a merge becomes a numberless entry keeping its subject. If `gh pr view` fails, fall back to the commit subject.

---

## Fresh cycle — propose the version

Only when §0.5 reached case 5.

1. **Gather merged work** (above) — this both feeds the recommendation and short-circuits on an empty release.
2. **Current version:** the latest release tag with its `v` stripped; no releases → `git show origin/main:package.json`.
3. **Compute the three candidates** — at `1.4.3`: major `2.0.0`, minor `1.5.0`, patch `1.4.4`.
4. **Pick a recommendation** from the labels already gathered:

   | Signal across the gathered tickets                               | Bump                                   |
   | ---------------------------------------------------------------- | -------------------------------------- |
   | Any PR labelled `enhancement`, or any new user-facing capability | **minor**                              |
   | Only `bug`, `dependencies`, `documentation`, tooling or chore    | **patch**                              |
   | A breaking change                                                | **major** — offered, never recommended |

   **Never recommend major.** This repo has no breaking-change signal — no `breaking` label, no `!` in commit subjects, no `BREAKING CHANGE` trailer — so inferring one would be guessing. An unlabelled PR counts as patch work; the operator can still choose minor.

5. **Ask** with `AskUserQuestion` — recommendation **first**:
   - Option labels are the computed numbers with the bump kind: `1.5.0 — minor (recommended)`, then the other two.
   - Each description carries the **reasoning and the tickets behind it** — e.g. `#364 and #367 add new capability; the other 9 are fixes and dependency bumps`.
   - The major option says plainly that **no breaking-change signal was found**, so it is only for a deliberate choice.
   - A free-form answer is taken as a **custom version** — the way to reach a prerelease such as `1.5.0-beta.1`. Strip a leading `v`, trim, and require `X.Y.Z` (optionally `-prerelease`); if it doesn't parse, **stop** and report.
6. The answer is `<version>` for the rest of the run. Fall through to Phase A.

---

## Phase A — open the PRs

Guard: only run Phase A if the working tree is clean (`git status --porcelain` empty) and the gather was non-empty. If the tree is dirty, **stop** (commit/stash first). Continuing an in-flight release skips the fresh-cycle step, so run "Gather merged work" here if it hasn't run yet this invocation — Part 2 needs it.

### Part 1 — Bump PR (`bump/v<version>` → `dev`)

**Skip this part entirely** if `git show origin/dev:package.json` is already at `<version>` — the bump has merged.

**If `bump/v<version>` exists on origin** (§0.5 case 1 — you are continuing that release), don't recreate or re-commit it: go to step 4 and open the bump PR only if it doesn't have one, then continue to Part 2.

1. **Branch off the latest dev** (the bump rides into the release):
   ```bash
   git checkout -b bump/v<version> origin/dev
   ```
   If it exists locally but not on origin (a crashed run), `git checkout bump/v<version>` and continue.
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
4. **Open the bump PR** (base `dev`) unless one is already open:
   ```bash
   gh pr list --repo SGAOperations/aplio --head bump/v<version> --state open --json number --jq '.[0].number'
   ```
   Write a one-line body to `.temp/bump-pr.md`:
   ```
   Bumps the package version to v<version>. Merge this before the release PR.
   ```
   ```bash
   gh pr create --repo SGAOperations/aplio --base dev --head bump/v<version> \
     --title "bump version to v<version>" --body-file .temp/bump-pr.md --assignee "@me"
   ```
   Note the bump PR URL.

### Part 2 — Release PR (`dev → main`)

The body is **minimal**: short bullets only, **ticket number first** (`- #169 short description`). No paragraphs, no per-change detail.

1. **Take the gathered list** ("Gather merged work" — already resolved this run; don't re-run `git log`). Per entry:
   - **Title:** the PR title, stripping a leading `#<n> ` and any conventional prefix (`fix:`, `chore:` …).
   - **Section:** Dependabot entries → **Dependabot**; everything else, numberless entries included → **Changes**.
2. **Build the body** at `.temp/release-pr.md` (Write tool). One short line per bullet. Omit the Dependabot section if there are none:

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

3. **Open (or update) the release PR** — a `dev → main` PR is long-lived, so reuse an open one:

   ```bash
   gh pr list --repo SGAOperations/aplio --base main --head dev --state open --json number --jq '.[0].number'
   ```
   - **None open:** `gh pr create --repo SGAOperations/aplio --base main --head dev --title "Release v<version>" --body-file .temp/release-pr.md --assignee "@me"`
   - **One open:** `gh pr edit <existing-number> --repo SGAOperations/aplio --title "Release v<version>" --body-file .temp/release-pr.md`

   The title must keep the `Release v<version>` form — §0.5 case 2 reads the version back out of it.

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
   - Call **`ScheduleWakeup`** with `delaySeconds: 120` (~2 min — about how long the merge usually takes here) and `prompt` set **exactly** to `/release` (so the wake re-enters this command and re-detects state; §0.5 re-derives the version from the open PR), and a `reason` like `watching release PR #<n> to merge into main`.
   - Then stop for this turn. When the wake-up fires, this command runs again from §0.5 and either keeps waiting or moves to Phase B. **Do not** spin in a tight loop or block the turn waiting.

(~2 min between checks matches the typical merge time here; the wake-up re-enters the command, so each check is cheap.)

---

## Phase B — publish the GitHub Release + tag

Runs once `main` is at `<version>` / the release PR is merged — by then §0.5 case 3 resolves the version from `origin/main:package.json`, so no argument is needed. The notes here are **even shorter than the release PR**: single plain-language bullets, **only what's relevant to a user**. Exclude all behind-the-scenes work — Dependabot bumps, pipeline/tooling/`.claude`/CI/docs/refactors/chores. No ticket numbers.

1. **Confirm state.** `gh release view v<version>` must not exist. If `main` isn't at `<version>` yet, go back to "Watch for the merge" (don't publish early).
2. **Find the previous release** (for the change range):
   ```bash
   gh release list --repo SGAOperations/aplio --limit 1 --json tagName --jq '.[0].tagName'
   ```
   If there is no previous release, the range is the full history of `main`.
3. **Gather user-facing changes** between the previous tag and `main` — the same extraction as "Gather merged work", with `origin/main` in place of `origin/dev`:
   ```bash
   git log --oneline --no-merges <prev-tag>..origin/main
   ```
   **Keep only user-visible features and fixes.** Drop anything internal/behind-the-scenes (Dependabot, `.claude`/pipeline/tooling/CI/docs/test-only/refactor/chore). When unsure whether a change is user-relevant, **leave it out** — these notes are for users, not maintainers.
4. **Draft the notes** to `.temp/release-notes.md` (Write tool) — bullets only, each one short and in plain user language. **The last bullet is always exactly `- Minor enhancements and bug fixes`**, appended after the user-facing change bullets:
   ```
   - Plain description of a user-visible change
   - Another user-visible change
   - Minor enhancements and bug fixes
   ```
   (No heading — the release title is `v<version>`. No ticket numbers, no internal items. If nothing is user-facing, the single `- Minor enhancements and bug fixes` bullet stands alone.)
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
- **The version prompt happens at most once per release cycle** — an in-flight bump branch or release PR is a release to continue, never an error.
- **Phase B never publishes without explicit human approval of the notes.**
- The wait is driven by `ScheduleWakeup` re-entering `/release`; you invoke the command only once.
- File-based bodies/notes only (`gh ... --body-file` / `--notes-file`) — never inline `--body`/`--notes` for multi-line markdown (escaping breaks cross-platform).
- If anything is ambiguous (dirty tree, missing branch, nothing to release, PR closed unmerged, two bump branches, an unparseable custom version), **stop and report** rather than guessing.
