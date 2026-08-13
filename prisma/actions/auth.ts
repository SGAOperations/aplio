'use server';

import { revalidatePath } from 'next/cache';

import { authServer, getCurrentUser } from '@/lib/auth/server';
import type { ErrorType } from '@/lib/utils';

// Must not redirect(): this is awaited from a client event handler rather than a
// form action, so the reducer's redirect rejection would surface as a failed sign-out.
export async function signOutUser(): Promise<ErrorType | void> {
  await getCurrentUser();

  const result = await authServer.signOut();

  if (result.error) {
    // The upstream cause (e.g. a trusted-origin rejection) is invisible to the
    // browser, so it has to be logged here.
    console.error('signOutUser: authServer.signOut() failed', result.error);
    return { error: 'Could not sign out. Please try again.' };
  }

  revalidatePath('/', 'layout');
}
