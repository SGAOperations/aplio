import 'server-only';

import { PUBLISHED_POSITION_WHERE } from '@/lib/constants';
import { prisma } from '@/lib/prisma';
import type { AdminUserListItem } from '@/lib/types';

// Exposes user identities — admin-gated callers only.
export async function getUsersForAdmin(): Promise<AdminUserListItem[]> {
  return prisma.user.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      name: true,
      email: true,
      isAdmin: true,
      createdAt: true,
      managedPositions: {
        where: { deletedAt: null },
        select: { id: true, title: true },
        orderBy: { title: 'asc' },
      },
      _count: {
        select: {
          applications: {
            where: {
              deletedAt: null,
              status: { not: 'draft' },
              position: PUBLISHED_POSITION_WHERE,
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}
