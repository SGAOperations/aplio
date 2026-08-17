'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';

import { auth } from '@/lib/auth/config';
import { getCurrentUser } from '@/lib/auth/server';
import type { ErrorType } from '@/lib/utils';

// Must not redirect(): awaited from an event handler, so it would look like a failure.
export async function signOutUser(): Promise<ErrorType | void> {
  await getCurrentUser();

  try {
    await auth.api.signOut({ headers: await headers() });
  } catch (error) {
    // The upstream cause is invisible to the browser, so log it here.
    console.error('signOutUser: signOut failed', error);
    return { error: 'Could not sign out. Please try again.' };
  }

  revalidatePath('/', 'layout');
}
