import type { User } from '@/prisma/client';

// Alias target for @/lib/auth/server (db project only) — no session machinery,
// no headers/cookies. actAs sets the caller every guard/action resolves against.
let caller: User | null = null;

export function actAs(user: User | null): void {
  caller = user;
}

export async function getCurrentUser(): Promise<User> {
  if (!caller) throw new Error('REDIRECT: unauthenticated');
  return caller;
}

export async function getOptionalUser(): Promise<User | null> {
  return caller;
}

// No live-session concept in this stub — actAs(null) models "signed out",
// never "deactivated session", so this is always null.
export async function getDeactivatedSessionUser(): Promise<User | null> {
  return null;
}

export async function getIsBypass(): Promise<boolean> {
  return false;
}

export async function requireName(): Promise<void> {}
