import 'server-only';

import { type SgaSession, hasAnyPosition } from '@nusgaops/sgauth';

import { Prisma, type User } from '@/prisma/client';

import { APLIO_ADMIN_POSITIONS } from '@/lib/constants';
import { prisma } from '@/lib/prisma';

// deletedAt scope: a deactivated row must never be stamped.
export async function recordSignIn(userId: string): Promise<void> {
  await prisma.user.updateMany({
    where: { id: userId, deletedAt: null },
    data: { lastLoginAt: new Date() },
  });
}

async function findOrCreateUser(session: SgaSession): Promise<User> {
  const { id: sgauthUserId, email, name } = session.user;

  const mapped = await prisma.user.findUnique({ where: { sgauthUserId } });
  if (mapped) return mapped;

  // Imported or admin-created rows not yet backfilled: linked once by address,
  // which SGAuth has verified. A row already linked elsewhere is never taken over.
  const unlinked = await prisma.user.findFirst({
    where: {
      email: { equals: email, mode: 'insensitive' },
      sgauthUserId: null,
    },
  });
  if (unlinked)
    return prisma.user.update({
      where: { id: unlinked.id },
      data: { sgauthUserId },
    });

  try {
    return await prisma.user.create({
      data: { email, name: name.trim() || null, sgauthUserId },
    });
  } catch (error) {
    // A concurrent first request created it; anything else is unexpected.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    )
      return prisma.user.findUniqueOrThrow({ where: { sgauthUserId } });
    throw error;
  }
}

// The Aplio row for an SGAuth session, created on first sign-in. A new SGAuth
// session stamps lastLoginAt once, a blank Aplio name takes SGAuth's, and
// isAdmin mirrors the admin positions so the column and DB queries agree.
export async function resolveSgauthUser(session: SgaSession): Promise<User> {
  const user = await findOrCreateUser(session);
  if (user.deletedAt) return user;

  const sessionStart = new Date(session.session.createdAt);
  const isNewSession = !user.lastLoginAt || user.lastLoginAt < sessionStart;
  const sgauthName = session.user.name.trim();
  const fillName = !user.name?.trim() && sgauthName !== '';
  const isAdmin = hasAnyPosition(session, [...APLIO_ADMIN_POSITIONS]);
  const syncAdmin = user.isAdmin !== isAdmin;
  if (!isNewSession && !fillName && !syncAdmin) return user;

  return prisma.user.update({
    where: { id: user.id },
    data: {
      ...(isNewSession ? { lastLoginAt: new Date() } : {}),
      ...(fillName ? { name: sgauthName } : {}),
      ...(syncAdmin ? { isAdmin } : {}),
    },
  });
}
