import type { Position, PositionQuestion } from '@/prisma/client';

export type PositionWithQuestions = Position & {
  questions: PositionQuestion[];
};
