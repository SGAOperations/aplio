'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod/v4';

import { checkPositionEditable } from '@/prisma/data/positions';

import {
  requireAdmin,
  requireManagerOrAdmin,
  requirePositionAccess,
} from '@/lib/auth/guards';
import { getCurrentUser } from '@/lib/auth/server';
import {
  ARCHIVED_POSITION_EDIT_ERROR,
  POSITION_CLOSES_AT_ORDER_ERROR,
  POSITION_CLOSES_AT_PAST_ERROR,
  POSITION_DELETE_BLOCKED_ERROR,
  POSITION_DESCRIPTION_MAX_LENGTH,
  POSITION_OPENS_AT_ORDER_ERROR,
  POSITION_OPENS_AT_PAST_ERROR,
  POSITION_OPEN_REQUIRES_ADMIN_ERROR,
  positionDatesRefinement,
  positionPastDateIssues,
  validatePositionDates,
} from '@/lib/constants';
import { orgDayEnd, orgDayStart, toOrgDayString } from '@/lib/dates';
import { prisma } from '@/lib/prisma';
import type { PositionManager, UserSearchResult } from '@/lib/types';
import { type ResponseType, displayUserName } from '@/lib/utils';

// description defaults to '' so a draft can be created quickly.
const createPositionSchema = (today: string) =>
  z
    .object({
      title: z.string().min(1),
      description: z
        .string()
        .max(POSITION_DESCRIPTION_MAX_LENGTH)
        .optional()
        .default(''),
      status: z.enum(['draft', 'open', 'closed']),
      opensAt: z.iso.date().optional(),
      closesAt: z.iso.date().optional(),
    })
    .superRefine(positionDatesRefinement(today));

// Past-date check runs separately in updatePosition, against the loaded row's
// previous dates — the schema itself stays ordering-only.
const updatePositionSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    description: z
      .string()
      .max(POSITION_DESCRIPTION_MAX_LENGTH)
      .optional()
      .default(''),
    status: z.enum(['draft', 'open', 'closed']),
    opensAt: z.iso.date().optional(),
    closesAt: z.iso.date().optional(),
  })
  .superRefine(validatePositionDates);

// The refinement's messages are the only user-actionable parse failures.
const parseError = (error: z.ZodError) =>
  error.issues.find(
    (issue) =>
      issue.message === POSITION_OPENS_AT_ORDER_ERROR ||
      issue.message === POSITION_CLOSES_AT_ORDER_ERROR ||
      issue.message === POSITION_OPENS_AT_PAST_ERROR ||
      issue.message === POSITION_CLOSES_AT_PAST_ERROR,
  )?.message ?? 'Invalid input';

const deletePositionSchema = z.object({ id: z.string().min(1) });

const addPositionManagerSchema = z.object({
  positionId: z.string().min(1),
  email: z.string().trim().email(),
});

const removePositionManagerSchema = z.object({
  positionId: z.string().min(1),
  userId: z.string().min(1),
});

export async function createPosition(
  input: unknown,
): Promise<{ id: string } | { error: string }> {
  const user = await requireManagerOrAdmin();

  const parsed = createPositionSchema(toOrgDayString(new Date())).safeParse(
    input,
  );
  if (!parsed.success) return { error: parseError(parsed.error) };

  const { title, description, status, opensAt, closesAt } = parsed.data;

  if (status === 'open' && !user.isAdmin)
    return { error: POSITION_OPEN_REQUIRES_ADMIN_ERROR };

  // Creator is auto-assigned as a manager so they can immediately edit the position.
  const position = await prisma.position.create({
    data: {
      title,
      description,
      status,
      opensAt: opensAt ? orgDayStart(opensAt) : null,
      closesAt: closesAt ? orgDayEnd(closesAt) : null,
      createdById: user.id,
      updatedById: user.id,
      managers: { connect: { id: user.id } },
    },
    select: { id: true },
  });

  revalidatePath('/positions');
  revalidatePath('/manage/positions');
  return { id: position.id };
}

export async function updatePosition(
  input: unknown,
): Promise<void | { error: string }> {
  const parsed = updatePositionSchema.safeParse(input);
  if (!parsed.success) return { error: parseError(parsed.error) };

  const { id, title, description, status, opensAt, closesAt } = parsed.data;

  // Before any DB work: an earlier query would let an anonymous caller probe ids.
  await getCurrentUser();

  // Before the access guard, so a stale link gives an actionable message.
  const existing = await prisma.position.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, status: true, opensAt: true, closesAt: true },
  });
  if (!existing) return { error: 'This position no longer exists.' };

  const user = await requirePositionAccess(id);

  if (!(await checkPositionEditable(id, user)))
    return { error: ARCHIVED_POSITION_EDIT_ERROR };

  if (status === 'open' && existing.status !== 'open' && !user.isAdmin)
    return { error: POSITION_OPEN_REQUIRES_ADMIN_ERROR };

  const previous = {
    opensAt: existing.opensAt ? toOrgDayString(existing.opensAt) : undefined,
    closesAt: existing.closesAt ? toOrgDayString(existing.closesAt) : undefined,
  };
  const pastDateIssues = positionPastDateIssues(
    { opensAt, closesAt },
    toOrgDayString(new Date()),
    previous,
  );
  if (pastDateIssues.length > 0)
    return { error: pastDateIssues[0]?.message ?? 'Invalid input' };

  await prisma.position.update({
    where: { id },
    data: {
      title,
      description,
      status,
      opensAt: opensAt ? orgDayStart(opensAt) : null,
      closesAt: closesAt ? orgDayEnd(closesAt) : null,
      updatedById: user.id,
    },
  });

  revalidatePath('/positions');
  revalidatePath('/manage/positions');
  revalidatePath(`/positions/${id}`);
  revalidatePath(`/manage/positions/${id}/edit`);
  // status can flip open <-> draft, changing what every surface shows.
  revalidatePath('/');
  revalidatePath('/my-applications');
  revalidatePath('/manage/applications');
}

export async function deletePosition(
  input: unknown,
): Promise<void | { error: string }> {
  const user = await requireAdmin();

  const parsed = deletePositionSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const { id } = parsed.data;

  // Guard folded into the where so the check and the write are one atomic
  // statement — a separate count-then-write would race a concurrent submit.
  const deleteResult = await prisma.position.updateMany({
    where: {
      id,
      deletedAt: null,
      applications: { none: { deletedAt: null, status: { not: 'draft' } } },
    },
    data: { deletedAt: new Date(), deletedById: user.id },
  });

  if (deleteResult.count === 0) {
    const exists = await prisma.position.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    return {
      error: exists
        ? POSITION_DELETE_BLOCKED_ERROR
        : 'This position no longer exists.',
    };
  }

  revalidatePath('/positions');
  revalidatePath('/manage/positions');
  revalidatePath(`/positions/${id}`);
  revalidatePath(`/manage/positions/${id}/edit`);
  // Soft-deleting hides this position's applications everywhere.
  revalidatePath('/');
  revalidatePath('/my-applications');
  revalidatePath('/manage/applications');
}

export async function addPositionManager(
  input: unknown,
): Promise<ResponseType<PositionManager>> {
  const parsed = addPositionManagerSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const { positionId, email } = parsed.data;

  // Authenticate before the existence query — see updatePosition.
  await getCurrentUser();

  const exists = await prisma.position.findFirst({
    where: { id: positionId, deletedAt: null },
    select: { id: true },
  });
  if (!exists) return { error: 'This position no longer exists.' };

  const user = await requirePositionAccess(positionId);

  // A stale search result must not connect a deleted user via a raw P2025.
  const target = await prisma.user.findFirst({
    where: { email, deletedAt: null },
    select: { id: true, name: true, email: true },
  });
  if (!target) return { error: 'That user is no longer available.' };

  await prisma.position.update({
    where: { id: positionId },
    data: { managers: { connect: { id: target.id } }, updatedById: user.id },
  });

  // Membership also drives the manager's positions list and the /users columns.
  revalidatePath(`/manage/positions/${positionId}/edit`);
  revalidatePath('/positions');
  revalidatePath('/manage/positions');
  revalidatePath('/users');

  return target;
}

export async function removePositionManager(
  input: unknown,
): Promise<void | { error: string }> {
  const parsed = removePositionManagerSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const { positionId, userId } = parsed.data;

  // Authenticate before the existence query — see updatePosition.
  await getCurrentUser();

  const exists = await prisma.position.findFirst({
    where: { id: positionId, deletedAt: null },
    select: { id: true },
  });
  if (!exists) return { error: 'This position no longer exists.' };

  const user = await requirePositionAccess(positionId);

  // A manager may remove any other but never themselves; admins are exempt.
  if (userId === user.id && !user.isAdmin)
    return {
      error: 'You cannot remove yourself as a manager. Ask an admin to do it.',
    };

  await prisma.position.update({
    where: { id: positionId },
    data: { managers: { disconnect: { id: userId } }, updatedById: user.id },
  });

  // Membership also drives the manager's positions list and the /users columns.
  revalidatePath(`/manage/positions/${positionId}/edit`);
  revalidatePath('/positions');
  revalidatePath('/manage/positions');
  revalidatePath('/users');
}

const searchUsersSchema = z.object({ query: z.string().max(200) });

// Gated to managers/admins, matching its only consumer; id withheld until an add.
export async function searchUsers(
  input: unknown,
): Promise<ResponseType<UserSearchResult[]>> {
  await requireManagerOrAdmin();

  const parsed = searchUsersSchema.safeParse(input);
  if (!parsed.success) return { error: 'Search is limited to 200 characters.' };

  const { query } = parsed.data;

  if (!query.trim()) return [];

  const users = await prisma.user.findMany({
    where: {
      deletedAt: null,
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { email: { contains: query, mode: 'insensitive' } },
      ],
    },
    select: { name: true, email: true },
    take: 10,
  });

  return users.map((u) => ({
    displayName: displayUserName(u),
    primaryEmail: u.email,
  }));
}
