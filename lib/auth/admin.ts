import 'server-only';

// Neon control-plane client for Neon Auth user provisioning.
//
// Deliberately separate from lib/auth/server.ts: `authServer` holds no credential of
// its own and authenticates by forwarding the inbound request's Neon Auth session
// cookie, so its admin/* endpoints authorize on the *caller's* Neon Auth role. That
// role is always the default "user" here (this app tracks admin status in
// User.isAdmin, which Neon knows nothing about), so authServer.admin.createUser
// returns 403 — and 401 under the dev-bypass login, which sets no Neon cookie at all.
//
// This module carries the app's own credential instead, so provisioning never depends
// on who is signed in and works identically under bypass login. Authorization stays
// where it already lives: the calling server action checks User.isAdmin.
//
// Same shape as lib/email/resend.ts — server-only, env read lazily so a missing var
// surfaces at call time rather than breaking builds or unrelated routes.

const NEON_API_BASE = 'https://console.neon.tech/api/v2';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

// The Neon Auth user directory is branch-scoped, so NEON_BRANCH_ID differs per
// environment (production branch vs. the per-PR preview branch).
function authUsersUrl(): string {
  const projectId = requireEnv('NEON_PROJECT_ID');
  const branchId = requireEnv('NEON_BRANCH_ID');
  return `${NEON_API_BASE}/projects/${projectId}/branches/${branchId}/auth/users`;
}

export type CreateNeonAuthUserResult = { id: string } | { duplicate: true };

// Creates the Neon Auth identity so the invitee can sign in via the normal email
// OTP flow. Returns { duplicate: true } when the address already exists (the caller
// turns that into a user-facing message); throws for anything else, since no admin
// action can resolve a provider or network failure.
export async function createNeonAuthUser({
  email,
  name,
}: {
  email: string;
  name?: string;
}): Promise<CreateNeonAuthUserResult> {
  const response = await fetch(authUsersUrl(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${requireEnv('NEON_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, ...(name ? { name } : {}) }),
  });

  if (response.status === 409 || response.status === 422)
    return { duplicate: true };

  if (!response.ok) {
    // Log the real status — the provider message is never surfaced to the user, and
    // without this the failure is indistinguishable from a silent no-op.
    const detail = await response.text().catch(() => '');
    console.error(
      `[neon-auth] create user failed: ${response.status} ${response.statusText} ${detail}`,
    );
    throw new Error(`Neon Auth user creation failed (${response.status})`);
  }

  const data: unknown = await response.json().catch(() => null);
  const id =
    data && typeof data === 'object' && 'id' in data
      ? (data as { id: unknown }).id
      : undefined;
  if (typeof id !== 'string' || !id)
    throw new Error('Neon Auth user creation returned no id');

  return { id };
}

// Compensating cleanup for a failed app-row write, so a retry doesn't accumulate
// orphaned identities. Never throws: it runs while another error is already being
// surfaced, and masking that error would hide the real failure. 404 is success here
// (nothing left to remove).
export async function deleteNeonAuthUser(authUserId: string): Promise<void> {
  try {
    const response = await fetch(
      `${authUsersUrl()}/${encodeURIComponent(authUserId)}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${requireEnv('NEON_API_KEY')}` },
      },
    );
    if (!response.ok && response.status !== 404)
      console.error(
        `[neon-auth] orphaned identity ${authUserId} — delete failed: ${response.status} ${response.statusText}`,
      );
  } catch (error) {
    console.error(
      `[neon-auth] orphaned identity ${authUserId} — delete threw:`,
      error,
    );
  }
}
