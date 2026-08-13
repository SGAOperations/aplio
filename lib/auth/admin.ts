import 'server-only';

// authServer forwards the caller's Neon session cookie and authorizes on their Neon
// role — never admin here — so provisioning needs the app's own credential.

const NEON_API_BASE = 'https://console.neon.tech/api/v2';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function authHeader(): { Authorization: string } {
  return { Authorization: `Bearer ${requireEnv('NEON_API_KEY')}` };
}

// Must be the `br-`-prefixed id of the branch behind NEON_AUTH_BASE_URL, not DATABASE_URL:
// provisioning into the wrong branch's directory leaves the invitee unable to sign in.
function authUsersUrl(): string {
  const projectId = requireEnv('NEON_PROJECT_ID');
  const branchId = requireEnv('NEON_BRANCH_ID');
  return `${NEON_API_BASE}/projects/${projectId}/branches/${branchId}/auth/users`;
}

export type CreateNeonAuthUserResult = { id: string } | { duplicate: true };

// { duplicate: true } when the address already exists; throws otherwise, since no
// admin action can resolve a provider or network failure.
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

// Compensating cleanup for a failed app-row write. Throws deliberately over the error
// the caller is already handling: a stranded identity is the more serious condition.
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
