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

function authHeader(): { Authorization: string } {
  return { Authorization: `Bearer ${requireEnv('NEON_API_KEY')}` };
}

// The Neon Auth user directory is branch-scoped, and the API requires a `br-`-prefixed
// branch id — a branch name yields PLATFORM_BRANCH_NOT_FOUND.
//
// IMPORTANT: NEON_BRANCH_ID must identify the branch behind NEON_AUTH_BASE_URL, which
// is NOT necessarily the branch behind DATABASE_URL. neon-preview-branch.yml overrides
// only DATABASE_URL per PR, so a preview deployment reads Postgres from its own branch
// while authenticating against the shared auth directory. Provisioning an identity into
// any other branch's directory would leave the invitee unable to sign in — the original
// #239 bug, relocated. So this is a stable per-environment value, the same on preview
// as on the environment whose auth directory it shares.
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
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, ...(name ? { name } : {}) }),
  });

  if (response.status === 409 || response.status === 422)
    return { duplicate: true };

  // Status only — the provider's response body can echo the invitee's email, and it
  // adds nothing the status doesn't already say.
  if (!response.ok)
    throw new Error(
      `Neon Auth user creation failed (${response.status} ${response.statusText})`,
    );

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
// orphaned identities. Throws when the identity could not be removed — the caller is
// already handling an error, and this one supersedes it deliberately: a stranded Neon
// Auth identity is the more serious condition and must not be reported to the admin as
// a tidy duplicate-email message. 404 is success (nothing left to remove).
export async function deleteNeonAuthUser(authUserId: string): Promise<void> {
  const response = await fetch(
    `${authUsersUrl()}/${encodeURIComponent(authUserId)}`,
    { method: 'DELETE', headers: authHeader() },
  );
  if (!response.ok && response.status !== 404)
    throw new Error(
      `Neon Auth identity ${authUserId} orphaned — delete failed (${response.status} ${response.statusText})`,
    );
}
