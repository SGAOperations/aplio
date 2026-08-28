# User Workflows

The canonical description of what Aplio does, end to end, for each of its four personas. Every user-facing flow has an entry here: where it starts, what happens on the happy path, every failure and edge branch, and where the user lands. It is the spec to check an implementation against — when the code and this document disagree, one of them is a bug, and the entry says which behaviour was intended.

**Scope boundary.** Workflows say _what happens_. Authorization — _who may_ do a thing, and which guard enforces it — lives in **[`docs/PERMISSIONS.md`](PERMISSIONS.md)**, the single source for the capability matrix and the route/action/state tables. Entries here name the denial's user-visible shape, never restate the rule behind it.

**Keep this current.** Any PR that changes a user-facing flow updates the affected entry in the same PR. Copy is quoted verbatim from source so drift is greppable: if a toast string here does not appear in the codebase, one of the two moved without the other.

## How to read an entry

Every workflow has a stable ID — `<persona>-<number>` — and keeps it forever. Entries are **appended, never renumbered**, because reviews and issues cite these IDs. A retired workflow keeps its heading with a `Retired` note rather than freeing the number.

Each entry has the same four parts:

- **Trigger** — the surface and control that starts it.
- **Happy path** — the steps, naming the routes, server actions and data functions involved, ending in the feedback the user gets.
- **Failure / edge** — one bullet per branch: cause → what the user sees → where they stay.
- **End state** — the record state afterwards, and what is now visible or possible.

Behaviour shared by many workflows is stated once under [Cross-cutting behaviours](#cross-cutting-behaviours) and referenced by ID (`XC-1`) rather than repeated.

## Table of contents

**[Cross-cutting behaviours](#cross-cutting-behaviours)** — [XC-1](#xc-1-sign-in-gate-and-the-redirectto-round-trip) · [XC-2](#xc-2-name-gate) · [XC-3](#xc-3-profile-completeness) · [XC-4](#xc-4-denial-shape) · [XC-5](#xc-5-errors-and-feedback) · [XC-6](#xc-6-rate-limiting) · [XC-7](#xc-7-deactivated-account) · [XC-8](#xc-8-applicant-facing-status-grouping) · [XC-9](#xc-9-applicant-email)

**[Anonymous (AN)](#anonymous-an)** — [AN-1](#an-1-browse-positions) · [AN-2](#an-2-view-a-position) · [AN-3](#an-3-start-applying-from-a-position) · [AN-4](#an-4-sign-in-with-an-email-code) · [AN-5](#an-5-request-a-new-code) · [AN-6](#an-6-set-your-name-on-first-sign-in) · [AN-7](#an-7-read-the-legal-pages) · [AN-8](#an-8-dev-bypass-sign-in)

**[Applicant (AP)](#applicant-ap)** — [AP-1](#ap-1-see-your-dashboard) · [AP-2](#ap-2-answer-profile-questions) · [AP-3](#ap-3-change-your-name) · [AP-4](#ap-4-return-to-an-interrupted-flow) · [AP-5](#ap-5-start-an-application) · [AP-6](#ap-6-answer-application-questions) · [AP-7](#ap-7-customize-or-revert-profile-answers) · [AP-8](#ap-8-upload-or-remove-a-file-answer) · [AP-9](#ap-9-submit-an-application) · [AP-10](#ap-10-track-your-applications) · [AP-11](#ap-11-view-one-of-your-applications) · [AP-12](#ap-12-download-your-own-file-answer) · [AP-13](#ap-13-withdraw-an-application) · [AP-14](#ap-14-edit-and-resubmit-a-withdrawn-application) · [AP-15](#ap-15-delete-a-draft) · [AP-16](#ap-16-sign-out) · [AP-17](#ap-17-see-which-positions-youve-already-applied-to)

**[Position manager (PM)](#position-manager-pm)** — [PM-1](#pm-1-see-your-dashboard) · [PM-2](#pm-2-see-the-positions-you-manage) · [PM-3](#pm-3-create-a-position) · [PM-4](#pm-4-edit-position-details) · [PM-5](#pm-5-manage-position-questions) · [PM-6](#pm-6-add-a-manager) · [PM-7](#pm-7-remove-a-manager) · [PM-8](#pm-8-work-the-application-queue) · [PM-9](#pm-9-open-an-application-for-review) · [PM-10](#pm-10-download-an-applicants-file-answer) · [PM-11](#pm-11-move-one-application-through-the-status-path) · [PM-12](#pm-12-move-several-applications-at-once) · [PM-13](#pm-13-reorder-position-questions) · [PM-14](#pm-14-override-a-status-undo-or-review-its-history)

**[Admin (AD)](#admin-ad)** — [AD-1](#ad-1-see-every-position) · [AD-2](#ad-2-edit-an-archived-position) · [AD-3](#ad-3-delete-a-position) · [AD-4](#ad-4-create-a-global-question) · [AD-5](#ad-5-edit-a-global-question) · [AD-6](#ad-6-delete-a-global-question) · [AD-7](#ad-7-create-a-user) · [AD-8](#ad-8-grant-or-revoke-admin) · [AD-9](#ad-9-deactivate-a-user) · [AD-10](#ad-10-find-a-user) · [AD-11](#ad-11-reorder-global-questions)

---

## Cross-cutting behaviours

### XC-1 Sign-in gate and the `redirectTo` round-trip

`getCurrentUser()` (`lib/auth/server.ts`) resolves the caller or redirects. An anonymous caller goes to `/login?redirectTo=<the path they asked for>`; the path comes from the `x-current-path` header that `proxy.ts` sets on every matched request, and is built by `withRedirectTo`. `sanitizeRedirectTo` accepts only a single-leading-slash in-app path, rejects `..` traversal and any `/login*` self-reference, and strips Next's internal `_rsc` / `_next*` params; anything else falls back to `/`. After sign-in, `/login` sends the user to that destination.

When `isBypassAllowed()` is true (dev only) the base is `/login/bypass` instead of `/login`.

### XC-2 Name gate

A user with no `name` cannot use the app: `requireName(user)` redirects to `/login?redirectTo=<current path>`, where `/login` renders the name form instead of the email step. It is applied by `app/(main)/(auth)/layout.tsx` for everything under that group, and called directly by the pages that sit outside it — `/` , `/positions`, `/positions/[id]`, `/profile`. Public pages guard with `if (user) await requireName(user)` so anonymous visitors are unaffected.

### XC-3 Profile completeness

Profile completeness is surfaced **in place, never as a redirect** — no layout or page redirects an incomplete profile to `/profile`; `app/(main)/(auth)/layout.tsx` does `getCurrentUser()` + `requireName()` only. Completeness itself is computed by `prisma/data/profile.ts` and surfaced on three fronts:

- **Dashboard banner** — `ProfileCompletenessBanner`, mounted only by `UserDashboard`: "Complete your profile" · "You have N required question(s) left to answer." (singular at 1) · **Complete profile** → `/profile`. Renders `null` once complete. Managers and admins get `ManagerDashboard`/`AdminDashboard`, so they never see it ([AP-1](#ap-1-see-your-dashboard)).
- **Apply-page card** — `/positions/[id]/apply` blocks _starting_ a new application while a required global question is unanswered: "Complete your profile first" with **Go to Profile** → `/profile?redirectTo=/positions/[id]/apply`. This is the only hard block, and it applies to **everyone including managers and admins**. An application that already exists bypasses it entirely — the stepper owns its own missing-required flow ([AP-6](#ap-6-answer-application-questions), [AP-7](#ap-7-customize-or-revert-profile-answers)).
- **Return bar** — `/profile` renders `ProfileReturnBar` only when it arrives with a sanitized `redirectTo`; the apply-page card is the only surface that produces one ([AP-4](#ap-4-return-to-an-interrupted-flow)).

Zero non-deleted required global questions ⇒ complete by definition (`requiredCount === 0`; the apply page's `profileData.length === 0`), and none of this is a denial ([XC-4](#xc-4-denial-shape)) — every route stays reachable with an empty profile.

### XC-4 Denial shape

- **Pages** call `notFound()` — an authenticated-but-not-permitted page renders exactly the same 404 as a missing one, so nothing leaks existence. Rendered by `app/(main)/not-found.tsx` → `NotFoundFallback`.
- **Server actions** throw. A denial is never user-facing copy, so it surfaces as the generic toast from the caller's `catch`, never as its thrown message.
- **Resource-state bounces are `redirect()`, not denial** — e.g. the apply page sending a caller to `/positions` when the position is soft-deleted or still a draft.

### XC-5 Errors and feedback

One global error boundary — `app/global-error.tsx` for the root shell plus a single `app/(main)/error.tsx`, both rendering `ErrorFallback` with a **Try again** button. There is no per-page `error.tsx`.

Every action gives a `sonner` toast: a success toast, the returned `{ error }` verbatim for an expected failure, and a generic **"Something went wrong. Please try again."** (a few older call sites use the shorter **"Something went wrong"**) when the action throws during an interaction. Expected errors are toasts and never reach the boundary.

### XC-6 Rate limiting

`proxy.ts` applies `applyRateLimit` outside development: 60 requests/min for `/` and `/login`, 20/min for `/api/*`, 120/min for everything else, bucketed per client IP per worker instance. Prefetch requests are excluded from the matcher so speculative `Link` prefetches don't burn budget. On exhaustion a document navigation gets a 307 to `/429` ("Too many requests" · "You've made a lot of requests in a short time. Wait about a minute, then try again."); anything else gets a JSON `{ error: 'Too many requests' }` with `Retry-After`. `/429` is excluded from the matcher so it stays reachable. The limiter fails open if it throws.

### XC-7 Deactivated account

A live session whose `User` row has been soft-deleted resolves as `deactivated`, not anonymous. `getCurrentUser()` redirects it to `/login/deactivated` — "Account deactivated", the signed-in email, a sign-out button (`signOutDeactivatedSession`) and a link to `/positions`. Sign-in is refused before the code is sent ([AN-4](#an-4-sign-in-with-an-email-code)) with `ACCOUNT_DEACTIVATED_MESSAGE`: **"Your account has been deactivated. Please contact an administrator."**

### XC-8 Applicant-facing status grouping

`applied`, `reached_out`, `interview_scheduled` and `reviewing` are one group for the applicant: for the entire time an application sits anywhere in that group, every applicant-facing surface shows only **Applied** — `PUBLIC_APPLICATION_STATUS` (`lib/constants.ts`) collapses the three in-review statuses to `applied`; `draft`, `accepted`, `rejected` and `withdrawn` map to themselves. This is enforced in the data layer, not at render — every applicant-scoped query in `prisma/data/applications.ts` (`getMyApplications`, `getMyApplication`, `getApplicationForApply`, the dashboard widget and activity-feed queries) returns the public value, and the applicant-facing payload types (`MyApplicationListItem`, `MyApplicationDetail`, `MyPositionApplication`, `DraftApplication`) type `status` as `PublicApplicationStatus`, so the internal value can't reach an applicant's RSC payload even by mistake. The same surfaces hide in-group timestamps: the applicant list item carries `lastSavedAt` (the draft's own `updatedAt`, null once submitted) instead of `updatedAt`, and every applicant query orders on `submittedAt` — a label that never moves while a visible "last updated" kept changing would leak exactly what the grouping hides. Reviewer surfaces are unaffected — [PM-9](#pm-9-open-an-application-for-review)'s "Other applications" section, for one, always shows the precise status. Withdraw eligibility is also unaffected — the whole group stays withdrawable ([AP-13](#ap-13-withdraw-an-application)).

### XC-9 Applicant email

Three applicant-facing emails, all through `lib/email/application-emails.ts` — the only place that swallows a send failure, since the write it follows has already committed.

- **Submission receipt** (`application_received`) — sent immediately from `submitApplication`, on first submission **and** on a `withdrawn → applied` resubmission ([AP-9](#ap-9-submit-an-application), [AP-14](#ap-14-edit-and-resubmit-a-withdrawn-application)).
- **Decision, single** (`application_accepted` / `application_rejected`) — from `updateApplicationStatus`, which covers the header's quick actions, the override Select, and Undo alike ([PM-11](#pm-11-move-one-application-through-the-status-graph), [PM-14](#pm-14-override-a-status-undo-or-review-its-history)). The send is **scheduled** `DECISION_EMAIL_DELAY_MINUTES` (15) minutes out via Resend's `scheduledAt`; the `EmailLog` row logs `scheduled` with the provider id. Any further status change to that application inside the window — a second override, a move-back, or Undo — cancels the pending send and marks the row `cancelled`; a cancel that fails (already dispatched) is logged with `error` and the row is left `scheduled`, since the mail almost certainly already went out. A decision re-applied after a cancel schedules a fresh send.
- **Decision, bulk** (`updateApplicationStatuses`) — sent **immediately** through Resend's batch endpoint, chunked at `RESEND_BATCH_MAX_EMAILS` (100) with permissive validation so one bad address can't sink the rest; each row logs `sent` with its own provider id. There is **no window** — bulk eligibility isn't forward-only, so a bulk move can land on a row that still holds a pending single-decision send; `dispatchBulkDecisionEmails` cancels it first, same as the single path. Available to every reviewer who can bulk-change status at all — there is no email-specific permission gate, so a manager's bulk accept/reject emails exactly as an admin's does ([PM-12](#pm-12-move-several-applications-at-once)).
- **No email at all** on any in-group move (`reached_out` / `interview_scheduled` / `reviewing`) or on withdrawal — only a decision or a submission ever emails the applicant.
- **A failed send never fails the mutation.** The status write (or the submission) has already committed by the time the email is attempted; the send is a side effect dispatched in `after()`, and a provider failure is logged to `EmailLog` as `failed` and surfaced nowhere — not to the reviewer, not to the applicant.
- **No opt-out, no preferences, no per-position copy.**

---

## Anonymous (AN)

Anyone not signed in. The only routes they can use are `/positions`, `/positions/[id]` (published positions only), `/login`, `/privacy` and `/terms`; the sidebar shows Positions and a **Sign in** button.

### AN-1 Browse positions

- **Trigger** — the logo, the Positions nav item, or a direct visit to `/positions`.
- **Happy path** — `getOpenPositions()` and `getRecentlyClosedPositions()` run in parallel. The page renders an **Open Positions** section (always rendered, including positions the viewer manages — nothing is filtered out) and a **Recently Closed** section (omitted when empty; positions closed within `RECENTLY_CLOSED_WINDOW_DAYS` = 7). Every viewer — anonymous, applicant, manager or admin — sees the identical browse list; the manage workbench lives at its own route ([PM-2](#pm-2-see-the-positions-you-manage)). A signed-in viewer's own applications also mark the relevant cards ([AP-17](#ap-17-see-which-positions-youve-already-applied-to)). Each `PositionCard` links to the detail page.
- **Failure / edge**
  - No open positions → `EmptyState` "No open positions" · "Check back later for open positions."; the page still renders.
  - Draft positions never appear — `PUBLISHED_POSITION_WHERE` excludes them.
  - Slow fetch → `positions/loading.tsx`.
- **End state** — read-only. Nothing is written.

### AN-2 View a position

- **Trigger** — a position card on `/positions`, or a direct link to `/positions/[id]`.
- **Happy path** — `getPositionDetail(id)`, then `getOptionalManagerAccess(position.managers)` — which never forces auth, so an anonymous visitor and a signed-in non-manager get identical output. Renders the title, availability badge, the application window date, markdown description, the list of application question labels, and the primary CTA ([AN-3](#an-3-start-applying-from-a-position)). The back link is viewer-dependent: "&larr; Back to Manage Positions" → `/manage/positions` when the viewer can manage this position, otherwise "&larr; Back to positions" → `/positions`.
- **Failure / edge**
  - Position missing or soft-deleted → `notFound()`.
  - Position is a `draft` and the viewer cannot manage it → `notFound()`, identical to missing ([XC-4](#xc-4-denial-shape)).
  - No description → "No description yet."
  - Window not open yet → the date under the title reads **Opens <date>**; already closed → **Closed <date>**. No Apply button in either case.
  - A `draft` visible to its managers shows its planned window in future tense — **Opens <date>** or **Closes <date>**, never "Closed" — since a draft's dates are a plan, not a deadline. Once that date has passed, the line reads **Was scheduled to open <date>** or **Was scheduled to close <date>** in the warning treatment instead, and the draft callout below gains a line naming the missed date.
- **End state** — read-only.

### AN-3 Start applying from a position

- **Trigger** — the **Apply** button on `/positions/[id]`, shown only while the position is accepting applications.
- **Happy path** — anonymous visitors get a link to `/login?redirectTo=/positions/[id]/apply`. `/login` detects the apply destination and swaps its copy to "Continue Your Application" · "Enter your email to continue your application. We'll send you a one-time code." After sign-in ([AN-4](#an-4-sign-in-with-an-email-code)) and the name step ([AN-6](#an-6-set-your-name-on-first-sign-in)) the user lands on the apply page ([AP-5](#ap-5-start-an-application)).
- **Failure / edge**
  - Already signed in → the button links straight to `/positions/[id]/apply`; the label is **Apply now**.
  - Position not accepting → no button at all; the close/open date is shown instead.
- **End state** — no record written; the user is one sign-in away from a draft.

### AN-4 Sign in with an email code

- **Trigger** — the email step on `/login`, any redirect from [XC-1](#xc-1-sign-in-gate-and-the-redirectto-round-trip), or the sign-in link/button in the OTP email (`/login?email=<address>&otp=<code>`).
- **Happy path** — the email is validated against `signInEmailSchema`; `checkSignInAllowed` rejects deactivated accounts before any mail is sent; `isOtpResendAllowed` enforces the server-side cooldown; then `authClient.emailOtp.sendVerificationOtp`. Toast **"Code sent."** and the view switches to the 6-digit `InputOTP` step ("Check your inbox for a one-time code. Delivery can take up to 5 minutes."). The code auto-submits at 6 digits via `authClient.signIn.emailOtp`, then `router.refresh()` hands the destination decision back to `/login`.
- **Happy path — email link** — `/login` parses `email`/`otp` via `parseOtpLinkParams`; `LoginView` shows a "Signing you in…" panel, strips both params from the URL (`history.replaceState`) before calling `authClient.signIn.emailOtp` client-side with them, then `router.refresh()` — the same code path a typed code takes, so the rate limit, the 600s expiry and the 3-attempt cap all apply unchanged. Works on a device that never saw the email step, since the link carries the email itself. `redirectTo` is deliberately not carried in the link.
- **Failure / edge**
  - Invalid email → inline field error "Please enter a valid email address"; nothing is sent.
  - Deactivated account → toast with `ACCOUNT_DEACTIVATED_MESSAGE`; stays on the email step ([XC-7](#xc-7-deactivated-account)).
  - `checkSignInAllowed` throws → toast **"Couldn't send the code. Please try again."**; stays on the email step.
  - Send fails or is rate-limited → the mapped message from `getOtpSendErrorMessage`; stays on the email step.
  - Wrong or expired code → inline error under the OTP field from `getOtpVerifyErrorMessage`; the account-deactivated error code maps to `ACCOUNT_DEACTIVATED_MESSAGE` instead. Fewer than 6 digits → "Please enter the 6-digit code".
  - **Use a different email** returns to the email step and clears the code.
  - Invalid or expired code from the link → falls through to the ordinary OTP step with the email pre-captured and the inline error already set; **Send a new code** and **Use a different email** are both available.
  - Malformed or partial link params (bad email, non-6-digit otp, missing param) → the ordinary email step, with the address prefilled if it was valid.
- **End state** — a session exists. A user row is created on first sign-in if the email was not already invited ([AD-7](#ad-7-create-a-user)). The user goes to the name form if they have no name, otherwise to the sanitized `redirectTo`.

### AN-5 Request a new code

- **Trigger** — **Send a new code** on the OTP step.
- **Happy path** — same `sendCode` path as [AN-4](#an-4-sign-in-with-an-email-code); the code field resets and toast **"New code sent."**
- **Failure / edge**
  - Within the cooldown → the button is disabled and counts down (`Send a new code (2:53)`); `OTP_RESEND_COOLDOWN_SECONDS` is 180. The countdown is display only — `isOtpResendAllowed` reads the stored OTP's `createdAt` server-side, so a tampered or skewed client timer still gets the 429 message.
  - Send fails → error toast; the previous code remains valid until it expires.
- **End state** — a fresh OTP; the cooldown restarts.

### AN-6 Set your name on first sign-in

- **Trigger** — landing on `/login` with a session but no name, either straight after [AN-4](#an-4-sign-in-with-an-email-code) or via [XC-2](#xc-2-name-gate).
- **Happy path** — `NameField` posts to `setUserName`, which validates with the shared `nameSchema` (trimmed, 1–`NAME_MAX_LENGTH` = 100 chars) and writes scoped to the calling user. Toast **"Name saved"**, then on to the sanitized `redirectTo`.
- **Failure / edge**
  - Empty or whitespace-only → **"Enter your full name."** (the same string is both the zod message and the action's returned error).
  - Over 100 characters → "Name must be 100 characters or fewer."
  - The user navigates elsewhere without saving → every gated route bounces back here ([XC-2](#xc-2-name-gate)).
- **End state** — `User.name` set; the layout and sidebar re-render with it immediately (`revalidatePath('/', 'layout')`). The name is later snapshotted onto the application at submit ([AP-9](#ap-9-submit-an-application)).

### AN-7 Read the legal pages

- **Trigger** — the Privacy Policy / Terms of Service links in the footer and under the `/login` form.
- **Happy path** — `/privacy` and `/terms` render static content in `app/(legal)/layout.tsx` — no auth gate, no app chrome.
- **Failure / edge** — none; both are public and static.
- **End state** — read-only.

### AN-8 Dev bypass sign-in

- **Trigger** — `/login/bypass`, or the "switch user via bypass login" link shown under the `/login` form when `isBypassAllowed()`.
- **Happy path** — three buttons (Admin, Applicant, Position Manager) each submit `loginAsBypassUser` (`prisma/services/dev-bypass.ts`), which sets the `dev-bypass-user-id` cookie that `resolveUser` checks ahead of the real session, then lands on the sanitized `redirectTo`.
- **Failure / edge**
  - `isBypassAllowed()` false → `notFound()`. This is the env gate that keeps the route impossible in production.
  - "Sign in with real auth" returns to `/login` carrying the same `redirectTo`.
- **End state** — a bypass session indistinguishable from a real one to the rest of the app; a deactivated bypass row still routes to `/login/deactivated` ([XC-7](#xc-7-deactivated-account)).

### Known open

- `/positions` has no search, filter or sort — it renders every open position as a flat card list, so it degrades as the catalogue grows. `/manage/applications` has the only filtering UI in the app.

---

## Applicant (AP)

Any signed-in user. Every user is an applicant; manager and admin capabilities are additive, so managers and admins run these workflows too.

### AP-1 See your dashboard

- **Trigger** — signing in, the logo, or the Home nav item (`/`).
- **Happy path** — `UserDashboard` renders "Welcome back, <first name>" and streams five independently-suspended sections: the profile-completeness banner, an application summary, the three most recent applications, three open positions, and an activity feed. Each has its own skeleton.
- **Failure / edge**
  - Anonymous → `redirect('/positions')` — routing, not denial.
  - No name → [XC-2](#xc-2-name-gate).
  - Admin → `AdminDashboard`; manager → `ManagerDashboard` ([PM-1](#pm-1-see-your-dashboard)).
  - Nothing applied for yet → the widgets render their own empty states; the heading falls back to "Welcome to Aplio" when the name is missing.
- **End state** — read-only.

### AP-2 Answer profile questions

- **Trigger** — the Profile item in the user menu, the completeness banner, or the apply page's **Go to Profile** button.
- **Happy path** — `getProfileData(user.id)` returns every non-deleted global question with the caller's answer. Each field autosaves on blur through `updateGlobalAnswer`, which validates format and option membership and upserts scoped to the caller. Answers are shared across every application: "Your answers are shared across every application."
- **Failure / edge**
  - Format mismatch on a `short_answer` with a `format` → the format's message from `SHORT_ANSWER_FORMAT_ERROR_MESSAGES`, inline; the autosave is skipped so the error isn't also toasted.
  - Option not in the question's list, too many values, or over the length limit → the message from `getAnswerValueError`.
  - Unexpected throw → toast **"Failed to save answer"**; the field keeps its unsaved value so a retry works.
  - `file_upload` questions do not go through this action — see [AP-8](#ap-8-upload-or-remove-a-file-answer).
  - A question deleted between render and save → the action throws (not user-actionable) → generic toast.
- **End state** — `GlobalAnswer` rows upserted. These are copied into a new application's answers at creation ([AP-5](#ap-5-start-an-application)) and, for any question still missing a snapshot row, resolved and materialized at submit ([AP-9](#ap-9-submit-an-application)).

### AP-3 Change your name

- **Trigger** — **Edit name** in the user menu.
- **Happy path** — `EditNameDialog` → `setUserName` with the same `nameSchema` as [AN-6](#an-6-set-your-name-on-first-sign-in). Toast **"Name updated."**, dialog closes, nav re-renders.
- **Failure / edge**
  - Invalid name → the zod message inline, dialog stays open.
  - Action throws → **"Something went wrong. Please try again."** from `FormDialog`.
  - Already-submitted applications keep the name they snapshotted; reviewers see the old name with the new one in parentheses (`getRenamedTo`).
- **End state** — `User.name` updated; past submissions unchanged.

### AP-4 Return to an interrupted flow

- **Trigger** — arriving at `/profile?redirectTo=<path>` from the "Complete your profile first" card on `/positions/[id]/apply` ([AP-5](#ap-5-start-an-application)); the round trip is the shared behaviour described in [XC-3](#xc-3-profile-completeness).
- **Happy path** — a sticky `ProfileReturnBar` shows "Profile complete" once every required question is answered, with a **Continue** button back to the destination.
- **Failure / edge**
  - Still incomplete → the status reads "N required questions left" (singular "question" at 1) and **Continue** is `aria-disabled` and non-interactive, described by that status.
  - No `redirectTo`, or an unsanitary one → the bar is not rendered at all.
- **End state** — the user resumes the flow they were pulled out of, with a complete profile.

### AP-5 Start an application

- **Trigger** — **Apply now** on `/positions/[id]`, or **Continue** on a draft row in `/my-applications`; both land on `/positions/[id]/apply`.
- **Happy path** — the page loads the position, the caller's profile data and any existing application in parallel. With no application yet it renders `StartApplicationCard`; its button calls `createDraftApplication`, which re-checks the window server-side and creates the `Application` at status `draft`, copying the caller's current `GlobalAnswer` values into `GlobalApplicationAnswer` rows in the same transaction. Toast **"Application started"** and the page re-renders as the stepper ([AP-6](#ap-6-answer-application-questions)).
- **Failure / edge**
  - Position soft-deleted or still a draft → `redirect('/positions')` before anything renders — resource state, not denial.
  - Position no longer accepting → the "Applications are closed" card ("This position is no longer accepting applications."), with **Browse positions** and **Back to position**.
  - Required profile questions unanswered → the "Complete your profile first" card with a **Go to Profile** button. This is the path for every caller, including managers and admins, and it gates only the _first_ application — a draft or withdrawn application already in hand bypasses it entirely.
  - An application already exists and is not `draft`/`withdrawn` → the "You've already applied" card with the status badge, the submitted date, and links to **View my applications**, **View my answers** and **Back to position**. The badge and every status name on this card are the public status ([XC-8](#xc-8-applicant-facing-status-grouping)) — `reached_out`/`interview_scheduled`/`reviewing` all read as **Applied**, with copy "To change your answers, withdraw this application from My Applications, then edit and resubmit it."; once decided it reads "This application has been Accepted/Rejected and can no longer be edited."
  - A deleted draft for this position exists → treated as no application: the entry card renders with the revival copy "You deleted a draft for this position. Starting again brings your saved answers back — you can change them before you submit."; **Start application** calls `createDraftApplication`, which clears `deletedAt`/`deletedById` on the same row instead of creating a new one. Toast **"Your saved answers are back"**.
  - Window closed between the page render and the click → `{ error: 'This position is no longer accepting applications.' }` → error toast.
  - Position soft-deleted between render and click → **"This position is no longer available."**
  - Two tabs racing the create → the loser gets **"You already have an application for this position."** and both paths revalidate, so the losing tab refreshes onto the stepper rather than sticking on the entry card.
  - Two tabs, one deleting the draft while the other clicks Start on the entry card → the second tab succeeds and revives the row (no error) — reviving is the intended outcome, not a race to guard against.
  - An existing draft short-circuits the window check — a draft that already exists survives a closed window, and submit is what blocks ([AP-9](#ap-9-submit-an-application)).
- **End state** — one `Application` at `draft` with the profile answers pre-filled, unique per (user, position). Deleting and re-applying reuses this same row rather than creating a second one.

### AP-6 Answer application questions

- **Trigger** — the stepper on `/positions/[id]/apply` for a `draft` or `withdrawn` application.
- **Happy path** — step 1 holds the global (profile) questions, step 2 the position questions; the stepper collapses to one step when the position has no questions of its own. Each field autosaves on blur via `createOrUpdateApplicationAnswer`, which re-reads the question's label and shape from the database (never from the client) and upserts the answer with that label snapshotted onto the row.
- **Failure / edge**
  - Format mismatch, bad option, too many values, or over-length → the specific message inline and as a toast; the value is not persisted.
  - Application no longer applicant-editable → **"This application has already been submitted. Withdraw it to make changes."**
  - A stale tab autosaves into a draft deleted in another tab → **"You deleted this draft. Refresh the page to apply again with your answers."**
  - The question id matches neither a global question nor one of this position's questions → the action throws (IDOR-shaped) → generic toast.
  - **Next** with an unanswered required global question → the fields are highlighted, the stepper jumps back to step 1, and the root error reads "Answer the highlighted required questions before continuing."
  - A required global question added after the draft was created is still unanswered once resolved against the profile ([AP-7](#ap-7-customize-or-revert-profile-answers)); the stepper opens in customize mode so it can be answered before proceeding.
- **End state** — `GlobalApplicationAnswer` / `PositionApplicationAnswer` rows for this application, each carrying its own `questionLabel`/`questionType` snapshot so a later question edit can't rewrite what a reviewer sees.

### AP-7 Customize or revert profile answers

- **Trigger** — the customize toggle above the profile questions in the stepper, which auto-opens with the "New required profile questions were added…" callout when a required global question resolves (via `resolveGlobalAnswerValues`, `lib/utils.ts`) to no answer at all — neither an application row nor a profile value. A required question the applicant already answered on their profile does not trigger it, even with no application row yet. The toggle is always the outline button — it is never the step's filled primary, which stays reserved for Next/Submit.
- **Happy path** — toggling on unlocks the profile answers for this application only. Toggling off (**Revert to profile answers**) compares each field to its profile value (`findDivergingGlobalAnswers`, `lib/utils.ts`, order- and whitespace-sensitive); with at least one differing answer, a confirmation dialog names the count ("N customized answers will be replaced with your profile answers. This can't be undone.") before anything is written. Confirming writes each changed field back to the profile value via `createOrUpdateApplicationAnswer`, waiting on any in-flight autosave first so the revert lands last. Toast **"Reverted to profile answers"**.
- **Failure / edge**
  - No fields differ from the profile → no dialog; reverting is a no-op with the same **"Reverted to profile answers"** toast.
  - Cancelling the dialog writes nothing and leaves customize mode on.
  - Any single field's revert returns `{ error }` → that message is toasted verbatim and the field keeps its last saved value; the others still revert.
  - The batch throws → **"Failed to revert some answers"**.
- **End state** — this application's answers match the profile again. `/profile` is untouched either way — customizing never writes back to the profile.

### AP-8 Upload or remove a file answer

- **Trigger** — a `file_upload` question's file input, on `/profile` or in the stepper.
- **Happy path** — client-side checks run first, then `uploadQuestionFileAnswer` re-validates size and type, **sniffs the real MIME type from the first 8 bytes** (the browser-supplied type is spoofable and is not trusted), stores the blob privately with a random suffix, and upserts the answer inside a transaction. Toast **"File uploaded"**. **Remove** calls `removeQuestionFileAnswer` → toast **"File removed"**. Either way the previous blob is reference-counted and deleted only when no answer row still points at it.
- **Failure / edge**
  - Not PDF/PNG/JPG, or the sniffed type disagrees with the extension → **"Only PDF, PNG and JPG files are allowed."**
  - Over `FILE_UPLOAD_MAX_BYTES` (4 MB) → **"File must be 4MB or smaller."**; empty file → **"Select a file to upload."** The helper text reads "PDF, PNG or JPG · up to 4MB".
  - The application left an applicant-editable status in another tab, or was decided → **"This application has already been submitted. Withdraw it to make changes."** and the freshly uploaded blob is deleted rather than orphaned.
  - Ownership miss on the application, or a question that isn't a `file_upload` on this position → the action throws → generic toast.
  - Blob storage failure → throws → generic toast; nothing is written.
- **End state** — the answer's `value` holds exactly one blob URL (or none after a remove). Orphaned blobs are swept by `cleanupOrphanedBlob`, which is best-effort and never surfaces an error.

### AP-9 Submit an application

- **Trigger** — **Submit** at the end of the stepper on `/positions/[id]/apply`.
- **Happy path** — the client validates the position fields and re-checks required globals, then waits for every pending autosave so the server reads a complete snapshot. `submitApplication` runs one transaction, read → validate → write: it re-checks ownership, status, soft-deletion and the application window, resolves every global question's value via `resolveGlobalAnswerValues` (an application row wins even when empty; no row falls back to the profile), verifies every required question with no write yet, then — only once validation passes — materializes a snapshot row for each question still missing one with a non-empty resolved value, and flips the status to `applied` with `submittedAt` and an `applicantName` snapshot. Toast **"Application submitted"**, a reduced-motion-aware confetti burst fires alongside it, and the browser replaces the URL with `/my-applications/[id]`.
- **Failure / edge**
  - Not applicant-editable (checked first, ahead of the window and answer checks) → **"This application has already been submitted. Withdraw it to make changes."**
  - Deleted in another tab since the draft was opened → **"You deleted this draft. Refresh the page to apply again with your answers."**
  - Position soft-deleted since the draft was created → **"This position is no longer available."**
  - Window closed while the draft sat open → **"This position is no longer accepting applications."**
  - Required **profile** questions still unanswered after resolution → "Answer these required profile questions before submitting: <labels>." — up to three labels, then "and N more". Nothing is written when this fires — validation reads only.
  - Required **position** questions unanswered → **"Please answer all required questions before submitting."**
  - A second tab submitting concurrently → the status-scoped `updateMany` matches nothing → **"This application has already been submitted. Refresh to see its current status."**
  - Any of these also sets the stepper's root error, so the message is visible after the toast dismisses. An unexpected throw → **"Something went wrong. Please try again."**
- **End state** — status `applied`, `submittedAt` set, `applicantName` frozen at the name in force at that moment. The application leaves the draft list, enters the reviewer queue ([PM-8](#pm-8-work-the-application-queue)), and is now read-only to the applicant until withdrawn. A submission receipt emails immediately ([XC-9](#xc-9-applicant-email)).

### AP-10 Track your applications

- **Trigger** — the My Applications nav item (`/my-applications`).
- **Happy path** — `getMyApplications(user.id)` returns the caller's non-deleted applications on published positions, ordered by `submittedAt` (not `updatedAt` — [XC-8](#xc-8-applicant-facing-status-grouping)). The table sorts client-side by position, status or applied date, and collapses to stacked cards below `md`. Each row links to the detail page and carries its primary action and row action. Every status shown is the public one — `reached_out`/`interview_scheduled`/`reviewing` all read as **Applied**.
- **Failure / edge**
  - Nothing yet → `EmptyState` "No applications yet" · "Browse open positions to start your first application." with a **Browse positions** button.
  - A draft shows "—" for the applied date, **Continue** as its primary action and **Delete** as its row action.
  - A deleted draft is never in this list — deleting one ([AP-15](#ap-15-delete-a-draft)) removes its row entirely; applying to the position again ([AP-5](#ap-5-start-an-application)) is the only way it reappears.
  - A withdrawn row shows **Edit & resubmit**, or the plain text "Position closed" when the window has since closed; it has no row action.
  - `accepted` / `rejected` rows show "—" instead of a withdraw button.
  - Applications on soft-deleted or unpublished positions are excluded entirely.
- **End state** — read-only.

### AP-11 View one of your applications

- **Trigger** — a position title link on `/my-applications`, or the redirect after submitting ([AP-9](#ap-9-submit-an-application)).
- **Happy path** — `getMyApplication(id, user.id)` is scoped to the caller with the same visibility as the list, and returns the public status ([XC-8](#xc-8-applicant-facing-status-grouping)). The header shows the position title with the status badge directly beside it, the status sentence underneath, and the primary/row actions (Continue, Edit & resubmit, Withdraw, Delete draft — whichever applies) right-aligned on that same header row; below it, "Applied <date>" (or "Draft · last saved <date>", from `lastSavedAt` — a draft's own `updatedAt`, never exposed for a submitted application) and a link to the position, then both answer groups — "Your profile answers" and "Your answers for this position" — full width. Answers render by shape (short/single/multiple choice in a label-value row, long answers full-width as prose, files as a Download row) from the snapshotted `questionLabel`/`value`/`type` — never a live question lookup, so a retyped or relabeled question still shows the original label and every stored value.
- **Failure / edge**
  - Not the caller's, soft-deleted, or on an unpublished position → `notFound()`, so a bookmarked URL cannot outlive its list row.
  - Empty profile answers → "No profile answers saved yet."
  - The position answers group is omitted entirely when the position has no live position-specific questions and the application has no position answers; otherwise it shows, with "No position-specific answers." if none were answered.
  - An individual answer with no stored value → "No answer".
- **End state** — read-only. This is the answer of record for what was submitted.

### AP-12 Download your own file answer

- **Trigger** — the **Download** button on a file answer, on `/my-applications/[id]` or `/profile`.
- **Happy path** — `downloadQuestionFileAnswer` authorizes **by row and caller, never by URL**, fetches the private blob and returns it base64-encoded; the client rebuilds a `Blob` and triggers the download. No route handler is involved.
- **Failure / edge**
  - The answer row holds no URL, or the blob is gone → **"This file is no longer available."**
  - The application is neither owned by the caller nor in their reviewer scope → the action throws → toast **"Something went wrong"**.
- **End state** — the file is on the user's device; nothing is written.

### AP-13 Withdraw an application

- **Trigger** — **Withdraw** on a `/my-applications` row, behind a confirmation dialog ("Your application to '<title>' will be removed from review. You can edit and resubmit it later to put it back in the queue.").
- **Happy path** — `withdrawApplication` flips the status to `withdrawn` with one scoped `updateMany`. Toast **"Application withdrawn"**; the dialog closes and the row re-renders.
- **Failure / edge**
  - Already `draft`, already `withdrawn`, or in a terminal decision state (`accepted` / `rejected`) → **"This application can no longer be withdrawn."** The button is not rendered for those statuses, so this is the stale-tab path.
  - Unexpected throw → toast **"Something went wrong"**.
- **End state** — status `withdrawn`, plus a new `ApplicationStatusEvent` recording it. It drops out of the reviewable queue but stays visible to reviewers in the `listable` scope, including later edits ([AP-14](#ap-14-edit-and-resubmit-a-withdrawn-application)). Withdrawing does **not** reset a decision: `accepted` and `rejected` stay excluded from the eligible source statuses — a withdraw/resubmit round-trip must never let an applicant action launder a reviewer's decision. That holds independent of the status history `ApplicationStatusEvent` now keeps ([PM-14](#pm-14-override-a-status-undo-or-review-its-history)); reviewing that history is not itself a way back out of a decision. Withdrawal sends no email ([XC-9](#xc-9-applicant-email)).

### AP-14 Edit and resubmit a withdrawn application

- **Trigger** — **Edit & resubmit** on a withdrawn row in `/my-applications`, which returns to `/positions/[id]/apply`.
- **Happy path** — `withdrawn` is applicant-editable, so the stepper reopens with every answer intact and editable, files included, above an info callout: "This application is withdrawn — It's out of the review queue, but reviewers can still see your answers — including edits you make here. Resubmit to put it back in the queue." Submitting runs [AP-9](#ap-9-submit-an-application) and toasts **"Application resubmitted"**.
- **Failure / edge**
  - The window closed while it was withdrawn → the row shows "Position closed" instead of the button, and the apply page renders "Applications are closed" ("This position stopped accepting applications, so this application can no longer be edited or submitted.").
  - Every [AP-9](#ap-9-submit-an-application) failure branch applies unchanged.
- **End state** — status back to `applied` with a fresh `submittedAt` and a re-snapshotted `applicantName`. A second submission receipt emails, same as the first ([XC-9](#xc-9-applicant-email)).

### AP-15 Delete a draft

- **Trigger** — **Delete** on a draft row in `/my-applications`, behind a confirmation dialog ("Your draft application to '<title>' will be removed from My Applications. If you apply to this position again, your answers come back.").
- **Happy path** — `deleteDraftApplication` sets `deletedAt`/`deletedById` on the `Application` row in one scoped `updateMany`; neither answer table nor any uploaded file is touched. Toast **"Draft deleted"** with description "Apply to this position again to bring your answers back."
- **Failure / edge**
  - Not the caller's, not `draft`, or already deleted → **"This draft can no longer be deleted."**
  - Unexpected throw → toast **"Something went wrong"**.
- **End state** — the application is soft-deleted with every answer intact and disappears from `/my-applications`, every reviewer query, and every count. There is no permanent-delete path and no restore control — applying to the same position again ([AP-5](#ap-5-start-an-application)) is the only way back, and it brings the historical answers with it.

### AP-16 Sign out

- **Trigger** — **Sign out** in the user menu (or on `/login/deactivated`).
- **Happy path** — `signOutUser` ends the Better Auth session and revalidates the layout. Toast **"Signed out."**
- **Failure / edge**
  - Sign-out fails upstream → **"Could not sign out. Please try again."** The upstream cause is logged server-side because the browser cannot see it.
  - A deactivated session uses `signOutDeactivatedSession` instead — `signOutUser` cannot serve it, because its own `getCurrentUser()` call would bounce the caller back to `/login/deactivated`.
  - The action deliberately does not `redirect()`; it is awaited from an event handler, where a redirect would read as a failure.
- **End state** — anonymous. The user keeps browsing `/positions`.

### AP-17 See which positions you've already applied to

- **Trigger** — landing on `/positions` while signed in.
- **Happy path** — `getMyApplicationsByPosition(user.id)` returns the caller's applications keyed by position id; the browse page passes each card its matching entry via `myApplication`. A matched card shows the application's status badge — including `draft` — directly beside the title, left-aligned, while the position's availability badge stays on the right where it always sits; and swaps the applicant CTA: `draft` → **Continue application**, or `withdrawn` while the position still accepts → **Edit & resubmit** — both to the apply stepper; every other status, including a `withdrawn` application on a since-closed position, → **View application** to `/my-applications/[id]`, with no Apply button.
- **Failure / edge**
  - Anonymous viewer → no badge, no CTA change; the ordinary Apply/View Details pair renders.
  - A manager or admin browsing a position they manage still gets their own applicant card and marker here — the manage affordances live on [PM-2](#pm-2-see-the-positions-you-manage) and the detail page instead.
  - The marker lands on the list only — the detail page's Apply CTA stays unconditional; the apply page's existing "You've already applied" card ([AP-5](#ap-5-start-an-application)) remains the guard there.
- **End state** — read-only.

---

## Position manager (PM)

A user who manages at least one non-deleted position. Manager status is **derived**, not stored — there is no role column; `isManager` counts `Position.managers` rows. A manager who manages nothing cannot create their first position; only an admin can bootstrap them ([PM-6](#pm-6-add-a-manager)). Managers run every [Applicant](#applicant-ap) workflow as well; they get no dashboard completeness banner, but the apply-page block applies to them like anyone else ([XC-3](#xc-3-profile-completeness)). The sidebar gains a **Manage** group with **Manage Positions** and Applications; Positions stays under Apply, since a manager browses and applies like any other user ([AN-1](#an-1-browse-positions)).

### PM-1 See your dashboard

- **Trigger** — Home (`/`).
- **Happy path** — `ManagerDashboard` — "Overview of applications for the positions you manage." — streams a pipeline summary, the three most recent applications, three managed positions, an activity feed, and the manager's own applications widget. Every section is scoped to positions they manage.
- **Failure / edge** — as [AP-1](#ap-1-see-your-dashboard); an admin gets `AdminDashboard` instead.
- **End state** — read-only.

### PM-2 See the positions you manage

- **Trigger** — **Manage Positions** under **Manage** (`/manage/positions`).
- **Happy path** — `requireManagerOrAdminOr404()` gates the route. `getManagedPositions(user.id)` plus per-position application stats render as an **Active** section first, then a collapsed **Archived (N)** disclosure for anything `!isPositionActive`. A **New position** action sits in the header, under "Manage Positions" · "Track applications and edit the positions you manage." Positions you manage also keep appearing in the Open Positions list on `/positions` ([AN-1](#an-1-browse-positions)) — the browse page never filters them out.
- **Failure / edge**
  - Not a manager or admin → `notFound()` ([XC-4](#xc-4-denial-shape)); the nav item is not rendered for them either.
  - The active list is empty while some positions are archived → "No active positions" · "Every position you manage is archived — expand Archived below to see them."
  - Managing nothing at all (defensive; `isManager` would already have 404'd) → "No active positions" · "Positions you manage appear here. A closed position drops off once it has been closed for 30 days with no application status changes."
- **End state** — read-only.

### PM-3 Create a position

- **Trigger** — **New position** on `/manage/positions` or the dashboard.
- **Happy path** — `PositionCreateDialog` → `createPosition`, guarded by `requireManagerOrAdmin`. Title is required; description defaults to empty so a draft can be created quickly; `opensAt`/`closesAt` are org-timezone day boundaries (`America/New_York`). The Status options are role-derived (`getStatusOptions`): a manager sees only **Draft** and **Closed**, with a hint below the select explaining that only an admin can open a position; an admin sees all three. The creator is auto-connected as a manager so they can edit it immediately. Toast **"Position created"** and the dialog routes to the new position's edit page.
- **Failure / edge**
  - Missing title → "Title is required" inline.
  - Description over 10 000 characters, or an unparseable date ("Enter a valid date") → inline.
  - Not a manager or admin → the action throws ([XC-4](#xc-4-denial-shape)); the affordance is not rendered in the first place.
  - A manager posting `status: 'open'` anyway (stale tab, hand-made request) → `{ error: POSITION_OPEN_REQUIRES_ADMIN_ERROR }`: **"Only an admin can open a position. Ask an admin to publish it for you."**
- **End state** — a `Position` at the chosen status with the creator as its only manager. A `draft` position is invisible to everyone else ([AN-2](#an-2-view-a-position)).

### PM-4 Edit position details

- **Trigger** — **Edit** on `/positions/[id]`, or a managed position card (`/manage/positions/[id]/edit`, Details tab).
- **Happy path** — the page loads the position, then `requireListedManagerOr404` against the already-loaded managers list. `PositionDetailsForm` submits `updatePosition`, which authenticates, checks existence, checks access, then checks editability. Toast **"Position updated"**; the position, its detail page, the dashboard, `/my-applications` and `/manage/applications` are all revalidated because a status flip changes what every surface shows. The Status select is role-derived, same as [PM-3](#pm-3-create-a-position): a manager on a `draft` or `closed` position sees only **Draft**/**Closed**, with the same hint; on an already-`open` position, **Open** stays selected and offered (dropping it would make the select empty), so a manager may still edit an open position's title, description and dates freely — only the move _to_ open is gated, never editing content once published.
- **Failure / edge**
  - Position missing or soft-deleted → `notFound()`, checked **before** the access guard so both paths 404 identically.
  - Not a listed manager and not an admin → `notFound()`.
  - Archived (closed >30 days with no application status change since) and the caller is not an admin → the form is replaced by `PositionDetailsReadonly` under a warning callout ("This position is archived. It closed more than 30 days ago and no application status has changed since…"), plus a stalled-applications line and a **Review applications** link when the position still holds unresolved applications. A stale tab that posts anyway gets `ARCHIVED_POSITION_EDIT_ERROR`: **"This position is archived. Ask an admin if it still needs changes."** ([AD-2](#ad-2-edit-an-archived-position))
  - A manager posting a transition **to** `open` from `draft` or `closed` (stale tab, hand-made request) → `{ error: POSITION_OPEN_REQUIRES_ADMIN_ERROR }`: **"Only an admin can open a position. Ask an admin to publish it for you."** The form keeps its values so they can pick Draft or Closed and resubmit.
  - Deleted between render and submit → **"This position no longer exists."**
  - Unexpected throw → **"Something went wrong. Please try again."**
  - Status `open` with a `closesAt` already past → below the Status field the form shows a warning callout ("Applicants see this position as Closed…"), naming the passed date and offering both remedies (extend `closesAt`, or set status to Closed); the Status select still shows Open — displaying anything else would misrepresent what's stored.
  - Status `draft` with an `opensAt` or `closesAt` already past → the same spot below the Status field shows a warning callout ("This position was scheduled to open/close…"), naming the passed date and offering both remedies (move that date to the future, or set Status to Open to publish now). Mutually exclusive with the `open`-past-`closesAt` case above (they gate on different statuses), but both render from the same status-notice slot.
- **End state** — the position's details, status and window are updated; only an admin's draft/closed→open flip publishes it, and a stale `open` or `draft` position past its relevant date keeps its warning callout until the date is moved forward or the status is changed.

### PM-5 Manage position questions

- **Trigger** — the Questions tab on `/manage/positions/[id]/edit`.
- **Happy path** — `createPositionQuestion` appends at `max(order) + 1` inside a transaction (so concurrent inserts can't collide on order); `updatePositionQuestion` and `deletePositionQuestion` both scope their write to the `positionId` to prevent cross-position IDOR, and delete is a soft delete. Toasts **"Question added"**, **"Question updated"**, **"Question deleted"**.
- **Failure / edge**
  - Validation — a missing label ("Label is required"), a choice question with no options ("At least one option is required for choice questions"), options or `allowOther` on a non-choice type, more than `QUESTION_MAX_OPTIONS` (50), an option over 200 characters, or a format on a non-`short_answer` type ("Format is only available for short-answer questions") → the first zod issue's message, verbatim.
  - Archived position → `ARCHIVED_POSITION_EDIT_ERROR` from all three actions.
  - No access to the position → the action throws.
  - The question was deleted in another tab → **"This question no longer exists."**
  - Already-submitted applications are unaffected: every answer carries its own `questionLabel` snapshot ([AP-6](#ap-6-answer-application-questions)).
- **End state** — the position's question set changes for **new and in-progress** applications. A new required question blocks submit until answered ([AP-9](#ap-9-submit-an-application)).

### PM-6 Add a manager

- **Trigger** — the Managers tab on `/manage/positions/[id]/edit`.
- **Happy path** — typing searches through `searchUsers` (gated to managers/admins, name or email, case-insensitive, capped at 10 results, and it returns display name + email only — never the user id). Picking a result calls `addPositionManager`, which authenticates, checks the position exists, checks access, resolves the target by email, and connects them. Toast **"Manager added"**; `/positions`, `/manage/positions` and `/users` are revalidated too, since membership drives all three.
- **Failure / edge**
  - Query over 200 characters → **"Search is limited to 200 characters."**; an empty query returns no results without querying.
  - Position deleted since render → **"This position no longer exists."**
  - The picked user was deactivated in the meantime → **"That user is no longer available."** (never a raw Prisma error).
  - Caller lacks access to the position → the action throws.
  - Unexpected throw → **"Something went wrong. Please try again."**
- **End state** — the target manages this position. If it was their first, they become a manager platform-wide: the Manage nav group and position creation unlock for them.

### PM-7 Remove a manager

- **Trigger** — the remove control next to a manager on the Managers tab.
- **Happy path** — `removePositionManager` disconnects them. Toast **"Manager removed"**.
- **Failure / edge**
  - Removing yourself as a non-admin → **"You cannot remove yourself as a manager. Ask an admin to do it."** Admins are exempt.
  - Position deleted since render → **"This position no longer exists."**
  - No access → throws.
- **End state** — the user no longer manages this position. If it was their last, they lose manager status entirely — including the Manage nav and the ability to create positions.

### PM-8 Work the application queue

- **Trigger** — Applications under **Manage** (`/manage/applications`), or the **Applications** button on a managed position, which pre-applies `?positionId=`.
- **Happy path** — `requireManagerOrAdminOr404` gates the role (the `(auth)` layout only gates profile completeness). Query params are parsed with `.catch(undefined)` per field, so one malformed param never sinks the rest. The toolbar offers a position filter ("All positions"), an applicant filter ("All applicants"), a status filter ("All statuses"), a debounced search over "Name, email, position, or date", **Clear filters**, and sortable columns (date, name, status). Results are scoped by `buildApplicationWhere(user, 'reviewable')` — a manager sees only their positions' applications; drafts and withdrawn rows are excluded. The position title in each row links to `/positions/[id]`. The applicant option list (`getReviewableApplicants`) is scoped the same way the results are, so a manager only ever sees applicants who applied to positions they manage. For the four unresolved statuses, each row's `⋯` opens the same `ApplicationStatusMenu` items as the detail page's caret ([PM-11](#pm-11-move-one-application-through-the-status-path)) with the next step as the first item instead of hoisted, ending in **See more** — no separator between the next step and Reject when the next step already is Accept (`reviewing`). `accepted`/`rejected` rows render no action control at all — the row returns `null`, mirroring the non-reviewable early return already in the same component; changing a final decision is detail-page only ([PM-14](#pm-14-override-a-status-undo-or-review-its-history)). Opening the dialog via **See more** calls the read-only `loadApplicationStatusHistory` action since the table has no pre-fetched history per row, showing the dialog's loading skeleton while the fetch is in flight.
- **Failure / edge**
  - Not a manager or admin → `notFound()`.
  - More than 100 matches → the list is truncated to 100 and the toolbar says so; there is no pagination.
  - No matches with filters active → the table's filtered empty state; with none active → the plain empty state.
  - An unparseable filter value is dropped silently rather than erroring.
  - The history fetch fails → the dialog reads "Couldn't load the history. Close this and try again." plus an error toast.
- **End state** — read-only; the filter state lives in the URL and is shareable.

### PM-9 Open an application for review

- **Trigger** — a row on `/manage/applications` (`/manage/applications/[id]`).
- **Happy path** — `getApplicationForReview(id, user)` uses the `listable` scope — withdrawn rows are kept, drafts are not — and `getApplicationStatusHistory(id, user)` fetches alongside it. The page shows a "Back to Applications" link, then a header row with the applicant's snapshotted name and status badge together, their email underneath, and a header action appropriate to status, right-aligned on that same row — a split button for the four unresolved statuses (its caret dropdown ends in **See more**, which opens the status dialog; there is no separate standalone `⋯` alongside it since that would duplicate the caret item), a `⋯` opening the dialog directly for non-reviewable statuses, or a **Change decision** button for terminal decisions; below it, a linked position title and the applied date, then an "Other applications" section (`getApplicantOtherApplications`) followed by the profile and position answer groups full width. The "Other applications" section lists this applicant's other applications platform-wide — including positions the viewer doesn't manage — with precise status, applied date, and the position title linked to `/positions/[id]`; a row links to `/manage/applications/[id]` only when the viewer can actually open it (admin, or a manager of that position) — otherwise the row shows no link at all. Answers render by shape (short/single/multiple choice in a label-value row, long answers full-width as prose, files as a Download row) from the snapshotted `questionLabel`/`value`/`type` — never a live question lookup, so a question retyped or relabeled after submission still shows the original label and every stored value. See `PERMISSIONS.md` → "Cross-scope disclosure" for the authorization rule.
- **Failure / edge**
  - Outside the caller's scope, a draft, or missing → `notFound()`; unauthorized and missing are indistinguishable.
  - The applicant renamed themselves since submitting → the heading reads "<snapshotted name> (<current name>)".
  - Empty profile answers → "No profile answers."
  - The position answers group is omitted entirely when the position has no live position-specific questions and the application has no position answers; otherwise it shows, with "No position-specific answers." if none were answered.
  - An individual answer with no stored value → "No answer".
  - `withdrawn` → the header shows the note "This application was withdrawn by the applicant and can no longer be updated." plus `⋯` (history-only) in place of a move control.
  - `accepted` / `rejected` → the note from `TERMINAL_DECISION_STATUS_NOTES`: "Accepted. The applicant can no longer withdraw this application." (and the `rejected` twin), plus a **Change decision** button — not primary-colored, since the decision is already made. Move-backs from either no longer render inline — they're reachable only through the status dialog's any-status Select ([PM-14](#pm-14-override-a-status-undo-or-review-its-history)).
  - The applicant has no other applications (the common case early on) → "No other applications" / "This is the only position this applicant has applied to recently."
- **End state** — read-only until a transition is made.

### PM-10 Download an applicant's file answer

- **Trigger** — the **Download** button on a file answer on `/manage/applications/[id]`.
- **Happy path** — same action and same by-row authorization as [AP-12](#ap-12-download-your-own-file-answer); a reviewer qualifies through the position-manager branch of the scope rather than ownership.
- **Failure / edge** — as [AP-12](#ap-12-download-your-own-file-answer). An application outside the reviewer's scope throws rather than returning a message.
- **End state** — the file is on the reviewer's device; nothing is written.

### PM-11 Move one application through the status path

- **Trigger** — the split button in the detail page header.
- **Happy path** — `APPLICATION_STATUS_PATH` is the single source of truth for "what's next"; `getNextApplicationStatus(from)` reads it. The main action is always the next path step: `applied` → **Mark reached out**; `reached_out` → **Interview scheduled**; `interview_scheduled` → **Move to reviewing**; `reviewing` → **Accept** (its next step on the path — there's no separate "move forward" for a status already under review). The caret's items come from the shared `ApplicationStatusMenu` component (`getApplicationStatusMenu`, `lib/constants.ts`) with the next step hoisted out, so it starts at the decisions group: Accept and Reject, deduped against whatever's already the main action — `reviewing`'s caret therefore holds only Reject — then a separator and **See more** (opens the dialog, [PM-14](#pm-14-override-a-status-undo-or-review-its-history)). Accept and Reject are offered from every one of the four unresolved statuses, symmetric. Move-backs never appear in this control — the one-click skips the old graph offered (`applied → reviewing`, `reached_out → reviewing`) are gone too; both are reachable only through the status dialog's any-status Select. `updateApplicationStatus` re-reads the row inside a transaction, compare-and-swaps on the exact status just read, and records an `ApplicationStatusEvent` in the same transaction. Toast **"Moved to <label>"**; a move to `accepted` also fires a reduced-motion-aware confetti burst for the acting reviewer only (no notification to the applicant). Accepting or rejecting confirms first: the dialog names the consequence and the email — _"{Name} will be emailed in 15 minutes. Undo before then and nothing is sent."_ ([XC-9](#xc-9-applicant-email)).
- **Failure / edge**
  - The target already matches the current status (a stale render) → **"This application is already <label>."**
  - The status changed since the page rendered → "This application is now <label>, so that move is no longer available. Refresh to see the current options."
  - The status changed between the check and the write → **"This application just changed. Refresh to see its current status."**
  - The application is outside the caller's reviewable scope → the action throws (IDOR-shaped, unreachable from the UI) → generic toast.
  - `draft` and `withdrawn` render the header's note copy plus `⋯` instead of a move control; `accepted`/`rejected` render the terminal-decision note plus a **Change decision** button — neither renders the split button.
- **End state** — the new status, plus one `ApplicationStatusEvent` row recording it; `/manage/applications` and the detail page are revalidated. `accepted`/`rejected` also remove the applicant's ability to withdraw ([AP-13](#ap-13-withdraw-an-application)). A decision email schedules 15 minutes out, cancellable by any further status change to the same application ([XC-9](#xc-9-applicant-email)).

### PM-12 Move several applications at once

- **Trigger** — selecting rows on `/manage/applications`, then a target status in the bulk bar, behind a confirmation.
- **Happy path** — the target Select offers all six reviewer statuses. `updateApplicationStatuses` dedupes the ids, reads each eligible row's current status, then compare-and-swaps every row inside one transaction so the target set cannot drift mid-write, recording one `ApplicationStatusEvent` per row actually moved. Eligibility is any reviewer status but the target itself, excluding `draft`/`withdrawn` — the forward-only restriction is retired, so a backward move or a flip of a final decision both apply in bulk now. Before anything is written, the confirmation states the split computed by `summarizeBulkStatusChange` (`lib/utils.ts`, via `getApplicationStatusRank`): "N will move forward.", "M will move backward.", "K will change a final decision — it's currently Accepted or Rejected.", "J skipped — drafts, withdrawn, or already <Target>.", plus a line about applicant visibility: "Applicants will see this decision on their application." when the target itself is Accepted/Rejected; when the target isn't a decision but the batch reverses one, "Applicants whose decision is reversed will see this change; the rest still show as Applied."; only when the batch has no final-decision rows at all does it read "Applicants won't see this change — every in-review application shows as Applied to them." (`summary.applicantVisible`). When the target is `accepted`/`rejected`, the confirmation additionally carries a prominent callout above that split: _"These N emails send immediately. There is no 15-minute delay and no undo …"_, and the confirm button names the send — "Reject N and email now" / "Accept N and email now" — so the last click is unambiguous, the same warning for every reviewer, manager or admin ([XC-9](#xc-9-applicant-email)). Toast **"Updated N application(s)"**; deliberately no confetti here — bulk moves many rows at once with no single moment to animate ([PM-11](#pm-11-move-one-application-through-the-status-path) has the single-row burst).
- **Failure / edge**
  - Some ids ineligible → **"Updated N of M applications"** with the description "N skipped — drafts, withdrawn, or already <Target>."
  - None eligible → "None of the selected applications can move to <label> — they're already there, or they're drafts or withdrawn."
  - More than 100 ids, or an empty selection → `{ error: 'Invalid input' }`.
  - Unexpected throw → **"Something went wrong. Please try again."**
- **End state** — the eligible rows move — forward, backward, or a flipped decision — each with its own new `ApplicationStatusEvent`; the rest are untouched and counted as skipped. A bulk accept/reject also emails every moved applicant immediately through the batch endpoint — irreversibly, with no undo window ([XC-9](#xc-9-applicant-email)).

### PM-13 Reorder position questions

- **Trigger** — the drag handle on a question card, Questions tab on `/manage/positions/[id]/edit`.
- **Happy path** — the list is wrapped in a shared `SortableProvider` (dnd-kit); dropping a card calls `reorderPositionQuestions` with the full ordered id list, which renumbers every live question `1..N` in one transaction. The new order shows immediately (`useOptimistic`) while the write is in flight. Toast **"Order saved"**.
- **Failure / edge**
  - The id set changed since the page loaded (a question added or deleted in another tab) → **"The question list changed since this page loaded. Refresh and try reordering again."**; the list reverts to the server's order.
  - Archived position → `ARCHIVED_POSITION_EDIT_ERROR`, same gate as [PM-5](#pm-5-manage-position-questions); the read-only view draws no handles at all.
  - No access to the position → the action throws.
  - Unexpected throw → **"Something went wrong. Please try again."**
  - A card in inline-edit mode has no handle and can't be picked up; every other card still reorders around it.
  - Full keyboard support — Space/Enter picks up, arrows move, Space/Enter drops, Escape cancels — each step announced to screen readers ("Picked up …", "… moved to position N of M.").
- **End state** — new and in-progress applications see the new order immediately ([AP-6](#ap-6-answer-application-questions)). Already-submitted applications are unaffected: answers render in the order they were answered, not question order, so a later reorder never re-sequences a reviewer's view of a submitted application.

### PM-14 Override a status, undo, or review its history

- **Trigger** — on the detail page, the split button's caret **See more** item for the four unresolved statuses, the `⋯` button for non-reviewable statuses ("Status history and override for <name>"), or the header's **Change decision** button on a terminal status; on a table row ([PM-8](#pm-8-work-the-application-queue)), only **See more** at the end of the `⋯` menu — a terminal decision has no table-row control at all, so it can't be reached from there.
- **Happy path** — the dialog shows three stacked regions. **Change status** — a `Select` over every reviewer status except the current one, plus **Apply**; this is the only route to any backward move (`reviewing → interview_scheduled`, `accepted`/`rejected → reviewing`, etc.) and to any other off-path target, going through `updateApplicationStatus` with `override: true`, which bypasses `isAllowedApplicationStatusTransition` but still authenticates, scopes to the caller's reviewable positions, and CAS-writes the row plus its event in one transaction. Choosing `accepted`/`rejected` shows the same 15-minute delayed-send warning as the quick actions before Apply ([XC-9](#xc-9-applicant-email)). **Undo last change** — shown only when `getApplicationStatusUndoTarget` resolves a status from the most recent event (hidden with no events, a backfill-only row, or a prior status of `draft`/`withdrawn`); labelled "Undo — back to <status>" and applies the same override path with that status as the target, so it writes its own event rather than deleting the one it reverses. When the current status is `accepted`/`rejected`, a notice beneath the Undo button distinguishes a still-scheduled send ("The acceptance email hasn't been sent yet — undoing this cancels it.") from one already gone ("The acceptance email has already been sent."), read from `EmailLog` rather than the event's timestamp so a bulk-sent row never reads "hasn't been sent yet" ([XC-9](#xc-9-applicant-email)) — shown identically whether the dialog was opened from the detail page or a table row. **History** — every `ApplicationStatusEvent` for the application, newest first, each row showing `<From> → <To>`, the actor's name, and the time; a row with no `from` (the one-time migration backfill) reads "Status recorded as <To> · before history tracking" instead. Opened from the detail page, history arrives pre-fetched; opened from a table row, the dialog opens immediately and shows three skeleton rows in an `aria-busy` region while `loadApplicationStatusHistory` fetches, re-fetching on every open. Accept/Reject picked from the Select or reached via Undo still confirm through the same `ConfirmDialog` as the header's quick actions, and a resulting move to `accepted` fires the same reduced-motion-aware confetti burst as [PM-11](#pm-11-move-one-application-through-the-status-path), for the acting reviewer only, while the dialog is still open.
- **Failure / edge**
  - The target already matches the current status → **"This application is already <label>."**
  - The row changed since the dialog opened → **"This application just changed. Refresh to see its current status."**
  - `draft`/`withdrawn` → the dialog renders **history only**; Change status and Undo are hidden, since the override path is `reviewable`-scoped and would throw for either.
  - No events at all (an application created outside the app's own write paths, e.g. a fixture or seed) → "No status changes recorded yet." instead of an empty list.
  - The table row's history fetch fails → "Couldn't load the history. Close this and try again." plus an error toast.
  - Unexpected throw → generic toast.
- **End state** — the dialog stays open after a successful change so the reviewer watches the new row land in the timeline; the header, `/manage/applications`, and this page are all revalidated.

### Known open

- `/manage/applications` truncates at 100 rows with no pagination or cursor — the toolbar reports the truncation but there is no way to reach row 101 except by filtering.

---

## Admin (AD)

An admin is a **manager on every position**: every [Position manager](#position-manager-pm) workflow applies unchanged, with the scope widened from "positions I manage" to all of them (`buildReviewablePositionWhere`), and draft positions visible everywhere. Admins are exempt from the archived-position edit block ([PM-4](#pm-4-edit-position-details)) and from the self-removal rule ([PM-7](#pm-7-remove-a-manager)). Admins alone may set a position to `open`, from `draft` or `closed` ([PM-3](#pm-3-create-a-position), [PM-4](#pm-4-edit-position-details)) — publishing is a permission, not a workflow: no queue, no approve/reject, no notification back to the manager. This section covers only the admin-exclusive surfaces. The sidebar gains **Users** and **Global Questions** under Manage, alongside the **Manage Positions** and Applications a manager already sees ([PM intro](#position-manager-pm)).

### AD-1 See every position

- **Trigger** — **Manage Positions** under **Manage** (`/manage/positions`).
- **Happy path** — admins get a distinct branch inside the same route: one flat list from `getAdminPositions()` — including drafts — with application stats on every card, under an "All Positions" heading and "Every position, with its application stats." There is no Active/Archived split.
- **Failure / edge**
  - No positions at all → `EmptyState` "No positions yet" · "Create your first position to start accepting applications." with the create action.
  - A draft position's detail page carries the callout "This position is a draft. Only its managers and admins can see this page. Set it to Open in Edit to make it visible to applicants."
- **End state** — read-only.

### AD-2 Edit an archived position

- **Trigger** — `/manage/positions/[id]/edit` for a position closed more than 30 days ago with no application status change since.
- **Happy path** — `checkPositionEditable` returns true for an admin, so the editable form and the question actions render normally where a manager would see the read-only view and the warning callout ([PM-4](#pm-4-edit-position-details), [PM-5](#pm-5-manage-position-questions)).
- **Failure / edge** — as [PM-4](#pm-4-edit-position-details); the archived branch simply does not fire.
- **End state** — as [PM-4](#pm-4-edit-position-details).

### AD-3 Delete a position

- **Trigger** — the Delete position card at the bottom of `/manage/positions/[id]/edit`, rendered only for admins.
- **Happy path** — the card states "Deleting hides this position everywhere — the positions list, search results and any direct link. This can't be undone from the app." The confirmation names the position and, when relevant, adds "N unsubmitted draft applications will disappear too." `deletePosition` soft-deletes with the blocking condition folded into the `where`, so the check and the write are one atomic statement. Toast **"Position deleted"**.
- **Failure / edge**
  - Any non-draft application exists → the button is disabled, and a stale tab that posts anyway gets `POSITION_DELETE_BLOCKED_ERROR`: **"This position has applications, so it can't be deleted. Close it instead."**
  - Already deleted → **"This position no longer exists."**
  - Non-admin → `requireAdmin` throws; the card is not rendered for them at all.
  - Unexpected throw → **"Something went wrong. Please try again."**
- **End state** — `deletedAt` set. The position, its detail page and its applications vanish from every surface — including `/my-applications` for anyone who had a draft on it.

### AD-4 Create a global question

- **Trigger** — **New Question** on `/global-questions` ("Questions every applicant answers once; shared across all applications.").
- **Happy path** — `requireAdmin`, then `createGlobalQuestion` appends at `max(order) + 1` inside a transaction. Toast **"Question created"**; `/global-questions` and `/profile` are both revalidated.
- **Failure / edge**
  - Validation failures return the first zod issue verbatim — same rules as [PM-5](#pm-5-manage-position-questions).
  - Non-admin → the action throws; the page itself is `requireAdminOr404`.
- **End state** — every applicant now sees the question on `/profile`. **In-progress drafts are not stranded:** a required new question with no application row and no profile answer opens the stepper in customize mode with it highlighted ([AP-6](#ap-6-answer-application-questions)), and `submitApplication` resolves it from the profile at submit or blocks with "Answer these required profile questions before submitting: …" ([AP-9](#ap-9-submit-an-application)). Already-submitted applications are untouched.

### AD-5 Edit a global question

- **Trigger** — the edit control on a `/global-questions` row.
- **Happy path** — `updateGlobalQuestion` checks the question still exists, then updates label, type, required, options, `allowOther` and format. Toast **"Question updated"**.
- **Failure / edge**
  - Deleted in another tab → **"This question no longer exists."**
  - Validation → the first zod issue.
  - Existing answers are **not** re-validated against the new shape; each answer keeps the `questionLabel`/`questionType` it snapshotted, so reviewers still see the question as it was asked and rendered under the shape it was saved as, even after a type change.
- **End state** — the question changes for `/profile` and for every in-progress application.

### AD-6 Delete a global question

- **Trigger** — the delete control on a `/global-questions` row.
- **Happy path** — `deleteGlobalQuestion` soft-deletes it. Toast **"Question deleted"**; `/global-questions` and `/profile` revalidate.
- **Failure / edge**
  - Already deleted → **"This question no longer exists."**
  - Unexpected throw → **"Something went wrong. Please try again."**
- **End state** — the question disappears from `/profile` and from every stepper. Existing answer rows survive with their label snapshots, so submitted applications still read correctly.

### AD-7 Create a user

- **Trigger** — **Create user** on `/users` ("Manage platform accounts and admin access.").
- **Happy path** — `createUser` (behind `requireAdmin`) lowercases the email — Better Auth lowercases before its case-sensitive lookup, so a mixed-case invite would miss it and create a second, non-admin row — and inserts the user with the optional name and admin flag. Toast **"User created."**, or **"Admin user created."** when the admin box was checked.
- **Failure / edge**
  - Email already in use → **"A user with this email already exists."** The pre-check is racy; the `P2002` catch is what actually guarantees uniqueness, and it returns the same message.
  - The email belongs to a deactivated account → **"That email belongs to a deactivated account. Reactivating requires a direct database change — contact engineering."** Deactivation intentionally keeps the email so it is not freed for reuse.
  - Invalid email → "Enter a valid email address."
  - Non-admin → throws; the page is `requireAdminOr404`.
- **End state** — a `User` row exists before that person has ever signed in; their first OTP sign-in resolves to this row rather than creating a new one, so the admin flag and name survive.

### AD-8 Grant or revoke admin

- **Trigger** — the admin toggle on a `/users` row, behind a confirmation.
- **Happy path** — `toggleUserAdmin` writes scoped to a non-deactivated user. Toast **"User promoted to admin."** or **"Admin removed."**
- **Failure / edge**
  - Targeting yourself → **"You cannot change your own admin role."** — enforced server-side as well as in the UI.
  - The user was deactivated in the meantime → the action **throws** (not reachable from a freshly-rendered list) → **"Something went wrong. Please try again."**
- **End state** — the target's `isAdmin` flips. Their nav, scope and capabilities change on their next render.

### AD-9 Deactivate a user

- **Trigger** — the deactivate control on a `/users` row, behind a confirmation.
- **Happy path** — `deactivateUser` runs one transaction: soft-delete the user, then **delete** (not expire) every session they hold, so reactivation cannot resurrect a session on a device they no longer control. Toast **"User deactivated."**
- **Failure / edge**
  - Targeting yourself → **"You cannot deactivate your own account."**
  - Already deactivated → the action throws → generic toast.
  - Their email is deliberately left intact, which is why [AD-7](#ad-7-create-a-user) refuses to reuse it.
- **End state** — the user is signed out everywhere. A new sign-in attempt is refused before the code is sent, and any surviving session lands on `/login/deactivated` ([XC-7](#xc-7-deactivated-account)). Their applications remain visible to reviewers.

### AD-10 Find a user

- **Trigger** — `/users`.
- **Happy path** — rows default-sort by role: admins, then managers, then everyone else, alphabetical by name (email fallback) within each group. Roles is a sortable column; clicking it restores this order after another sort has replaced it. **Role** (All/Admin/Manager) and **Managed position** filters compose with the existing search box (name, email, or a managed position's title); the Managed position select is omitted entirely when no user manages anything. The count line shows the filtered total plus admin and manager counts — both always render, including zero — and updates live as filters change. Role is badge semantics: a user who is both admin and manager counts toward, and is matched by, both figures, even though they sort into the admin group. A user who signed in but never set a name (blank, not missing) sorts and searches by email, and their row shows the email alone in the name position — no placeholder caption, and never a blank cell. The desktop row shows a manager's first two positions plus a `+N more` badge for the rest; hovering, focusing, or tapping the badge discloses the hidden titles in a tooltip, and its accessible name already carries them for screen readers even with the tooltip closed. The mobile card has the vertical room to skip the truncation and lists every managed position.
- **Failure / edge**
  - No match → the table's "No users match your filters." row/card; **Clear filters** resets search, role and managed position together.
- **End state** — read-only; promote/deactivate ([AD-8](#ad-8-grant-or-revoke-admin), [AD-9](#ad-9-deactivate-a-user)) work unchanged from either the desktop row or the mobile card.

### AD-11 Reorder global questions

- **Trigger** — the drag handle on a `/global-questions` row (desktop table) or mobile card.
- **Happy path** — `reorderGlobalQuestions` renumbers every live question `1..N` in one transaction; the table holds the list in `useOptimistic` so the drop lands instantly. Dragging is only live while sorted by **Order** ascending — sorting by any other column disables the handles and shows the hint **"Sort by Order to drag questions into a new order."** above the table; clicking the Order header restores it. Toast **"Order saved"**.
- **Failure / edge**
  - The id set changed since the page loaded (a question added or deleted in another tab) → **"The question list changed since this page loaded. Refresh and try reordering again."**; the list reverts to the server's order.
  - Non-admin → the action throws; the page is `requireAdminOr404`.
  - Unexpected throw → **"Something went wrong. Please try again."**
  - Full keyboard support, same as [PM-13](#pm-13-reorder-position-questions).
- **End state** — `/profile` reflects the new order immediately ([AP-2](#ap-2-answer-profile-questions)); a gap left by a soft-deleted question closes on the next reorder.

### Known open

- Reactivating a deactivated account has no UI at all — the copy in [AD-7](#ad-7-create-a-user) points at a direct database change.
- There is no audit trail surface. Rows carry `createdById` / `updatedById` / `deletedById`, but nothing renders them, so "who moved this application to rejected" is not answerable in the app.
