import type { Prisma } from '@/prisma/client';

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
