import 'server-only';

import { APIError } from 'better-auth/api';

import { ACCOUNT_DEACTIVATED_ERROR_CODE } from '@/lib/constants';
import { prisma } from '@/lib/prisma';

// Throws — returning false leaves callers dereferencing a null session's .token.
export async function assertSessionUserActive(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { deletedAt: true },
  });
  if (user?.deletedAt)
    throw APIError.from('FORBIDDEN', {
      code: ACCOUNT_DEACTIVATED_ERROR_CODE,
      message: 'This account has been deactivated.',
    });
}

// deletedAt scope is defence in depth: Better Auth already skips `after` when
// `before` throws, but a deactivated row must never be stamped regardless.
export async function recordSignIn(userId: string): Promise<void> {
  await prisma.user.updateMany({
    where: { id: userId, deletedAt: null },
    data: { lastLoginAt: new Date() },
  });
}
