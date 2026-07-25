'use server';

import { revalidatePath } from 'next/cache';

import { authServer, getCurrentUser } from '@/lib/auth/server';
import type { ErrorType } from '@/lib/utils';

// Signs out the current real (non-bypass) Neon Auth session.
// Sends the sign-out request server-side via authServer, which forwards the
// session cookie through next/headers — avoiding the browser SameSite/CSRF
// fragility that caused the 403 when sign-out was driven client-side.
//
// Deliberately does NOT call redirect() here: this action is invoked via a
// raw `await` from a client event handler (components/layouts/user-menu.tsx),
// not a <form action> / useActionState. Next's server-action-reducer rejects
// the CALLING promise whenever an action redirects (the rejection is meant to
// be caught by a RedirectBoundary during a form/useActionState dispatch —
// there is none here), so a redirect() call here would make every successful
// sign-out look like a thrown, unhandled failure to the caller. The caller
// navigates client-side after a successful (non-error) result instead.
export async function signOutUser(): Promise<ErrorType | void> {
  const user = await getCurrentUser();
  // getCurrentUser() always redirects when unauthenticated; this throw is defense-in-depth.
  if (!user) throw new Error('Unauthenticated');

  const result = await authServer.signOut();

  if (result.error) {
    // Nothing previously logged the underlying failure, so a genuine upstream
    // error (e.g. a Neon Auth trusted-origin rejection) was invisible in both
    // the browser console and server logs. Log the real cause server-side.
    console.error('signOutUser: authServer.signOut() failed', result.error);
    return { error: 'Could not sign out. Please try again.' };
  }

  revalidatePath('/', 'layout');
}
