# Full Review — Check Catalogue

Loaded on demand by `.claude/skills/full-review/SKILL.md`'s Phase 2. One entry per class: **what it looks for · the grep/read anchors · why it matters · what would promote it past `plausible`.** The anchors matter — a class without them degrades into vibes. Every candidate found here is worthless until Phase 3 or Phase 4 promotes or kills it (see "Evidence rules" in `SKILL.md`).

The docs (`CLAUDE.md`, `docs/ENGINEERING.md`, `docs/DESIGN.md`, `docs/PERMISSIONS.md`, `docs/WORKFLOWS.md`) are useful context and are cited where they genuinely help, but they are **not ground truth** — they're maintained the same way this codebase is, and drift too. A finding stands on what the running app and the code actually do; a doc citation is supporting evidence, never the basis of the finding by itself.

## 1. State-machine gating bugs

**Looks for:** an action taking a record id whose `where` narrows by `id`/`userId` only, on a model that has a status field — every action should gate on **record status**, not just ownership, unless every status genuinely permits the action.

**Anchors:** every export in `prisma/actions/*`; compare each action against the others that touch the same model — an inconsistency between two similar actions (one gates on status, a near-identical one doesn't) is the strongest signal. `lib/constants.ts`'s status sets (`APPLICATION_STATUS_TRANSITIONS`, `APPLICANT_EDITABLE_APPLICATION_STATUSES`, `NON_REVIEWABLE_APPLICATION_STATUSES`, `TERMINAL_DECISION_STATUSES`, `REJECTABLE_APPLICATION_STATUSES`) are the intended rules; note the three same-members-different-meaning pairs among them — a wrong-set bug is invisible to grep and only shows up when the members diverge.

**Why it matters:** a caller can move a record through a state it shouldn't be reachable from (e.g. editing a submitted application, reviewing a draft).

**Promote via:** a `tests/db` probe that exercises the action from the wrong status and asserts it's rejected.

## 2. UI ↔ backend parity

**Looks for:** three distinct bugs — backend allows / UI never offers (dead capability); UI offers / backend refuses (broken affordance, the user hits an error); **UI is the only gate** (a hole — anyone who can reach the request directly bypasses it).

**Anchors:** each control rendered behind `canManage` / `user.isAdmin` / a status check, paired with the guard and status check inside the action it actually calls.

**Why it matters:** category 3 is a real security hole; category 2 is a broken user-facing feature; category 1 is confusing dead weight.

**Promote via:** category 3 only `verified-live` — invoke the affordance as the wrong persona and report what happens. Categories 1–2 can promote via `verified-in-code` (reading both sides directly proves the mismatch).

## 3. Soft-delete / query-scope integrity

**Looks for:** any `prisma.application.*` / `prisma.position.*` call that doesn't compose the shared scope helpers (`buildApplicationWhere` / `buildApplicationScopeWhere` in `lib/auth/scopes.ts`, `VISIBLE_POSITION_WHERE` / `PUBLISHED_POSITION_WHERE` in `lib/constants.ts`) — including a bespoke `where` that reimplements one of them slightly wrong, or the two `*_POSITION_WHERE` constants swapped.

**Anchors:** `prisma/actions/*`, `prisma/data/*` — grep for `prisma.application.` / `prisma.position.` and check each hit's `where` against the shared helpers.

**Why it matters:** a soft-deleted or draft record leaking into a list it shouldn't appear in (or a manager seeing another manager's position) is a data-integrity/disclosure bug, not a display glitch.

**Promote via:** a `tests/db` probe that soft-deletes a position (or sets it to `draft`) and asserts the row disappears from the surface in question.

## 4. Snapshot-vs-live consistency

**Looks for:** the snapshot columns (`applicantName`, `questionLabel`, `questionType`, answer values) versus live `GlobalQuestion` / `PositionQuestion` rows — any surface where the client validates against the live question set and the server against the snapshot, or vice versa.

**Anchors:** `prisma/actions/applications.ts`, `prisma/actions/question-files.ts`, the apply stepper's schema construction.

**Why it matters:** an edited or deleted question can retroactively change what a submitted application appears to have asked, or silently reject an answer that was valid when submitted.

**Promote via:** a `tests/db` probe that edits a question after an answer exists, then asserts the answer's snapshot fields are unchanged.

## 5. Denial-mechanism consistency

**Looks for:** any authorization branch not going through `lib/auth/guards.ts` — a bare `user.isAdmin` read outside guards / nav / `lib/auth/scopes.ts`; a bare `notFound()` acting as an undocumented auth gate; `{ error: 'Unauthorized' }` / `'Forbidden'` returns; a new denial branch that doesn't reuse the existing `denyWith` pattern.

**Anchors:** `lib/auth/guards.ts` as the reference shape; `Grep` for `isAdmin` outside that file plus nav/query-scoping call sites; `Grep` for `'Unauthorized'`/`'Forbidden'` in `prisma/actions/*`.

**Why it matters:** a hand-rolled check that drifts from the shared guard is exactly the kind of thing that's correct today and silently wrong after the next unrelated edit.

**Promote via:** `verified-in-code` — reading the branch and its call sites proves the mismatch without a live step.

## 6. User-flow reachability & consistency

**Looks for:** dead ends (a link or redirect into a page the current persona/record-state combination can't actually see), and the same concept behaving or looking different across screens that should agree — different copy for the same error, an action available on one list view but missing from an equivalent detail view, inconsistent empty/loading treatment for parallel surfaces.

**Anchors:** every rendered `href`/redirect in `app/` and `components/`, walked as the persona and record state that would actually render it. Compare parallel surfaces directly (e.g. `/applications` vs `/my-applications`, the position edit tabs vs each other) rather than against a doc.

**Why it matters:** this class produced the first run's real find (a redirect into a page the applicant couldn't see) — it's the shape of bug that only shows up when someone actually clicks through, not when reading one file in isolation.

**Promote via:** `verified-live` only — this class is never reported from static reasoning alone.

## 7. Duplicated logic & abstraction problems

**Looks for:** logic, UI, types, or zod schemas duplicated across 2+ places that should share one home (per `docs/ENGINEERING.md` §1's own bar); the inverse too — an abstraction serving unrelated cases that would be clearer split back apart, or a helper with so many flags/branches it's harder to read than its call sites would be inlined.

**Anchors:** `Grep` for repeated distinctive literals (error strings, validation patterns, status-label maps) across `prisma/actions/*`, `prisma/data/*`, `components/features/*`; read every file under `lib/` for a helper whose call sites no longer share real logic.

**Why it matters:** duplicated business logic drifts — one copy gets fixed, the other doesn't, and nobody notices until behavior disagrees for two records that should be treated the same.

**Promote via:** `verified-in-code` — reading the occurrences side by side either proves they're genuinely identical (or genuinely unrelated) directly.

## 8. Dead code & unused exports

**Looks for:** exported functions/components/constants nothing imports; unreachable branches (a condition that can't be false given its callers); leftover scaffolding or commented-out code; a `useEffect` or abstraction that was clearly a workaround for something no longer true.

**Anchors:** `Grep` an export's name across the repo — a hit count of 1 (the declaration itself) means dead; check `components/features/*`, `lib/*`, `prisma/data/*` first, since those accumulate the most orphans over time.

**Why it matters:** dead code is a maintenance tax and a trap — the next person assumes it's load-bearing and works around it instead of deleting it.

**Promote via:** `verified-in-code` — a zero-import grep result is direct proof, no live step needed.

## 9. Accessibility (manual)

**Looks for:** semantic HTML (buttons as `<button>`, heading hierarchy), keyboard operability (focus rings, tab order, Escape on overlays), and touch targets under the ~44px mobile floor. Contrast is judged **by eye in-browser only** — there is no automated ratio check in this command, so a contrast concern is capped at `plausible` unless a human measures it live with devtools.

**Anchors:** `Grep` interactive elements for `outline-none` without a visible replacement; `Grep` for `h-`/`size-`/`min-h-` under the Tailwind-scale equivalent of 44px on elements that handle clicks/taps.

**Why it matters:** these are the accessibility failures that don't show up in a type-check or a unit test — only in actually tabbing through the UI or reaching for a target with a thumb.

**Promote via:** `verified-live` — confirm live at 375px and with the keyboard; a grep hit alone is `plausible`.

## 10. Seed coverage

**Looks for:** every `PositionStatus` and `ApplicationStatus` member in `prisma/schema.prisma` appearing in `prisma/seed/positions.ts` / `prisma/seed/applications.ts`, plus the soft-deleted position and the deactivated user.

**Anchors:** `prisma/schema.prisma` enum blocks; `prisma/seed/positions.ts`, `prisma/seed/applications.ts`, `prisma/seed/users.ts`.

**Why it matters:** this is the gate for everything else in this file — a state the fixtures can't reach is a state no live claim about it can be trusted for, which is why this check **runs first** (Phase 1), not alongside 1–9.

**Promote via:** direct read — comparing the schema enum to the seed defs is deterministic; no execution needed beyond reading both files.

## Adding a class

These ten are a floor, not a ceiling. A run that finds a new **class** of problem (not just a new instance of an existing one) appends it here with the same four-part shape — that's the only way this command improves across runs.
