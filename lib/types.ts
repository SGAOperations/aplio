import type { LucideIcon } from 'lucide-react';

import type {
  PositionStatus,
  QuestionType,
  ShortAnswerFormat,
} from '@/prisma/client';
import type { $Enums, Prisma } from '@/prisma/client';

import type { REVIEWER_APPLICATION_STATUSES } from '@/lib/constants';

import type { BadgeVariant } from '@/components/ui/badge';

// Matches prisma/data/positions.ts#positionWithQuestionsSelect.
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
        format: true;
        order: true;
      };
    };
  };
}>;

export type PositionManager = Prisma.UserGetPayload<{
  select: { id: true; name: true; email: true };
}>;

// Deliberately omits id — searchUsers withholds it until an add is performed.
export type UserSearchResult = { displayName: string; primaryEmail: string };

// Manager ids are consumed server-side only, so the manager shape stays minimal.
export type PositionDetail = PositionWithQuestions & {
  managers: { id: string }[];
};

// Mapped shape — getPositionForEdit flattens `_count.answers` into answerCount.
export type PositionQuestionForEdit = Prisma.PositionQuestionGetPayload<{
  select: {
    id: true;
    positionId: true;
    label: true;
    type: true;
    required: true;
    options: true;
    allowOther: true;
    format: true;
    order: true;
  };
}> & { answerCount: number };

// Server-only — updatedAt/_count feed isPositionActive and never cross to a client.
// `questions` is the mapped PositionQuestionForEdit shape, not a raw select.
export type PositionForEdit = Prisma.PositionGetPayload<{
  select: {
    id: true;
    title: true;
    description: true;
    status: true;
    opensAt: true;
    closesAt: true;
    updatedAt: true;
    managers: { select: { id: true; name: true; email: true } };
    _count: { select: { applications: true } };
  };
}> & { questions: PositionQuestionForEdit[] };

// Matches getApplicationForApply's query in prisma/data/applications.ts.
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
    format: true;
    createdAt: true;
    updatedAt: true;
  };
}>;

// position.status/opensAt/closesAt let a row decide resubmit availability without a second query.
export type MyApplicationListItem = Prisma.ApplicationGetPayload<{
  select: {
    id: true;
    status: true;
    submittedAt: true;
    updatedAt: true;
    positionId: true;
    position: {
      select: {
        id: true;
        title: true;
        status: true;
        opensAt: true;
        closesAt: true;
      };
    };
  };
}>;

// Answer arrays overridden with the shape getMyApplication maps into. Extends
// MyApplicationListItem so MyApplicationPrimaryAction/MyApplicationRowActions
// accept it without a dedicated prop type.
export type MyApplicationDetail = MyApplicationListItem & {
  globalAnswers: ApplicationReviewAnswer[];
  positionAnswers: ApplicationReviewAnswer[];
};

// Exposes applicant identity — admin-gated contexts only, never a non-admin client.
export type AdminApplicationListItem = Prisma.ApplicationGetPayload<{
  select: {
    id: true;
    status: true;
    submittedAt: true;
    position: { select: { id: true; title: true } };
    user: { select: { id: true; name: true; email: true } };
  };
}>;

// Structural, so the window helper needs no conversion at its call sites.
export type PositionWindow = {
  status: PositionStatus;
  opensAt: Date | null;
  closesAt: Date | null;
};

// Minimal structural input for isPositionActive (lib/utils.ts). Extends PositionWindow
// (not just status/closesAt) because isPositionActive delegates its "is this position
// actually closed" check to getPositionAvailability, which also needs opensAt — a
// status:'open' position past its closesAt is closed_by_date even though the status
// column never flips to 'closed'. _count.applications must be the count of non-deleted
// applications in UNRESOLVED_APPLICATION_STATUSES (excludes 'draft' — a draft can never
// be submitted to a closed position, so counting it here only permanently pins an
// otherwise-resolved closed position as active, #340) — populated only via
// prisma/data/positions.ts's positionActivitySelect fragment; any other _count select
// silently produces a wrong active/archived answer.
export type PositionActivity = PositionWindow & {
  updatedAt: Date;
  _count: { applications: number };
};

// Manager-facing position row: adds the fields isPositionActive needs to partition
// active vs archived. Server-only shape — updatedAt/_count are internal and must
// never be passed across a client boundary.
export type ManagedPosition = PositionWithQuestions & PositionActivity;

// Lean per-position row for the manager dashboard's "My Positions" widget.
export type ManagedPositionSummaryItem = Prisma.PositionGetPayload<{
  select: {
    id: true;
    title: true;
    status: true;
    opensAt: true;
    closesAt: true;
    _count: { select: { applications: true } };
  };
}>;

// Shape partitionAnswerValue/isAnswered need; matches GlobalQuestion & position questions as-is.
export type AnswerQuestion = {
  id: string;
  label: string;
  type: QuestionType;
  required: boolean;
  options: string[];
  allowOther: boolean;
  format: ShortAnswerFormat | null;
};

// Result of partitionAnswerValue — always a permutation of the input value.
export type AnswerPartition = { fitted: string[]; orphaned: string[] };

// 'unavailable' covers draft and closed — status overrides the date window.
export type PositionAvailability =
  | 'accepting'
  | 'upcoming'
  | 'closed_by_date'
  | 'unavailable';

// Admin-gated contexts only.
export type OpenPositionSummaryItem = Prisma.PositionGetPayload<{
  select: { id: true; title: true; _count: { select: { applications: true } } };
}>;

export type PositionDeletionSummary = {
  submittedCount: number;
  draftCount: number;
};

// Minimal shape reviewer-scoped queries and guards need — spelled inline in 5+ signatures.
export type Reviewer = { id: string; isAdmin: boolean };

export type ReviewerStatus = (typeof REVIEWER_APPLICATION_STATUSES)[number];

export type ApplicationSortField = 'date' | 'name' | 'status';
export type ApplicationSortDirection = 'asc' | 'desc';
export type ApplicationSort = {
  field: ApplicationSortField;
  direction: ApplicationSortDirection;
};

// status is ReviewerStatus so 'draft' can never be filtered for.
export type ApplicationFilters = {
  positionId?: string;
  status?: ReviewerStatus;
  userId?: string;
  q?: string;
  sort?: ApplicationSort;
};

export type ApplicationListRow = AdminApplicationListItem;

export type ProfileCompleteness = {
  complete: boolean;
  missingCount: number;
  requiredCount: number;
};

// questionId/type/isGlobal address a file answer without a file-metadata model.
// Shared by the reviewer application view and the applicant's own MyApplicationDetail.
export type ApplicationReviewAnswer = {
  id: string;
  questionId: string;
  questionLabel: string;
  value: string[];
  type: QuestionType;
  isGlobal: boolean;
};

// Answer arrays overridden with the shape getApplicationForReview maps into.
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

// Kept in sync with lib/constants.ts#questionFileTargetSchema.
export type QuestionFileTarget =
  | { scope: 'profile'; questionId: string }
  | {
      scope: 'application';
      applicationId: string;
      questionId: string;
      isGlobal: boolean;
    };

// base64 to cross the server-action boundary; no Route Handler to stream it.
export type QuestionFileDownload = {
  filename: string;
  contentType: string;
  data: string;
};

// sentence is pre-rendered safe copy; statusVariant drives the dot color.
export type ActivityItem = {
  id: string;
  statusVariant: BadgeVariant;
  sentence: string;
  timestamp: Date;
};

// Exposes other users' identities — admin-gated contexts only, never a non-admin client.
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
        // PUBLISHED_POSITION_WHERE inlined: a value import can't feed a type.
        applications: {
          where: {
            deletedAt: null;
            status: { not: 'draft' };
            position: { deletedAt: null; status: { not: 'draft' } };
          };
        };
      };
    };
  };
}>;

// Aggregate only — never exposes individual applicant identity.
export type PositionApplicationStats = {
  positionId: string;
  counts: Partial<Record<$Enums.ApplicationStatus, number>>;
  total: number;
};

export interface NavIdentity {
  name: string | null;
  email: string;
  roleLabel: string;
  // Routes Log out to logoutBypassUser() instead of authClient.signOut().
  isBypass: boolean;
}

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

// id feeds aria-labelledby linking the group's <ul> to its visible label.
export interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}
