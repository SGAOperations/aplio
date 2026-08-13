import 'server-only';

import { cache } from 'react';

import { prisma } from '@/lib/prisma';

// For nav/dashboard routing only (per-position checks use an already-fetched list).
// cache() dedupes this per render — the (auth) layout and a page guard both ask per request.
export const isManager = cache(async function isManager(
  userId: string,
): Promise<boolean> {
  const count = await prisma.position.count({
    where: { managers: { some: { id: userId } }, deletedAt: null },
  });
  return count > 0;
});

// Returns the set of position IDs managed by the given user (non-deleted only).
// Admins should pass the full positions list instead of calling this function.
export async function getManagedPositionIds(
  userId: string,
): Promise<Set<string>> {
  const managed = await prisma.position.findMany({
    where: { managers: { some: { id: userId } }, deletedAt: null },
    select: { id: true },
  });
  return new Set(managed.map((p) => p.id));
}

// Returns true if the user is an admin or a manager of the given position.
// This is the query behind lib/auth/guards.ts's requirePositionAccess — call
// that from actions/pages instead of this function directly, so denial
// handling stays centralized (#356).
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
