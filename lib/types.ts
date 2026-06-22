import type {
  Application,
  GlobalApplicationAnswer,
  Position,
  PositionApplicationAnswer,
  PositionQuestion,
} from '@/prisma/client';
import type { Prisma } from '@/prisma/client';

export type PositionWithQuestions = Position & {
  questions: PositionQuestion[];
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
