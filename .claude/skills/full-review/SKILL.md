---
name: full-review
description: Manual whole-app sweep for real bugs, confusing user-facing behavior, and code-level problems. Runs live verification itself against a local dev instance it stands up. Manual only. Usage: /full-review
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Write, AskUserQuestion, Bash(gh *), Bash(npm run *), Bash(git log *), Bash(rm -f tests/db/probe-*.test.ts), Browser
---

# Full Review — whole-app bug & consistency sweep

**Trigger:** Manual — a human runs `/full-review` whenever they want to check the whole site. Not tied to a release, a PR, or any schedule — run it as often or as rarely as someone wants.
**Input:** none — Phase 0 stands up its own local instance to verify against.
**Repo:** `SGAOperations/aplio`.

This is deliberately the opposite of the pipeline's `review-agent`: that one is diff-scoped and per-PR. This one sweeps the **entire app** for real bugs, confusing user-facing behavior, and code-level problems — duplicated logic, missing or over-built abstractions, dead code, inconsistent patterns between similar features. `CLAUDE.md`, `docs/ENGINEERING.md`, `docs/DESIGN.md`, `docs/PERMISSIONS.md` and `docs/WORKFLOWS.md` are useful context and get cited when they genuinely help, but **they are not the spec this command checks the code against** — they're maintained the same way the code is and drift too, so a finding stands on what the running app and the code actually do, not on a doc citation. This command never edits source or docs, never reviews a PR diff, and never applies a pipeline label — `review-agent` stays the only thing that does either.

## The load-bearing rule

**A finding is a claim that must survive execution before it is reported.** The first ad hoc run of this kind of audit (2026-08-10) failed by confident static reasoning: four "criticals" evaporated under testing. So this command runs in strict phases — candidates from the static sweep (Phase 2) are worthless until Phase 3 (things this command actually ran or read closely enough to prove) or Phase 4 (things this command actually clicked through live) promotes or kills them. A candidate nothing executed or closely verified is capped at 🟡 Low, lives under "Unverified", and is never filed as an issue.

Two things make the live phase real rather than aspirational: `prisma/seed.ts` already produces every `PositionStatus` and `ApplicationStatus`, plus a soft-deleted position and a deactivated user; and `/login/bypass` gives one-click persona switching wherever `isBypassAllowed()` is true (`VERCEL_ENV` `development` or `preview`). Phase 0 stands up a local dev instance and Phase 4 drives it directly, using the session's own Browser tool to log in as each persona and read the actual result. No script is handed off for a human to run, and there is no dependency on a Vercel preview being reachable.

## Evidence rules

State once; every phase below defers to this.

- **`verified-live`** — the command (or, if it's driving manually, the operator) performed named steps on the running local instance and observed the actual result. **Required for 🔴 Critical.**
- **`verified-in-code`** — reading the actual code (both sides of a comparison, a grep with a clear result) or a command this review actually ran proves it, named with what it showed. **Required for 🟠 Medium.**
- **`plausible`** — reasoning only, nothing executed or directly confirmed. **Capped at 🟡 Low, listed under "Unverified", never filed as an issue.**
- An **untagged finding is not reported.** Severities reuse the pipeline's vocabulary — 🔴 Critical · 🟠 Medium · 🟡 Low · ⚪ Nit — don't invent a second scale.
- **The disproved section is mandatory.** Every candidate killed in Phase 3 or 4 gets `suspected → what was checked → what actually happens`. If nothing was disproved, say so explicitly (`0 of N candidates disproved`) and flag it — an all-confirmed run means the sweep was too shallow, not that the code is clean.

## Phase 0 — stand up a local instance

This command tests against **local dev**, not a Vercel preview — a preview may be gated by Vercel's own access controls, and this command doesn't hand off to a human to click around on its behalf.

1. Check whether a dev server is already reachable at `http://localhost:3000`; if so and `/login/bypass` loads, skip to step 5.
2. `npm run db:start` (Postgres via `docker compose`). If the port is already taken by something else, **stop and ask** the operator rather than picking a different port on your own.
3. Confirm `.env` has a working `DATABASE_URL`/`DIRECT_URL` for that Postgres, a `BETTER_AUTH_SECRET`, and `VERCEL_ENV=development` (see `.env.example`). If any is missing, **stop and ask** before writing to `.env` — it's local-only and gitignored, but it's still the operator's file.
4. `npm run prisma:migrate:deploy` then `npm run prisma:seed` (a no-op if already seeded).
5. Start `npm run dev` in the background; once it reports ready, open it with the Browser tool and confirm `/login/bypass` renders the three persona buttons.

This command always sweeps the whole app; there's no diff or date-range scope to narrow it.

## Phase 1 — fixture gate

Run check 10 (`checks.md`) first, before anything else. Any `PositionStatus`/`ApplicationStatus` member the seed doesn't cover → report it as a finding **and degrade** the live phase for that state: claims touching an uncovered state max out at `plausible` for the rest of this run. Never proceed as if the fixture existed.

## Phase 2 — static sweep

Run checks 1–9 from `checks.md`, producing **candidates only** — each line `path:line · suspected problem · what would prove or kill it`. **No candidate from this phase may be written into the final report as-is.** Cross-reference existing issues opportunistically here if one surfaces, but the systematic dedup pass is Phase 5.

## Phase 3 — verification

**Do not blanket-rerun `npm run test`/`eslint:check`/`tsc:check`** — those already gate every PR on this codebase, so rerunning the whole suite here proves nothing new when this command makes no code changes. Verification here is targeted, per candidate:

- **Data-layer / logic candidates** (checks 1, 3, 4): write a throwaway probe at `tests/db/probe-<slug>.test.ts` (Write tool — the `probe-` prefix exists so cleanup can never match a real test), run it —
  ```bash
  npm run test -- --project db
  ```
  — record the exact assertion against the candidate, then delete the probe:
  ```bash
  rm -f tests/db/probe-<slug>.test.ts
  ```
  Probes are **never committed** — this phase must leave `git status` exactly as it found it.
- **Code-reading candidates** (checks 2 categories 1–2, 5, 7, 8): re-read both sides side by side. If the comparison holds up, that reading **is** the `verified-in-code` evidence — no command needed.
- **Live-only candidates** (check 2 category 3, check 6, check 9): nothing here promotes them — they carry through to Phase 4 unresolved.

## Phase 4 — live verification

For every candidate that survived Phase 2/3 needing a live check, drive the local instance from Phase 0 directly using the Browser tool: log in as the right persona via `/login/bypass`, perform the described action against the right record state, and read the actual result (`get_page_text`/`read_page`, or a screenshot when the Browser pane is actually displayed — it isn't always, so fall back to the DOM/text read rather than blocking on a screenshot). Switch personas by returning to `/login/bypass`, never by guessing at cookies directly.

Include the known-open items from `docs/PERMISSIONS.md` → Known-open deviations and `docs/WORKFLOWS.md`'s `### Known open` blocks as a sanity check that nothing already-known has silently gotten worse — weight these the same as any other candidate; they don't get special trust just for being written down.

A candidate this phase genuinely can't resolve on its own (needs human judgment on whether something _looks_ right, or needs a persona/state this seed doesn't cover) stays `plausible` — don't guess at the result. If the Browser tool isn't available in this session at all, fall back to emitting a per-persona script for the operator to run themselves, and say so plainly in the report; that fallback is the exception, not the default.

## Phase 5 — dedup

For every finding that survived Phase 3/4:

```bash
gh issue list --repo SGAOperations/aplio --state all --search "<terms>"
```

Also check `docs/PERMISSIONS.md` → Known-open deviations and each `### Known open` block in `docs/WORKFLOWS.md` — both already carry owner issue numbers. **Exact match** → cite the existing issue number and drop the finding. **Partial match** → note the relationship in the finding's Fix line rather than filing a near-duplicate.

## Phase 6 — report and file

1. **Build the report** at `.temp/full-review-<date>.md` (Write tool):
   - A one-line counts header.
   - **## Confirmed findings** — grouped Critical → Nit; each line: `**F<n> <sev> <tag>** — problem. Evidence: … Fix: <one line>. \`path:line\``. Tag each finding with its kind inline in the problem sentence (bug / broken affordance / security hole / UX confusion / duplication / dead code / accessibility) so a reader can scan for the category they care about.
   - **## Unverified** — capped `plausible` candidates, including anything a doc mismatch surfaced that nothing could confirm live or in code (note explicitly when a mismatch might mean the **doc** is stale rather than the code being wrong — don't assume the code is at fault).
   - **## Tested and disproved** — every killed candidate, per the Evidence rules above.
   - **## Checks run** — every targeted verification command from Phase 3 with its result (this is the "explicitly lists what it tested" half of the acceptance bar) — not a rerun of the standard CI suite.
2. **Present it verbatim and get approval before creating anything.** Iterate on operator feedback; do not file until they say go.
3. **On approval:**
   - One epic issue `Full platform review — YYYY-MM-DD`, body = the whole report (`--body-file`).
   - One sub-issue per confirmed 🔴 Critical / 🟠 Medium finding, linked to the epic with the REST `sub_issues` + GraphQL recipes in `.claude/skills/scope/SKILL.md`. Label `bug` for a behaviour defect, `documentation` only for a finding whose fix is a doc edit.
   - `plausible` findings stay in the epic body only — never their own issue.
   - **Never apply a pipeline trigger label** (`ready`, `claude`) to anything this phase creates — opting a finding into the pipeline stays a human decision made later, via `/pipeline`.

## Guardrails

- Never edit source or docs — this command is read-only on the codebase; it only reads, runs targeted verification, and writes to `.temp/` and throwaway `tests/db/probe-*` files.
- Never commit anything, and never leave a probe test behind — `git status` must be clean when this command finishes.
- Never file an issue without the Phase 6 approval gate.
- **Report `0 findings` honestly rather than padding the report** — an empty confirmed-findings section is a valid outcome.
- If the live instance is unreachable, or the fixtures are incomplete in a way Phase 1 can't route around, **stop and ask** rather than guessing or proceeding with a degraded review that isn't labeled as such.
