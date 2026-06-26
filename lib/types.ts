import type {
  Application,
  GlobalApplicationAnswer,
  PositionApplicationAnswer,
  PositionStatus,
  QuestionType,
} from '@/prisma/client';
import type { Prisma } from '@/prisma/client';

import type { REVIEWER_APPLICATION_STATUSES } from '@/lib/constants';

import type { BadgeVariant } from '@/components/ui/badge';

export type PositionWithQuestions = {
  id: string;
  title: string;
  status: PositionStatus;
  description: string;
  opensAt: Date | null;
  closesAt: Date | null;
  questions: {
    id: string;
    label: string;
    type: QuestionType;
    required: boolean;
    options: string[];
    order: number;
  }[];
};

export type PositionManager = {
  id: string;
  name: string | null;
  email: string;
};

// Detail view type: full read payload including managers for the access check.
// Manager ids are consumed server-side only; name/email are not needed for the
// draft gate check so we keep the manager shape minimal (§3).
export type PositionDetail = PositionWithQuestions & {
  managers: { id: string }[];
};

// Narrowed question shape — only the fields rendered by the edit page and
// PositionQuestionsSection; audit columns are excluded to avoid leaking them
// across the server/client prop boundary.
export type PositionQuestionForEdit = {
  id: string;
  positionId: string;
  label: string;
  type: QuestionType;
  required: boolean;
  options: string[];
  order: number;
};

// Only the six position fields consumed on the edit page; audit columns are
// excluded so they are never serialized across the server/client boundary.
export type PositionForEdit = {
  id: string;
  title: string;
  description: string;
  status: PositionStatus;
  opensAt: Date | null;
  closesAt: Date | null;
  questions: PositionQuestionForEdit[];
  managers: PositionManager[];
};

export type DraftApplication = Application & {
  globalAnswers: GlobalApplicationAnswer[];
  positionAnswers: PositionApplicationAnswer[];
};

export type GlobalQuestionListItem = Prisma.GlobalQuestionGetPayload<{
  select: {
    id: true;
    order: true;
    label: true;
    type: true;
    required: true;
    options: true;
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
export type ApplicationReviewAnswer = {
  id: string;
  questionLabel: string;
  value: string[];
};

// Full application shape for the admin/manager review page.
// Prisma-generated payload keeps it in sync with the schema automatically.
export type ApplicationForReview = Prisma.ApplicationGetPayload<{
  select: {
    id: true;
    status: true;
    submittedAt: true;
    user: { select: { name: true; email: true } };
    position: { select: { id: true; title: true } };
    globalAnswers: {
      where: { deletedAt: null };
      orderBy: { createdAt: 'asc' };
      select: { id: true; questionLabel: true; value: true };
    };
    positionAnswers: {
      where: { deletedAt: null };
      orderBy: { createdAt: 'asc' };
      select: { id: true; questionLabel: true; value: true };
    };
  };
}>;

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

// Identity shape passed to nav components so sidebar and mobile nav agree
// on what to display in the user menu.
export interface NavIdentity {
  name: string | null;
  email: string;
  roleLabel: string;
  // true only for bypass sessions on non-production environments;
  // gates the Log out control which is bypass-only (real-auth sign-out is out of scope).
  isBypass: boolean;
}
