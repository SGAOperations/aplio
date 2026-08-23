# Permissions

Who may change what, and when. Written against the **target** state — where today's code disagrees, the deviation is listed at the bottom with the ticket that closes it.

## Position status lifecycle

`PositionStatus` is `draft | open | closed` (`STATUS_VALUES`, `lib/constants.ts`). Archived is not a status — see [Archive](#archive).

| Transition                                   | Allowed     | Rule                                                           |
| -------------------------------------------- | ----------- | -------------------------------------------------------------- |
| `draft → open` (publish)                     | yes         | Any manager, non-archived position                             |
| `open → closed` (close)                      | yes         | Confirm first when unresolved applications exist               |
| `closed → open` (reopen)                     | conditional | Only when `closesAt` is null or in the future                  |
| `open → draft`, `closed → draft` (unpublish) | conditional | Blocked once any non-deleted application exists, at any status |
| create as `closed`                           | no          | `createPosition` may only create `draft` or `open`             |

- **Reopening past `closesAt` is a silent no-op**, not a reopen — `getPositionAvailability` (`lib/utils.ts`) still returns `closed_by_date`, so the position reads Open and accepts nothing. Reject it: `{ error: "This position's close date has passed. Clear or extend the close date to reopen it." }`
- **Unpublishing hides a position out from under applicants who already have work in it**, so the first application — including a draft nobody has submitted — is one-way out of `draft`: `{ error: 'Someone has already started an application, so this position cannot go back to draft. Close it instead.' }`
- **Reopening changes nothing about existing applications.** Decisions stand; a reviewer reverses one through the application status control, not by reopening the position.
- `Application` is unique on `[userId, positionId]` (`prisma/schema.prisma`), so a rejected or withdrawn applicant still cannot reapply to a reopened position. Known-open, not fixed by this policy.

## What freezes when

**Publish freezes nothing. The first application freezes nothing.** The only hard freeze is archive. Do not re-derive a stricter rule from the fact that a position is live — freezing fields would be stricter than the settled "questions stay fully editable", which is incoherent.

| Capability (manager)          | `draft`    | `open`                    | `closed`                    | archived   |
| ----------------------------- | ---------- | ------------------------- | --------------------------- | ---------- |
| Title, description            | ✓          | ✓                         | ✓                           | ✗          |
| `opensAt` / `closesAt`        | ✓          | ✓                         | ✓                           | ✗          |
| Questions (add, edit, delete) | ✓          | ✓                         | ✓                           | ✗          |
| Managers (add, remove others) | ✓          | ✓                         | ✓                           | ✓          |
| Status → `open` / `closed`    | ✓          | ✓                         | only if `closesAt` not past | ✗          |
| Status → `draft`              | ✓          | only with no applications | only with no applications   | ✗          |
| Delete the position           | admin only | admin only                | admin only                  | admin only |

Managers stay editable on an archived position: membership is how an admin hands oversight off, and `addPositionManager` / `removePositionManager` deliberately skip `checkPositionEditable`.

## Guardrails instead of freezes

Confirmations carry the risk the freezes don't.

- **Closing with unresolved applications** — "N applications are still in progress. Closing stops new applications; the ones you have stay reviewable."
- **Reopening** — the position becomes listed and applyable again.
- **Deleting a question that has answers** — the existing advisory in `components/features/position-questions-section.tsx`, driven by `getPositionForEdit`'s `answerCount`.
- **`closesAt` may never precede `opensAt`** — validation rather than a confirmation, and the one guardrail that does not exist yet.

## Archive

- **Archived is derived, never stored.** `isPositionActive` (`lib/utils.ts`) is the single source of truth, fed by `positionActivitySelect` (`prisma/data/positions.ts`). A second implementation is an authorization bug, not a display bug.
- A position is archived once it is closed (`status: 'closed'`, or `open` past `closesAt`), has no unresolved applications, and last closed more than `MANAGED_POSITIONS_WINDOW_DAYS` ago.
- **There is no manual archive or unarchive.** A position leaves archive only when an admin reopens it with a future close date.
- Managers are denied with `ARCHIVED_POSITION_EDIT_ERROR` (`lib/constants.ts`), returned by `updatePosition` and the three position-question actions. Admins short-circuit the check inside `checkPositionEditable` (`prisma/data/positions.ts`).
- **The edit page does not 404.** It renders `PositionDetailsReadonly` / `PositionQuestionsReadonly` behind an explanatory callout, so a manager can still read what they can no longer change.

## Manager vs admin

Manager is M2M membership in `Position.managers` (`prisma/schema.prisma`), not a flag on `User`. `createPosition` auto-connects its creator, so a manager can always edit what they made.

**There is no field-level split.** A manager may do everything on a non-archived position. An admin adds exactly three things:

1. Edit an archived position.
2. Delete a position (`requireAdmin`; still blocked by `POSITION_DELETE_BLOCKED_ERROR` once non-draft applications exist).
3. Remove any manager, including themselves — the self-removal block lives in `removePositionManager`.

## Question editing and answer preservation

- Questions are editable at every non-archived status. Publishing and receiving applications lock nothing.
- **A question edit never rewrites or deletes an answer.** The reviewer-visible label is the snapshot `questionLabel` written onto the answer row at answer time (`prisma/schema.prisma`), rendered by `components/features/application-answers-list.tsx` — so a relabelled question does not retroactively change what a submitted application appears to have been asked.
- **Deletion is soft** (`deletePositionQuestion`), so a removed question keeps rendering its stored answers on the applications that have them; only new and in-progress forms lose it.
- **Drafts and withdrawn applications must satisfy newly-added required questions before (re)submitting** — `submitApplication` re-checks required position questions and calls `syncGlobalAnswersFromProfile` for the global ones (`prisma/actions/applications.ts`).

## Known-open deviations

The policy constrains future transitions only, so nothing here needs a data migration.

| Deviation                                                                                                                                                               | Where                                                                | Owner |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ----- |
| `updatePosition` accepts any status → any status: a manager can unpublish a position with live applications, or "reopen" one past its `closesAt` and get a silent no-op | `prisma/actions/position-actions.ts`                                 | #526  |
| `createPositionSchema` accepts `status: 'closed'`                                                                                                                       | `prisma/actions/position-actions.ts`                                 | #526  |
| No `closesAt` ≥ `opensAt` validation anywhere; pre-existing rows may already violate it, so the error must name both fields                                             | `createPositionSchema`, `updatePositionSchema`, `positionFormSchema` | #527  |
| Reviewer answer rendering resolves `type` from the live question row, so a post-submission type change re-renders a stored answer under a shape it was never saved as   | `applicationAnswersSelect`, `prisma/data/applications.ts`            | #445  |
