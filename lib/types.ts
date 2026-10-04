import type { LucideIcon } from 'lucide-react';

import type {
  PositionStatus,
  QuestionType,
  ShortAnswerFormat,
} from '@/prisma/client';
import type { $Enums, Prisma } from '@/prisma/client';

import type {
  APPLICATION_SORT_DIRECTIONS,
  APPLICATION_SORT_FIELDS,
  APPLICATION_STATUS_VALUES,
  EMAIL_FAILURE_STATUSES,
  EMAIL_STATUS_VALUES,
  EMAIL_TEMPLATE_VALUES,
  INSIGHTS_RANGE_PRESETS,
  PublicApplicationStatus,
  USER_ROLE_FILTER_VALUES,
} from '@/lib/constants';

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

// Server-only — updatedAt/lastStatusChangeAt feed isPositionActive and never
// cross to a client. `questions` is the mapped PositionQuestionForEdit shape,
// not a raw select; lastStatusChangeAt comes from withPositionActivity, not a select.
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
  };
}> & {
  questions: PositionQuestionForEdit[];
  lastStatusChangeAt: Date | null;
  hasApplications: boolean;
};

// Matches getApplicationForApply's query in prisma/data/applications.ts.
// status is overridden to the public value — applicant-facing, never the
// internal reviewer status.
export type DraftApplication = Omit<
  Prisma.ApplicationGetPayload<{
    include: { globalAnswers: true; positionAnswers: true };
  }>,
  'status'
> & { status: PublicApplicationStatus };

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
// status is the public value; lastSavedAt replaces updatedAt — null once
// submitted, so a submitted row can never leak its last-touched time.
export type MyApplicationListItem = Omit<
  Prisma.ApplicationGetPayload<{
    select: {
      id: true;
      status: true;
      submittedAt: true;
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
  }>,
  'status'
> & { status: PublicApplicationStatus; lastSavedAt: Date | null };

// Answer arrays overridden with the shape getMyApplication maps into. Extends
// MyApplicationListItem so MyApplicationPrimaryAction/MyApplicationRowActions
// accept it without a dedicated prop type.
export type MyApplicationDetail = MyApplicationListItem & {
  globalAnswers: ApplicationReviewAnswer[];
  positionAnswers: ApplicationReviewAnswer[];
  hasPositionQuestions: boolean;
};

// Mirrors prisma/data/applications.ts's runtime withSubmittedAt helper — both
// narrow a row whose query excludes drafts, so submittedAt is never null.
export type WithSubmittedAt<T extends { submittedAt: Date | null }> = Omit<
  T,
  'submittedAt'
> & { submittedAt: Date };

// getMyRecentActivity excludes drafts, so its rows are narrowed to a real submittedAt.
export type MySubmittedApplicationListItem =
  WithSubmittedAt<MyApplicationListItem>;

// getMyRecentActivity's own shape — statusChangedAt (getPublicStatusSince) is
// when the current public status began, never the raw submission date.
export type MyActivityApplication = MySubmittedApplicationListItem & {
  statusChangedAt: Date;
};

// Exposes applicant identity — admin-gated contexts only, never a non-admin
// client. submittedAt narrowed to Date: every query producing this type
// excludes drafts (buildApplicationWhere's 'listable'/'reviewable' scopes).
export type AdminApplicationListItem = WithSubmittedAt<
  Prisma.ApplicationGetPayload<{
    select: {
      id: true;
      status: true;
      submittedAt: true;
      applicantName: true;
      position: { select: { id: true; title: true } };
      user: { select: { id: true; name: true; email: true } };
    };
  }>
>;

// Identity and timestamps only — no status, applicantName, or answer relation.
// completion travels as a sibling Record<id, ApplicationCompletion>, never here.
// submittedAt is always null here — every row is a draft.
export type DraftApplicationListItem = Prisma.ApplicationGetPayload<{
  select: {
    id: true;
    createdAt: true;
    updatedAt: true;
    submittedAt: true;
    position: { select: { id: true; title: true } };
    user: { select: { id: true; name: true; email: true } };
  };
}>;

// Per-row discriminant so ApplicationsTable can mix admin and draft rows on
// one page instead of switching its whole column set between the two.
export type ApplicationTableRow =
  | ({ isDraft: false } & AdminApplicationListItem)
  | ({ isDraft: true } & DraftApplicationListItem);

// Structural, so the window helper needs no conversion at its call sites.
export type PositionWindow = {
  status: PositionStatus;
  opensAt: Date | null;
  closesAt: Date | null;
};

// Minimal shape both grouping helpers sort by.
export type ManagedPositionRow = PositionWindow & {
  title: string;
  updatedAt: Date;
};

// Minimal structural input for isPositionActive (lib/utils.ts). Extends PositionWindow
// (not just status/closesAt) because isPositionActive delegates its "is this position
// actually closed" check to getPositionAvailability, which also needs opensAt — a
// status:'open' position past its closesAt is closed_by_date even though the status
// column never flips to 'closed'. lastStatusChangeAt is produced only by
// withPositionActivity decoding prisma/data/positions.ts's positionActivitySelect
// fragment; any other source silently produces a wrong active/archived answer.
export type PositionActivity = PositionWindow & {
  updatedAt: Date;
  lastStatusChangeAt: Date | null;
};

// Manager-facing position row: adds the fields isPositionActive needs to partition
// active vs archived. Server-only shape — updatedAt/lastStatusChangeAt are
// internal and must never be passed across a client boundary.
export type ManagedPosition = PositionWithQuestions & PositionActivity;

// Lean per-position row for the manager dashboard's "My Positions" widget.
// updatedAt feeds orderManagedPositions's closed-group fallback; never a
// bespoke render field, so exposing it to this server-only row is safe.
export type ManagedPositionSummaryItem = Prisma.PositionGetPayload<{
  select: {
    id: true;
    title: true;
    status: true;
    opensAt: true;
    closesAt: true;
    updatedAt: true;
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

export type PositionDateInfo = {
  label:
    | 'Opens'
    | 'Closes'
    | 'Closed'
    | 'Was scheduled to open'
    | 'Was scheduled to close';
  date: Date;
  emphasis: 'live' | 'calm' | 'stale';
};

// Applicant-facing deadline urgency — distinct from PositionDateInfo's
// emphasis tiers (see lib/utils.ts#getDeadlineInfo for why they don't merge).
export type DeadlineTier = 'upcoming' | 'distant' | 'soon' | 'urgent' | 'past';

export type DeadlineInfo = {
  tier: DeadlineTier;
  label: 'Opens' | 'Closes' | 'Closed';
  date: Date;
  // Short form ("5d"); null when no countdown applies.
  compactCountdown: string | null;
};

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

export type ApplicationSortField = (typeof APPLICATION_SORT_FIELDS)[number];
export type ApplicationSortDirection =
  (typeof APPLICATION_SORT_DIRECTIONS)[number];
export type ApplicationSort = {
  field: ApplicationSortField;
  direction: ApplicationSortDirection;
};

export type ApplicationStatusFilter =
  (typeof APPLICATION_STATUS_VALUES)[number];

// Which query path ApplicationsResults takes — 'merged' unions drafts with
// everything else (the default view, and any draft+submitted mix); 'drafts'
// is the exclusive draft-only view; 'submitted' excludes drafts entirely.
export type ApplicationViewMode = 'merged' | 'drafts' | 'submitted';

// statuses widened to ApplicationStatusFilter[] (includes 'draft') so the
// queue's filter can select or mix in the drafts view; buildApplicationListWhere
// guards against 'draft' ever overwriting listable's own status: { not: 'draft' }.
export type ApplicationFilters = {
  positionIds?: string[];
  statuses?: ApplicationStatusFilter[];
  userIds?: string[];
  q?: string;
  sort?: ApplicationSort;
};

// Cross-user identity — reviewer-gated callers only, scoped like getApplications.
export type ReviewableApplicant = {
  id: string;
  name: string | null;
  email: string;
};

export type ApplicationListRow = AdminApplicationListItem;

export type ProfileCompleteness = {
  complete: boolean;
  missingCount: number;
  requiredCount: number;
};

// Counts only — safe on both a reviewer payload and an applicant's own, since
// neither answer content nor a per-question breakdown crosses in it.
export type ApplicationCompletion = {
  answeredCount: number;
  requiredCount: number;
  percent: number;
};

// questionId/type/isGlobal address a file answer without a file-metadata model.
// Shared by the reviewer application view and the applicant's own MyApplicationDetail.
export type ApplicationReviewAnswer = {
  id: string;
  questionId: string;
  questionLabel: string;
  value: string[];
  type: QuestionType;
  format: ShortAnswerFormat | null;
  isGlobal: boolean;
};

// Answer arrays overridden with the shape getApplicationForReview maps into.
// submittedAt narrowed to Date — buildApplicationWhere's 'listable' scope excludes drafts.
export type ApplicationForReview = WithSubmittedAt<
  Prisma.ApplicationGetPayload<{
    select: {
      id: true;
      status: true;
      submittedAt: true;
      applicantName: true;
      user: { select: { name: true; email: true } };
      position: { select: { id: true; title: true } };
    };
  }>
> & {
  globalAnswers: ApplicationReviewAnswer[];
  positionAnswers: ApplicationReviewAnswer[];
  hasPositionQuestions: boolean;
};

// Newest-first timeline row; changedByName is pre-resolved server-side (name
// ?? email) so the actor's User row never crosses to the client.
export type ApplicationStatusHistoryEntry = {
  id: string;
  from: $Enums.ApplicationStatus | null;
  to: $Enums.ApplicationStatus;
  changedByName: string;
  createdAt: Date;
};

// Reviewer-only cross-scope row; canOpen is resolved server-side so no
// manager identity crosses out of the query.
export type ApplicantOtherApplication = {
  id: string;
  status: $Enums.ApplicationStatus;
  submittedAt: Date;
  position: { id: string; title: string };
  canOpen: boolean;
};

// Recipient address, provider message id and raw provider error are
// deliberately withheld — never crosses to a client component.
export type ApplicationEmailEntry = {
  id: string;
  subject: string;
  status: $Enums.EmailStatus;
  template: $Enums.EmailTemplateKey;
  bounceType: string | null;
  occurredAt: Date;
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
// href is unset for a deleted position's rows — the page no longer exists.
export type ActivityItem = {
  id: string;
  statusVariant: BadgeVariant;
  sentence: string;
  timestamp: Date;
  href?: string;
};

// 'none' (plain applicant), 'managed' (manages ≥1 position), 'all' (admin).
export type ActivityScope = 'none' | 'managed' | 'all';

// mine is always the caller's own submitted applications; reviewed is the
// self-filtered reviewer feed, empty when scope is 'none'.
export type ActivityGroups = {
  scope: ActivityScope;
  mine: ActivityItem[];
  reviewed: ActivityItem[];
};

// Matches getRecentPositionStatusEvents's select in prisma/data/positions.ts.
// No actor identity selected; deletedAt gates the link.
export type PositionStatusActivity = Prisma.PositionStatusEventGetPayload<{
  select: {
    id: true;
    from: true;
    to: true;
    createdAt: true;
    position: { select: { id: true; title: true; deletedAt: true } };
  };
}>;

// No event backs this row; closesAt (non-null by the query's where) is the timestamp.
// deletedAt drives both the post-fetch deletion filter and the unlinked-row branch.
export type PositionDeadlineCloseActivity = Prisma.PositionGetPayload<{
  select: { id: true; title: true; closesAt: true; deletedAt: true };
}>;

// Matches getRecentPositionDeletions's select — no event backs this row either,
// so deletedAt (guaranteed non-null by that query's where) is the timestamp.
export type PositionDeletionActivity = Prisma.PositionGetPayload<{
  select: { id: true; title: true; deletedAt: true };
}>;

// Exposes other users' identities — admin-gated contexts only, never a non-admin client.
export type AdminUserListItem = Prisma.UserGetPayload<{
  select: {
    id: true;
    name: true;
    email: true;
    isAdmin: true;
    createdAt: true;
    lastLoginAt: true;
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
// counts covers every status; total excludes draft and withdrawn.
export type PositionApplicationStats = {
  positionId: string;
  counts: Partial<Record<$Enums.ApplicationStatus, number>>;
  total: number;
};

// Feeds the browse page's applied marker on PositionCard. No applicant
// identity, no answers — safe for a client leaf. status is the public value.
// completion is null for a non-draft row; a count-only aggregate for a draft.
export type MyPositionApplication = Omit<
  Prisma.ApplicationGetPayload<{
    select: { id: true; positionId: true; status: true };
  }>,
  'status'
> & {
  status: PublicApplicationStatus;
  completion: ApplicationCompletion | null;
};

export interface NavIdentity {
  name: string | null;
  email: string;
  roleLabel: string;
  // Routes Log out to logoutBypassUser() instead of authClient.signOut().
  isBypass: boolean;
}

// Rank order (Admin, Manager) — a user can hold both; badges/filters use every
// token, sort rank uses only the first.
export type UserRoleFilter = (typeof USER_ROLE_FILTER_VALUES)[number];

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

// Discovered from data-section-nav elements under <main>; label is the raw attribute value.
export interface SectionNavItem {
  id: string;
  label: string;
}

// A section's top offset in px from the scroll root's top edge.
export interface SectionPosition {
  id: string;
  top: number;
}

// The scroll root's (#main-content) current scroll geometry.
export interface SectionScrollMetrics {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
}

export type EmailStatusFilter = (typeof EMAIL_STATUS_VALUES)[number];
export type EmailTemplateFilter = (typeof EMAIL_TEMPLATE_VALUES)[number];

export type EmailLogFilters = {
  q?: string;
  statuses?: EmailStatusFilter[];
  templates?: EmailTemplateFilter[];
};

// Exposes recipient addresses and provider errors — admin-gated contexts
// only. Matches prisma/data/emails.ts#emailLogSelect.
export type EmailLogListItem = Prisma.EmailLogGetPayload<{
  select: {
    id: true;
    to: true;
    subject: true;
    template: true;
    status: true;
    bounceType: true;
    error: true;
    scheduledAt: true;
    sentAt: true;
    deliveredAt: true;
    createdAt: true;
    user: { select: { id: true; name: true } };
  };
}>;

export type EmailFailureStatus = (typeof EMAIL_FAILURE_STATUSES)[number];
export type EmailFailureCounts = Record<EmailFailureStatus, number>;

export type ManagerDigestPosition = {
  positionId: string;
  title: string;
  newApplications: number;
};

export type DailyDigestRecipient = {
  userId: string;
  email: string;
  name: string | null;
  since: Date;
  positions: ManagerDigestPosition[];
  total: number;
};

// status is always one of UNRESOLVED_APPLICATION_STATUSES — never a terminal decision.
export type WeeklyDigestStatusCount = {
  status: $Enums.ApplicationStatus;
  count: number;
};

export type WeeklyDigestRecipient = {
  userId: string;
  email: string;
  name: string | null;
  asOfDay: string;
  statusCounts: WeeklyDigestStatusCount[];
  openPositions: Pick<ManagerDigestPosition, 'positionId' | 'title'>[];
};

// ─── /insights ──────────────────────────────────────────────────────────

export type InsightsRangePreset = (typeof INSIGHTS_RANGE_PRESETS)[number];

// start is null only for the 'all' preset. fromDay/toDay are org-local
// YYYY-MM-DD, used for zero-filling day series.
export interface InsightsRange {
  preset: InsightsRangePreset;
  start: Date | null;
  end: Date;
  fromDay: string | null;
  toDay: string;
  granularity: 'day' | 'week';
}

// coveredCount/totalCount are both submitted-application counts within the
// query's population; historyStart is the earliest real ApplicationStatusEvent, globally.
export interface InsightsCoverage {
  coveredCount: number;
  totalCount: number;
  historyStart: Date | null;
}

export interface CountBucket {
  label: string;
  count: number;
}

export interface DurationSummary {
  n: number;
  medianHours: number | null;
  meanHours: number | null;
  histogram: CountBucket[];
}

export interface SeriesPoint {
  day: string;
  count: number;
}

export interface StackedSeriesKey {
  positionId: string;
  label: string;
}

export interface StackedSeriesPoint {
  day: string;
  values: Record<string, number>;
}

export interface AttentionInsights {
  untouched: { count: number; oldestDays: number | null };
  agingQueue: {
    n: number;
    buckets: CountBucket[];
    oldest: {
      applicationId: string;
      name: string;
      positionTitle: string;
      status: $Enums.ApplicationStatus;
      ageDays: number;
    }[];
  };
}

export interface PositionCountRow {
  positionId: string;
  title: string;
  count: number;
}

export interface VolumeInsights {
  n: number;
  series: SeriesPoint[];
  stackedSeries: StackedSeriesPoint[];
  stackedKeys: StackedSeriesKey[];
  mostAppliedTop: PositionCountRow[];
  mostAppliedAll: PositionCountRow[];
  mostAppliedPerOpenDay: (PositionCountRow & {
    openDays: number;
    rate: number;
  })[];
  droppedFromRate: number;
  heatmap: { weekday: number; block: number; count: number }[];
  deadlineRush: CountBucket[];
}

export interface ReviewSpeedInsights {
  timeToDecision: DurationSummary & {
    awaitingCount: number;
    coverage: InsightsCoverage;
  };
  firstReply: DurationSummary & {
    awaitingCount: number;
    coverage: InsightsCoverage;
  };
  timeInStage: {
    status: $Enums.ApplicationStatus;
    n: number;
    medianHours: number | null;
  }[];
  timeToComplete: DurationSummary;
}

export interface TransitionCell {
  from: $Enums.ApplicationStatus;
  to: $Enums.ApplicationStatus;
  count: number;
}

export interface PipelineInsights {
  n: number;
  transitionMatrix: TransitionCell[];
  backwardCount: number;
  decisionFlipCount: number;
  reviewerEventCount: number;
  outcomeMix: { status: string; count: number }[];
  outcomeMixByPosition: {
    positionId: string;
    title: string;
    counts: Record<string, number>;
    total: number;
  }[];
  withdrawalTiming: {
    from: $Enums.ApplicationStatus;
    actor: 'applicant' | 'admin';
    count: number;
  }[];
  resubmissionCount: number;
}

export interface FunnelInsights {
  conversion: { starts: number; converted: number; rate: number | null };
  conversionByPosition: {
    positionId: string;
    title: string;
    starts: number;
    converted: number;
    rate: number | null;
  }[];
  abandonment: { count: number; ageBuckets: CountBucket[] };
  dropoff: {
    positionId: string;
    title: string;
    nextQuestionLabel: string | null;
    count: number;
  }[];
  formLengthVsConversion: {
    positionId: string;
    title: string;
    requiredQuestionCount: number;
    conversionRate: number;
    starts: number;
  }[];
}

export interface AnswerRateRow {
  questionId: string;
  label: string;
  scope: 'global' | 'position';
  positionTitle: string | null;
  answered: number;
  total: number;
  rate: number | null;
}

export interface ChoiceDistributionQuestion {
  questionId: string;
  label: string;
  n: number;
  values: {
    value: string;
    kind: 'option' | 'other' | 'retired';
    count: number;
  }[];
}

export interface QuestionInsights {
  answerRates: AnswerRateRow[];
  choiceDistributions: ChoiceDistributionQuestion[];
  otherUsage: {
    questionId: string;
    label: string;
    rate: number | null;
    n: number;
  }[];
  longAnswerEffort: {
    n: number;
    medianChars: number | null;
    buckets: CountBucket[];
  };
}

export interface ApplicantInsights {
  totalSubmitted: number;
  uniqueApplicants: number;
  perApplicantBuckets: CountBucket[];
  repeatApplicantCount: number;
  newVsReturning: { new: number; returning: number } | null;
  profileCompleteness: CountBucket[];
  signupsNeverApplied: { startedDraft: number; neverStarted: number };
}

export interface PositionInsights {
  zeroApplicationPositions: { positionId: string; title: string }[];
  timeToFirstApplication: {
    medianDays: number | null;
    positions: { positionId: string; title: string; days: number }[];
  };
  managerLoad: {
    managerId: string;
    name: string;
    submitted: number;
    unresolved: number;
  }[];
  reviewerThroughput: {
    reviewerId: string;
    name: string;
    eventCount: number;
    medianDecisionHours: number | null;
    decisionN: number;
  }[];
}
