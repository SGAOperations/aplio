# Full Review — Check Catalogue

Loaded on demand by `.claude/skills/full-review/SKILL.md`'s Phase 2. One entry per class: **what it looks for · the grep/read anchors · the doc clause it violates · what would promote it past `plausible`.** The anchors matter — a class without them degrades into vibes. Every candidate found here is worthless until Phase 3 or Phase 4 promotes or kills it (see "Evidence rules" in `SKILL.md`).

## 1. State-machine gating

**Looks for:** an action taking a record id whose `where` narrows by `id`/`userId` only, on a model that has a status field — every action must gate on **record status**, not just ownership.

**Anchors:** every export in `prisma/actions/*`, checked against `docs/PERMISSIONS.md` → Application lifecycle and the `lib/constants.ts` sets: `APPLICATION_STATUS_TRANSITIONS`, `APPLICANT_EDITABLE_APPLICATION_STATUSES`, `NON_REVIEWABLE_APPLICATION_STATUSES`, `TERMINAL_DECISION_STATUSES`, `REJECTABLE_APPLICATION_STATUSES`. Note the three same-members-different-meaning constant pairs `PERMISSIONS.md` already warns about — a wrong-set bug is invisible to grep and only shows up when the members diverge.

**Violates:** `docs/PERMISSIONS.md` → Application lifecycle / Server-action authorization.

**Promote via:** a `tests/db` probe that exercises the action from the wrong status and asserts it's rejected.

## 2. UI ↔ backend parity

**Looks for:** the three categories, kept separate in the report because they are different bugs — backend allows / UI never offers (dead capability); UI offers / backend refuses (broken affordance); **UI is the only gate** (a hole).

**Anchors:** each control rendered behind `canManage` / `user.isAdmin` / a status check, paired with the guard and status check inside the action it calls.

**Violates:** `docs/PERMISSIONS.md` → Server-action authorization (the backend side) and the route/action it wraps (the UI side).

**Promote via:** category 3 only `verified-live` — the operator invokes the affordance as the wrong persona and reports what happened. Categories 1–2 can promote via `verified-in-code` (reading both sides directly proves the mismatch; no live step is needed to see a control that never renders, or an action that a rendered control cannot reach).

## 3. Soft-delete join integrity

**Looks for:** any `prisma.application.*` call that doesn't compose `buildApplicationWhere` / `buildApplicationScopeWhere` (`lib/auth/scopes.ts`) or one of `VISIBLE_POSITION_WHERE` / `PUBLISHED_POSITION_WHERE` (`lib/constants.ts`), and any place the two `*_POSITION_WHERE` constants are swapped.

**Anchors:** `prisma/actions/*`, `prisma/data/*`; `docs/PERMISSIONS.md` → Position visibility says which constant applies where.

**Violates:** `docs/PERMISSIONS.md` → Position visibility.

**Promote via:** a `tests/db` probe that soft-deletes a position and asserts the row disappears from the surface in question.

## 4. Snapshot-vs-live consistency

**Looks for:** the snapshot columns (`applicantName`, `questionLabel`, `questionType`, answer values) versus live `GlobalQuestion` / `PositionQuestion` — specifically any surface where the client validates against the live question set and the server against the snapshot, or vice versa.

**Anchors:** `prisma/actions/applications.ts`, `prisma/actions/question-files.ts`, the apply stepper's schema construction.

**Violates:** `docs/PERMISSIONS.md` → Question editing and answer preservation.

**Promote via:** a `tests/db` probe that edits a question after an answer exists, then asserts the answer's snapshot fields are unchanged.

## 5. Link reachability by record state

**Looks for:** every rendered `href` in `app/` and `components/`, mapped to its `docs/PERMISSIONS.md` → Route access row, checked against the state and persona that rendered it.

**Anchors:** `app/**`, `components/**` for `href=`/`Link` usage; `docs/PERMISSIONS.md` → Route access.

**Violates:** `docs/PERMISSIONS.md` → Route access.

**Promote via:** `verified-live` only — the first run's real find was of this shape (a redirect into a page the applicant cannot see), so this class is never reported from static reasoning alone.

## 6. Denial-mechanism consistency

**Looks for:** any authorization branch not going through `lib/auth/guards.ts` — a bare `user.isAdmin` read outside guards / nav / `lib/auth/scopes.ts`; a bare `notFound()` acting as an auth gate; `{ error: 'Unauthorized' }` / `'Forbidden'` returns (a denial is never `{ error }`); a new `Deny` branch that skips `denyWith`.

**Anchors:** `lib/auth/guards.ts`, `Grep` for `isAdmin` outside that file plus nav/query-scoping call sites, `Grep` for `'Unauthorized'`/`'Forbidden'` in `prisma/actions/*`.

**Violates:** `docs/PERMISSIONS.md` → Denial convention; `docs/ENGINEERING.md` §3.

**Promote via:** `verified-in-code` — reading the branch and its call sites proves the mismatch without a live step.

## 7. Measured accessibility

**Looks for:** real WCAG contrast ratios per token pair in both themes (never eyeballed), touch targets under the ~44px mobile floor, and the `docs/DESIGN.md` §4 page-width tier rules.

**Anchors:** `npm run contrast:check` for contrast — never compute a ratio by hand. Touch targets: `Grep` interactive elements for `h-`/`size-`/`min-h-` under the 44px-equivalent Tailwind scale, then confirm live at 375px. Page width: every route's top-level container against `docs/DESIGN.md` §4's tier table, plus the rule that a route's `loading.tsx` matches its `page.tsx` tier.

**Violates:** `docs/DESIGN.md` §2 (contrast), §4 (page width), §8 (touch targets).

**Promote via:** `verified-in-code` for contrast (the script's own exit code) and page-width tiers (both files are readable); `verified-live` for touch targets (measuring at 375px).

## 8. Seed coverage

**Looks for:** every `PositionStatus` and `ApplicationStatus` member in `prisma/schema.prisma` appearing in `prisma/seed/positions.ts` / `prisma/seed/applications.ts`, plus the soft-deleted position and the deactivated user.

**Anchors:** `prisma/schema.prisma` enum blocks; `prisma/seed/positions.ts`, `prisma/seed/applications.ts`, `prisma/seed/users.ts`.

**Violates:** the acceptance bar for every other class in this file — a state the fixtures cannot reach is a state no live claim about it can be trusted for, which is why this check **runs first** (Phase 1) rather than alongside 1–7.

**Promote via:** direct read — comparing the schema enum to the seed defs is deterministic; no execution needed beyond reading both files.

## Adding a class

These eight are a floor, not a ceiling. A run that finds a new **class** of problem (not just a new instance of an existing one) appends it here with the same four-part shape — that's the only way this command improves across releases.
