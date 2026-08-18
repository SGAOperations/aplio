import 'server-only';

import { notFound } from 'next/navigation';

import type { User } from '@/prisma/client';
import { checkPositionAccess, isManager } from '@/prisma/data/managers';

import { getCurrentUser, getOptionalUser } from '@/lib/auth/server';

// Action guards throw; page guards 404, so a denial never leaks existence.

// Predicate defined once, denial passed in, so a guard and its twin can't drift.
type Deny = () => never;

const denyWith =
  (message: string): Deny =>
  () => {
    throw new Error(message);
  };

async function resolveAdmin(deny: Deny): Promise<User> {
  const user = await getCurrentUser();
  if (!user.isAdmin) return deny();
  return user;
}

// Admin, or manages at least one non-deleted position.
async function resolveManagerOrAdmin(deny: Deny): Promise<User> {
  const user = await getCurrentUser();
  if (user.isAdmin || (await isManager(user.id))) return user;
  return deny();
}

async function resolvePositionAccess(
  positionId: string,
  deny: Deny,
): Promise<User> {
  const user = await getCurrentUser();
  if (!(await checkPositionAccess(positionId, user))) return deny();
  return user;
}

// ─── Action guards — throw on denial, return the resolved caller ───────────

export async function requireAdmin(): Promise<User> {
  return resolveAdmin(denyWith('Forbidden: admin required'));
}

export async function requireManagerOrAdmin(): Promise<User> {
  return resolveManagerOrAdmin(
    denyWith('Forbidden: manager or admin required'),
  );
}

export async function requirePositionAccess(positionId: string): Promise<User> {
  return resolvePositionAccess(
    positionId,
    denyWith(`Forbidden: no access to position ${positionId}`),
  );
}

// A null record denies, so check "no longer exists" first if you want that message.
export function requireOwnership<T extends { userId: string } | null>(
  record: T,
  userId: string,
): asserts record is NonNullable<T> {
  if (!record || record.userId !== userId)
    throw new Error('Forbidden: record not owned by caller');
}

// ─── Page guards — notFound() on denial, return the resolved caller ────────

export async function requireAdminOr404(): Promise<User> {
  return resolveAdmin(notFound);
}

export async function requireManagerOrAdminOr404(): Promise<User> {
  return resolveManagerOrAdmin(notFound);
}

// Caller must scope the managers list to `deletedAt: null` and handle a miss.
export async function requireListedManagerOr404(
  managers: { id: string }[],
): Promise<User> {
  const user = await getCurrentUser();
  if (!user.isAdmin && !managers.some((manager) => manager.id === user.id))
    notFound();
  return user;
}

// Public-page twin of requireListedManagerOr404 — never forces auth, so an
// anonymous visitor and a signed-in non-manager get the identical 404 from the caller.
export async function getOptionalManagerAccess(
  managers: { id: string }[],
): Promise<{ user: User | null; canManage: boolean }> {
  const user = await getOptionalUser();
  const canManage =
    user !== null &&
    (user.isAdmin || managers.some((manager) => manager.id === user.id));
  return { user, canManage };
}
