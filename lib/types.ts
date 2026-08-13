import type { PositionStatus, QuestionType } from '@/prisma/client';
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

// Manager ids are consumed server-side only, so the manager shape stays minimal.
export type PositionDetail = PositionWithQuestions & {
  managers: { id: string }[];
};

// Matches getPositionForEdit's select; audit columns excluded so they never
// cross the server/client prop boundary.
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
}>;

// Matches getPositionForEdit's select; audit columns excluded so they never
// cross the server/client prop boundary.
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
        format: true;
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
    format: true;
    createdAt: true;
    updatedAt: true;
  };
}>;

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

export type PositionApplicationListItem = Prisma.ApplicationGetPayload<{
  select: {
    id: true;
    status: true;
    submittedAt: true;
    user: { select: { id: true; name: true; email: true } };
  };
}>;

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

// Structural type satisfied by PositionWithQuestions, PositionForEdit, and raw
// Prisma rows alike, so the window helper needs no conversion at its call sites.
export type PositionWindow = {
  status: PositionStatus;
  opensAt: Date | null;
  closesAt: Date | null;
};

// 'unavailable' covers draft and closed positions — status is the master switch,
// overriding the date window.
export type PositionAvailability =
  | 'accepting'
  | 'upcoming'
  | 'closed_by_date'
  | 'unavailable';

// Admin-gated contexts only.
export type OpenPositionSummaryItem = Prisma.PositionGetPayload<{
  select: { id: true; title: true; _count: { select: { applications: true } } };
}>;

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

// questionId/type/isGlobal let the download control address a file_upload answer
// without a dedicated file-metadata model.
export type ApplicationReviewAnswer = {
  id: string;
  questionId: string;
  questionLabel: string;
  value: string[];
  type: QuestionType;
  isGlobal: boolean;
};

// The answer arrays override the generated payload with the normalized shape that
// getApplicationForReview maps into.
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

// base64 so the payload can cross the server-action boundary — this repo forbids
// the Route Handler that would otherwise stream it.
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
        // PUBLISHED_POSITION_WHERE inlined — a value import can't feed a type
        // position — mirroring prisma/data/users.ts#getUsersForAdmin's where.
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
