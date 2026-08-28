---
name: full-review
description: Manual, once-per-release whole-platform audit against CLAUDE.md, docs/ENGINEERING.md, docs/DESIGN.md, docs/PERMISSIONS.md and docs/WORKFLOWS.md — checks the code against the spec docs and reports drift in both directions, with every finding tagged verified-live / verified-in-code / plausible. Manual only. Usage: /full-review
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Write, AskUserQuestion, Bash(gh *), Bash(npm run *), Bash(git log *), Bash(rm -f tests/db/probe-*.test.ts)
---

# Full Review — whole-platform audit

**Trigger:** Manual — a human runs `/full-review`, once per release.
**Input:** none — the base URL for live verification is asked in Phase 0.
**Repo:** `SGAOperations/aplio`.

This is deliberately the opposite of the pipeline's `review-agent`: that one is diff-scoped and per-PR; this one sweeps the **entire app** against `CLAUDE.md`, `docs/ENGINEERING.md`, `docs/DESIGN.md`, `docs/PERMISSIONS.md` and `docs/WORKFLOWS.md` and reports **drift in both directions** — code the docs don't describe, and documented behaviour the code no longer implements. Those docs are the spec: this command **never regenerates or edits them**, and it never reviews a PR diff or applies a pipeline label — `review-agent` stays the only thing that does either.

## The load-bearing rule

**A finding is a claim that must survive execution before it is reported.** The first run of this audit (2026-08-10) failed by confident static reasoning: four "criticals" evaporated under testing. So this command runs in strict phases — candidates from the static sweep (Phase 2) are worthless until Phase 3 (things this command actually ran) or Phase 4 (things a human actually clicked) promotes or kills them. A candidate nothing executed is capped at 🟡 Low, lives under "Unverified", and is never filed as an issue.

Two things make the live phase real rather than aspirational: `prisma/seed.ts` already produces every `PositionStatus` and `ApplicationStatus`, plus a soft-deleted position and a deactivated user; and `/login/bypass` gives one-click persona switching wherever `isBypassAllowed()` is true (`VERCEL_ENV` `development` or `preview`). This command has no browser tooling, so the click-through is a **generated script a human runs** — Phase 4 blocks on the results.

## Evidence rules

State once; every phase below defers to this.

- **`verified-live`** — an operator performed named steps on the running instance and reported the result. **Required for 🔴 Critical.**
- **`verified-in-code`** — a command this review actually ran proves it, named with its assertion. **Required for 🟠 Medium.**
- **`plausible`** — reasoning only, nothing executed. **Capped at 🟡 Low, listed under "Unverified", never filed as an issue.**
- An **untagged finding is not reported.** Severities reuse the pipeline's vocabulary — 🔴 Critical · 🟠 Medium · 🟡 Low · ⚪ Nit — don't invent a second scale.
- **The disproved section is mandatory.** Every candidate killed in Phase 3 or 4 gets `suspected → what was tested → what actually happens`. If nothing was disproved, say so explicitly (`0 of N candidates disproved`) and flag it — an all-confirmed run means the verification was too shallow, not that the code is clean.

## Phase 0 — scope and setup

1. **Range since the last review**, reported context only (the sweep itself is whole-platform regardless):
   ```bash
   gh release list --repo SGAOperations/aplio --limit 1 --json tagName --jq '.[0].tagName'
   git log --oneline --no-merges <tag>..origin/dev
   ```
   No previous release → note the full history of `origin/dev` instead.
2. **Ask for the live instance.** `AskUserQuestion` for the base URL of a running instance where `isBypassAllowed()` is true. Recommend a **Vercel preview** as the default — local `npm run dev` needs env vars this repo's `.env` doesn't carry. Confirm with the operator that the seed has run there before continuing.

## Phase 1 — fixture gate

Run check 9 (`checks.md`) first, before anything else. Any `PositionStatus`/`ApplicationStatus` member the seed doesn't cover → report it as a finding **and degrade** the live phase for that state: claims touching an uncovered state max out at `plausible` for the rest of this run. Never proceed as if the fixture existed.

## Phase 2 — static sweep

Run checks 1–8 from `checks.md`, producing **candidates only** — each line `path:line · suspected problem · the doc clause it cites · what would prove or kill it`. **No candidate from this phase may be written into the final report as-is.** Cross-reference existing issues opportunistically here if one surfaces, but the systematic dedup pass is Phase 5.

## Phase 3 — executed verification

Run the automated checks once, up front:

```bash
npm run test
npm run tsc:check
npm run eslint:check
npm run contrast:check
```

Then, **per data-layer candidate** from Phase 2: write a throwaway probe at `tests/db/probe-<slug>.test.ts` (Write tool — the `probe-` prefix exists so cleanup can never match a real test), run it —

```bash
npm run test -- --project db
```

— record the exact command and assertion against the candidate, then delete the probe:

```bash
rm -f tests/db/probe-<slug>.test.ts
```

Probes are **never committed** — this phase must leave `git status` exactly as it found it.

## Phase 4 — live click-through

Emit a **per-persona script** (anonymous → applicant → position manager → admin, switching via `/login/bypass`), one numbered step per candidate that survived Phase 2/3: what to do, as whom, on which record state, and the expected result. Include the fixed regression set the doc-level `Known open` entries imply (`docs/PERMISSIONS.md` → Known-open deviations, `docs/WORKFLOWS.md`'s `### Known open` blocks) as a sanity check that nothing already-known has silently gotten worse.

**Then stop and wait for the operator's results.** Do not write the report from an unanswered script — an emitted-but-unrun script is not evidence of anything.

## Phase 5 — dedup

For every finding that survived Phase 3/4:

```bash
gh issue list --repo SGAOperations/aplio --state all --search "<terms>"
```

Also check `docs/PERMISSIONS.md` → Known-open deviations and each `### Known open` block in `docs/WORKFLOWS.md` — both already carry owner issue numbers. **Exact match** → cite the existing issue number and drop the finding. **Partial match** → note the relationship in the finding's Fix line rather than filing a near-duplicate.

## Phase 6 — report and file

1. **Build the report** at `.temp/full-review-<date>.md` (Write tool):
   - A one-line counts header.
   - **## Confirmed findings** — grouped Critical → Nit; each line: `**F<n> <sev> <tag>** — problem. Evidence: … Violates: <doc> → <section>. Fix: <one line>. \`path:line\``.
   - **## Drift** — split `code not in the docs` / `docs not in the code` (which side is wrong differs between the two).
   - **## Unverified** — capped `plausible` candidates.
   - **## Tested and disproved** — every killed candidate, per the Evidence rules above.
   - **## Checks run** — every command from Phase 3 with its result (this is the "explicitly lists what it tested" half of the acceptance bar).
2. **Present it verbatim and get approval before creating anything.** Iterate on operator feedback; do not file until they say go.
3. **On approval:**
   - One epic issue `Full platform review — YYYY-MM-DD`, body = the whole report (`--body-file`).
   - One sub-issue per confirmed 🔴 Critical / 🟠 Medium finding, linked to the epic with the REST `sub_issues` + GraphQL recipes in `.claude/skills/scope/SKILL.md`. Label `bug` for a behaviour defect, `documentation` for pure doc drift.
   - `plausible` findings stay in the epic body only — never their own issue.
   - **Never apply a pipeline trigger label** (`ready`, `claude`) to anything this phase creates — opting a finding into the pipeline stays a human decision made later, via `/pipeline`.

## Guardrails

- Never edit source or docs — this command is read-only on the codebase; it only reads, runs checks, and writes to `.temp/` and throwaway `tests/db/probe-*` files.
- Never regenerate the permissions matrix or the workflow catalogue — `PERMISSIONS.md` and `WORKFLOWS.md` are the spec this command checks _against_.
- Never commit anything, and never leave a probe test behind — `git status` must be clean when this command finishes.
- Never file an issue without the Phase 6 approval gate.
- **Report `0 findings` honestly rather than padding the report** — an empty confirmed-findings section is a valid outcome.
- If the live instance is unreachable, or the fixtures are incomplete in a way Phase 1 can't route around, **stop and ask** rather than guessing or proceeding with a degraded review that isn't labeled as such.
