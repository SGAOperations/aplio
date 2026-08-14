'use server';

import { revalidatePath } from 'next/cache';

import { authServer, getCurrentUser } from '@/lib/auth/server';
import type { ErrorType } from '@/lib/utils';

// Must not redirect(): awaited from an event handler, so it would look like a failure.
export async function signOutUser(): Promise<ErrorType | void> {
  await getCurrentUser();

  const result = await authServer.signOut();

  if (result.error) {
    // The upstream cause is invisible to the browser, so log it here.
    console.error('signOutUser: authServer.signOut() failed', result.error);
    return { error: 'Could not sign out. Please try again.' };
  }

  revalidatePath('/', 'layout');
}
