import 'server-only';

import { cache } from 'react';

import { prisma } from '@/lib/prisma';
import { type Reviewer } from '@/lib/types';

// Nav/dashboard routing only; cache() dedupes it across the layout and a page guard.
export const isManager = cache(async function isManager(
  userId: string,
): Promise<boolean> {
  const count = await prisma.position.count({
    where: { managers: { some: { id: userId } }, deletedAt: null },
  });
  return count > 0;
});

// Call requirePositionAccess instead, so denial handling stays centralized.
export async function checkPositionAccess(
  positionId: string,
  user: Reviewer,
): Promise<boolean> {
  if (user.isAdmin) return true;

  const position = await prisma.position.findFirst({
    where: { id: positionId, deletedAt: null },
    select: { managers: { where: { id: user.id }, select: { id: true } } },
  });

  return (position?.managers.length ?? 0) > 0;
}
