'use server';

import { cookies } from 'next/headers';

// Clears the bypass session cookie without redirecting — called from the
// DeactivatedTeardown island so a deactivated bypass user can exit the loop.
// Hard no-op in production (ENGINEERING.md §3).
export async function clearBypassSession() {
  if (process.env.VERCEL_ENV === 'production') return;

  const cookieStore = await cookies();
  cookieStore.delete('dev-bypass-user-id');
}
