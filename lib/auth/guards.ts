import 'server-only';

import { notFound } from 'next/navigation';

import type { User } from '@/prisma/client';
import { checkPositionAccess, isManager } from '@/prisma/data/managers';

import { getCurrentUser } from '@/lib/auth/server';

// ── Authorization denial convention (#356) ──────────────────────────────────
// Codified in .claude/docs/ENGINEERING.md §3 — that doc is the source of
// truth; this comment is the implementation note. Two families, because the
// two call sites genuinely differ:
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

// Each rule's predicate is defined exactly once and takes its denial as a
// parameter, so an action guard and its `*Or404` page twin can never drift on
// *who* is allowed — only on what happens when they aren't.
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

// Admin, or manages at least one non-deleted position (one `count` query for
// non-admins — same cost as the inline `isManager` check it replaces).
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
  return resolveAdmin(notFound);
}

export async function requireManagerOrAdminOr404(): Promise<User> {
  return resolveManagerOrAdmin(notFound);
}

// Asserts the caller is an admin or appears in an ALREADY-FETCHED managers
// list — it performs no position lookup of its own, so it cannot tell whether
// that position still exists.
//
// PRECONDITION: the caller must have fetched `managers` from a query scoped
// with `deletedAt: null` (e.g. getPositionForEdit) and must handle the
// missing-position case itself before calling this. Deliberately not named
// `requirePosition*` — nothing here is position-aware.
//
// Prefer this over a second DB round-trip when the managers list is already
// in hand; there is no action-guard twin because no action fetches the list.
export async function requireListedManagerOr404(
  managers: { id: string }[],
): Promise<User> {
  const user = await getCurrentUser();
  if (!user.isAdmin && !managers.some((manager) => manager.id === user.id))
    notFound();
  return user;
}
