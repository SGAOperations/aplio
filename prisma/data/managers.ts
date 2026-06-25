import 'server-only';

import prisma from '@/lib/prisma';

// Single source of truth for global manager detection.
// Returns true if the user manages at least one non-deleted position.
// Per-position checks use position.managers.some(m => m.id === userId)
// against an already-fetched list; this function is for nav/dashboard routing only.
export async function isManager(userId: string): Promise<boolean> {
  const count = await prisma.position.count({
    where: { managers: { some: { id: userId } }, deletedAt: null },
  });
  return count > 0;
}

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
// Used as the shared authorization guard across position actions.
export async function checkPositionAccess(
  positionId: string,
  userId: string,
  isAdmin: boolean,
): Promise<boolean> {
  if (isAdmin) return true;

  const position = await prisma.position.findFirst({
    where: { id: positionId, deletedAt: null },
    select: { managers: { where: { id: userId }, select: { id: true } } },
  });

  return (position?.managers.length ?? 0) > 0;
}
