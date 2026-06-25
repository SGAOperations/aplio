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
