'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { authServer } from '@/lib/auth/server';
import type { ErrorType } from '@/lib/utils';

// Signs out the current real (non-bypass) Neon Auth session.
// Sends the sign-out request server-side via authServer, which forwards the
// session cookie through next/headers — avoiding the browser SameSite/CSRF
// fragility that caused the 403 when sign-out was driven client-side.
export async function signOutUser(): Promise<ErrorType | void> {
  const result = await authServer.signOut();

  if (result.error) return { error: 'Could not sign out. Please try again.' };

  revalidatePath('/', 'layout');
  redirect('/login');
}
