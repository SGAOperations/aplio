import type { PositionStatus, QuestionType } from '@/prisma/client';
import type { $Enums, Prisma } from '@/prisma/client';

import type { REVIEWER_APPLICATION_STATUSES } from '@/lib/constants';

import type { BadgeVariant } from '@/components/ui/badge';

// Matches prisma/data/positions.ts's positionWithQuestionsSelect exactly —
// field-by-field in sync with the schema via Prisma's generated payload type.
export type PositionWithQuestions = Prisma.PositionGetPayload<{
  select: {
    id: true;
    title: true;
    status: true;
    description: true;
    opensAt: true;
    closesAt: true;
    questions: {
      select: {
        id: true;
        label: true;
        type: true;
        required: true;
        options: true;
        allowOther: true;
        order: true;
      };
    };
  };
}>;

export type PositionManager = Prisma.UserGetPayload<{
  select: { id: true; name: true; email: true };
}>;

// Detail view type: full read payload including managers for the access check.
// Manager ids are consumed server-side only; name/email are not needed for the
// draft gate check so we keep the manager shape minimal (§3).
export type PositionDetail = PositionWithQuestions & {
  managers: { id: string }[];
};

// Narrowed question shape — only the fields rendered by the edit page and
// PositionQuestionsSection; audit columns are excluded to avoid leaking them
// across the server/client prop boundary. Matches getPositionForEdit's select.
export type PositionQuestionForEdit = Prisma.PositionQuestionGetPayload<{
  select: {
    id: true;
    positionId: true;
    label: true;
    type: true;
    required: true;
    options: true;
    allowOther: true;
    order: true;
  };
}>;

// Only the six position fields consumed on the edit page; audit columns are
// excluded so they are never serialized across the server/client boundary.
// Matches getPositionForEdit's select exactly.
export type PositionForEdit = Prisma.PositionGetPayload<{
  select: {
    id: true;
    title: true;
    description: true;
    status: true;
    opensAt: true;
    closesAt: true;
    questions: {
      select: {
        id: true;
        positionId: true;
        label: true;
        type: true;
        required: true;
        options: true;
        allowOther: true;
        order: true;
      };
    };
    managers: { select: { id: true; name: true; email: true } };
  };
}>;

// Matches createDraftApplication's query in prisma/actions/applications.ts.
export type DraftApplication = Prisma.ApplicationGetPayload<{
  include: { globalAnswers: true; positionAnswers: true };
}>;

export type GlobalQuestionListItem = Prisma.GlobalQuestionGetPayload<{
  select: {
    id: true;
    order: true;
    label: true;
    type: true;
    required: true;
    options: true;
    allowOther: true;
    createdAt: true;
    updatedAt: true;
  };
}>;

// Shared type for application list rows — reused by the full table and the dashboard widget.
export type MyApplicationListItem = Prisma.ApplicationGetPayload<{
  select: {
    id: true;
    status: true;
    submittedAt: true;
    updatedAt: true;
    positionId: true;
    position: { select: { id: true; title: true } };
  };
}>;

// Shared type for manager-facing position applications table rows.
export type PositionApplicationListItem = Prisma.ApplicationGetPayload<{
  select: {
    id: true;
    status: true;
    submittedAt: true;
    user: { select: { id: true; name: true; email: true } };
  };
}>;

// Admin-only type — exposes applicant identity (name/email) and position.
// Must only be used in admin-gated contexts; never serialize to non-admin clients.
export type AdminApplicationListItem = Prisma.ApplicationGetPayload<{
  select: {
    id: true;
    status: true;
    submittedAt: true;
    position: { select: { id: true; title: true } };
    user: { select: { id: true; name: true; email: true } };
  };
}>;

// Minimal structural type for the position-window helper. Satisfied by
// PositionWithQuestions, PositionForEdit, and raw Prisma rows — no conversion needed.
export type PositionWindow = {
  status: PositionStatus;
  opensAt: Date | null;
  closesAt: Date | null;
};

// Applicant-facing availability states derived from status + date window.
// 'unavailable' covers draft/closed positions (status is the master switch).
export type PositionAvailability =
  | 'accepting'
  | 'upcoming'
  | 'closed_by_date'
  | 'unavailable';

// Admin-only type — open position with filtered non-draft application count.
// Must only be used in admin-gated contexts.
export type OpenPositionSummaryItem = Prisma.PositionGetPayload<{
  select: { id: true; title: true; _count: { select: { applications: true } } };
}>;

// Reviewer-selectable status — everything except 'draft'.
export type ReviewerStatus = (typeof REVIEWER_APPLICATION_STATUSES)[number];

// Sort options for the /applications hub.
export type ApplicationSortField = 'date' | 'name' | 'status';
export type ApplicationSortDirection = 'asc' | 'desc';
export type ApplicationSort = {
  field: ApplicationSortField;
  direction: ApplicationSortDirection;
};

// Filters accepted by the /applications hub — all optional.
// status is constrained to ReviewerStatus so 'draft' is never listed.
export type ApplicationFilters = {
  positionId?: string;
  status?: ReviewerStatus;
  userId?: string;
  q?: string;
  sort?: ApplicationSort;
};

// Row type for the applications hub table — reuses AdminApplicationListItem
// (no audit fields cross the server/client boundary).
export type ApplicationListRow = AdminApplicationListItem;

export type ProfileCompleteness = {
  complete: boolean;
  missingCount: number;
  requiredCount: number;
};

// Answer row shape for the review detail page — same for global and position answers.
// Audit columns are excluded; value is String[] (multi-value answers are supported).
// questionId/type/isGlobal let the download control address and render a
// file_upload answer without a dedicated file-metadata model.
export type ApplicationReviewAnswer = {
  id: string;
  questionId: string;
  questionLabel: string;
  value: string[];
  type: QuestionType;
  isGlobal: boolean;
};

// Full application shape for the admin/manager review page. Base fields come
// from the Prisma-generated payload; the two answer arrays are overridden with
// the normalized ApplicationReviewAnswer shape (getApplicationForReview maps
// the raw payload into it — see prisma/data/applications.ts).
export type ApplicationForReview = Prisma.ApplicationGetPayload<{
  select: {
    id: true;
    status: true;
    submittedAt: true;
    user: { select: { name: true; email: true } };
    position: { select: { id: true; title: true } };
  };
}> & {
  globalAnswers: ApplicationReviewAnswer[];
  positionAnswers: ApplicationReviewAnswer[];
};

// Discriminated union addressing a file answer by question, not by answer row
// id — mirrors createOrUpdateApplicationAnswer's (applicationId, questionId,
// isGlobal) addressing so no answer row id needs to be plumbed through the
// stepper. Kept in sync with lib/constants.ts#questionFileTargetSchema.
export type QuestionFileTarget =
  | { scope: 'profile'; questionId: string }
  | {
      scope: 'application';
      applicationId: string;
      questionId: string;
      isGlobal: boolean;
    };

// Result of downloadQuestionFileAnswer — base64-encoded so it can cross the
// server-action boundary without a Route Handler (this repo forbids one).
export type QuestionFileDownload = {
  filename: string;
  contentType: string;
  data: string;
};

// Activity feed item — role-agnostic shape produced by the applicant/admin
// feed wrappers and consumed by the shared ActivityFeedList leaf.
// statusVariant drives the dot color; sentence is pre-rendered safe copy.
export type ActivityItem = {
  id: string;
  statusVariant: BadgeVariant;
  sentence: string;
  timestamp: Date;
};

// Admin-only type — exposes other users' identities (name/email/role/counts).
// Must only be used in admin-gated contexts; never serialize to non-admin clients.
export type AdminUserListItem = Prisma.UserGetPayload<{
  select: {
    id: true;
    name: true;
    email: true;
    isAdmin: true;
    createdAt: true;
    managedPositions: { select: { id: true; title: true } };
    _count: {
      select: {
        applications: { where: { deletedAt: null; status: { not: 'draft' } } };
      };
    };
  };
}>;

// Per-position application stats for admin/manager position cards.
// Aggregate read-only shape — never exposes individual applicant identity.
// Must only be passed to cards for positions the caller manages.
export type PositionApplicationStats = {
  positionId: string;
  counts: Partial<Record<$Enums.ApplicationStatus, number>>;
  total: number;
};

// Identity shape passed to nav components so sidebar and mobile nav agree
// on what to display in the user menu.
export interface NavIdentity {
  name: string | null;
  email: string;
  roleLabel: string;
  // true only for bypass sessions on non-production environments;
  // routes the Log out handler to logoutBypassUser() instead of authClient.signOut().
  isBypass: boolean;
}
