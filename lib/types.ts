import type {
  Application,
  GlobalApplicationAnswer,
  Position,
  PositionApplicationAnswer,
  PositionQuestion,
} from '@/prisma/client';

export type PositionWithQuestions = Position & {
  questions: PositionQuestion[];
};

export type DraftApplication = Application & {
  globalAnswers: GlobalApplicationAnswer[];
  positionAnswers: PositionApplicationAnswer[];
};
