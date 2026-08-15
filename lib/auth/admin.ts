import 'server-only';

// authServer authorizes on the caller's Neon role (never admin), so this needs its own credential.

const NEON_API_BASE = 'https://console.neon.tech/api/v2';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function authHeader(): { Authorization: string } {
  return { Authorization: `Bearer ${requireEnv('NEON_API_KEY')}` };
}

// Must be the branch behind NEON_AUTH_BASE_URL, not DATABASE_URL, or the invitee can't sign in.
function authUsersUrl(): string {
  const projectId = requireEnv('NEON_PROJECT_ID');
  const branchId = requireEnv('NEON_BRANCH_ID');
  return `${NEON_API_BASE}/projects/${projectId}/branches/${branchId}/auth/users`;
}

export type CreateNeonAuthUserResult = { id: string } | { duplicate: true };

// { duplicate: true } on an existing address; throws otherwise — no admin action fixes that.
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

  // Status only: the response body can echo the invitee's email and adds nothing new.
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

// Compensating cleanup; throws deliberately — a stranded identity outranks the caller's error.
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
