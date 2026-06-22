import type {
  Application,
  GlobalApplicationAnswer,
  PositionApplicationAnswer,
  PositionStatus,
  QuestionType,
} from '@/prisma/client';
import type { Prisma } from '@/prisma/client';

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
