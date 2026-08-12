import 'server-only';

import { notFound } from 'next/navigation';

import type { User } from '@/prisma/client';
import { checkPositionAccess, isManager } from '@/prisma/data/managers';

import { getCurrentUser } from '@/lib/auth/server';

// ── Authorization denial convention (#356) ──────────────────────────────────
// Two families, because the two call sites genuinely differ:
//   - Action guards (below) THROW. A denial in a server action is never
//     user-facing — the caller shows a generic toast, never the thrown
//     message (ENGINEERING §4 decision test: "would you show this exact
//     sentence to the user?" no → throw). Every migrated action's client
//     call site must wrap the call in try/catch for this reason.
//   - Page guards (`*Or404`) call `notFound()` instead. Every authenticated-
//     but-not-permitted page renders the same 404 — deliberately
//     indistinguishable from a genuine 404 (no existence leak, no silent
//     bounce to a page the caller never asked for).
// Unauthenticated callers never reach either family: getCurrentUser()
// (lib/auth/server.ts) redirects to /login (or /login/bypass) before a guard
// would run. Environment gates such as isBypassAllowed() are not
// authorization and are out of scope for this module.

// ─── Action guards — throw on denial, return the resolved caller ───────────

export async function requireAdmin(): Promise<User> {
  const user = await getCurrentUser();
  if (!user.isAdmin) throw new Error('Forbidden: admin required');
  return user;
}

// Admin, or manages at least one non-deleted position (one `count` query for
// non-admins — same cost as the inline `isManager` check it replaces).
export async function requireManagerOrAdmin(): Promise<User> {
  const user = await getCurrentUser();
  if (user.isAdmin || (await isManager(user.id))) return user;
  throw new Error('Forbidden: manager or admin required');
}

export async function requirePositionAccess(positionId: string): Promise<User> {
  const user = await getCurrentUser();
  if (!(await checkPositionAccess(positionId, user)))
    throw new Error(`Forbidden: no access to position ${positionId}`);
  return user;
}

// Synchronous — the caller has already fetched the record (typically to
// check other things, like a stale-link existence guard) and only needs the
// ownership claim verified. A null record denies too, so a caller that wants
// a distinct "no longer exists" message must check that itself first.
// Declared as a TS assertion function so callers narrow past `null` after
// this returns, without a redundant non-null check of their own.
export function requireOwnership<T extends { userId: string } | null>(
  record: T,
  userId: string,
): asserts record is NonNullable<T> {
  if (!record || record.userId !== userId)
    throw new Error('Forbidden: record not owned by caller');
}

// ─── Page guards — notFound() on denial, return the resolved caller ────────

export async function requireAdminOr404(): Promise<User> {
  const user = await getCurrentUser();
  if (!user.isAdmin) notFound();
  return user;
}

export async function requireManagerOrAdminOr404(): Promise<User> {
  const user = await getCurrentUser();
  if (user.isAdmin || (await isManager(user.id))) return user;
  notFound();
}

export async function requirePositionAccessOr404(
  positionId: string,
): Promise<User> {
  const user = await getCurrentUser();
  if (!(await checkPositionAccess(positionId, user))) notFound();
  return user;
}
