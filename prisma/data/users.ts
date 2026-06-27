import 'server-only';

import { prisma } from '@/lib/prisma';
import type { AdminUserListItem } from '@/lib/types';

// Returns all active (non-deactivated) users for the admin /users page.
// Admin-only — exposes user identities; never call from a non-admin context.
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
            where: { deletedAt: null, status: { not: 'draft' } },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}
