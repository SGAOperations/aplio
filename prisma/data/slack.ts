import 'server-only';

import { prisma } from '@/lib/prisma';

export async function getSlackConnection(
  userId: string,
): Promise<{ slackUserId: string; createdAt: Date } | null> {
  return prisma.slackConnection.findUnique({
    where: { userId },
    select: { slackUserId: true, createdAt: true },
  });
}
