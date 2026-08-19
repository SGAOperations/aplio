import 'server-only';

import type { Prisma } from '@/prisma/client';

import {
  NON_REVIEWABLE_APPLICATION_STATUSES,
  PUBLISHED_POSITION_WHERE,
} from '@/lib/constants';
import type { Reviewer } from '@/lib/types';

// Admin sees every published position; a manager only the ones they manage.
export function buildReviewablePositionWhere(
  user: Reviewer,
): Prisma.PositionWhereInput {
  return user.isAdmin
    ? PUBLISHED_POSITION_WHERE
    : { ...PUBLISHED_POSITION_WHERE, managers: { some: { id: user.id } } };
}

// `status` omitted so a caller's own filter can't overwrite the position scoping.
export function buildApplicationScopeWhere(
  user: Reviewer,
): Omit<Prisma.ApplicationWhereInput, 'status'> {
  return { deletedAt: null, position: buildReviewablePositionWhere(user) };
}

// listable keeps withdrawn rows, reviewable drops them (and draft, in both).
export function buildApplicationWhere(
  user: Reviewer,
  scope: 'listable' | 'reviewable',
): Prisma.ApplicationWhereInput {
  return {
    ...buildApplicationScopeWhere(user),
    status:
      scope === 'reviewable'
        ? { notIn: NON_REVIEWABLE_APPLICATION_STATUSES }
        : { not: 'draft' },
  };
}
