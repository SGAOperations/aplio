import 'server-only';

import { del } from '@vercel/blob';

import { prisma } from '@/lib/prisma';

export async function countAnswerFileReferences(url: string): Promise<number> {
  const [profileCount, globalAppCount, positionAppCount] = await Promise.all([
    prisma.globalAnswer.count({ where: { value: { has: url } } }),
    prisma.globalApplicationAnswer.count({ where: { value: { has: url } } }),
    prisma.positionApplicationAnswer.count({ where: { value: { has: url } } }),
  ]);
  return profileCount + globalAppCount + positionAppCount;
}

// Several rows can share one blob, so it goes only with the last reference.
export async function cleanupOrphanedBlob(url: string): Promise<void> {
  try {
    if ((await countAnswerFileReferences(url)) === 0) await del(url);
  } catch {
    // Swallowed: an orphaned blob is never user-actionable.
  }
}
