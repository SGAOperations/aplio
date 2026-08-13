import 'server-only';

import { cache } from 'react';

import { prisma } from '@/lib/prisma';

// Nav/dashboard routing only; cache() dedupes it across the layout and a page guard.
export const isManager = cache(async function isManager(
  userId: string,
): Promise<boolean> {
  const count = await prisma.position.count({
    where: { managers: { some: { id: userId } }, deletedAt: null },
  });
  return count > 0;
});

// Admins should pass the full positions list rather than call this.
export async function getManagedPositionIds(
  userId: string,
): Promise<Set<string>> {
  const managed = await prisma.position.findMany({
    where: { managers: { some: { id: userId } }, deletedAt: null },
    select: { id: true },
  });
  return new Set(managed.map((p) => p.id));
}

// Call requirePositionAccess instead, so denial handling stays centralized.
export async function checkPositionAccess(
  positionId: string,
  user: { id: string; isAdmin: boolean },
): Promise<boolean> {
  if (user.isAdmin) return true;

  const position = await prisma.position.findFirst({
    where: { id: positionId, deletedAt: null },
    select: { managers: { where: { id: user.id }, select: { id: true } } },
  });

  return (position?.managers.length ?? 0) > 0;
}
