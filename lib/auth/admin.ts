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

// ── Branch resolution ────────────────────────────────────────────────────────────
// The Neon Auth user directory is branch-scoped and the API requires a `br-`-prefixed
// branch *id* — passing a name yields PLATFORM_BRANCH_NOT_FOUND. NEON_BRANCH accepts
// either, so a name is looked up once and cached. That keeps preview deployments
// zero-config: their branch id changes every PR, but the name is derivable from
// Vercel's git ref, matching how neon-preview-branch.yml names the branch.

interface NeonBranchSummary {
  id: string;
  name: string;
}

let cachedBranchId: string | null = null;

function configuredBranch(): string {
  const explicit = process.env.NEON_BRANCH;
  if (explicit) return explicit;

  const gitRef = process.env.VERCEL_GIT_COMMIT_REF;
  if (process.env.VERCEL_ENV === 'preview' && gitRef)
    return `preview/${gitRef}`;

  throw new Error('NEON_BRANCH is not configured');
}

function parseBranches(data: unknown): NeonBranchSummary[] {
  if (!data || typeof data !== 'object' || !('branches' in data)) return [];
  const raw = (data as { branches: unknown }).branches;
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (branch): branch is NeonBranchSummary =>
      !!branch &&
      typeof branch === 'object' &&
      typeof (branch as { id?: unknown }).id === 'string' &&
      typeof (branch as { name?: unknown }).name === 'string',
  );
}

async function resolveBranchId(): Promise<string> {
  if (cachedBranchId) return cachedBranchId;

  const branch = configuredBranch();
  if (branch.startsWith('br-')) {
    cachedBranchId = branch;
    return branch;
  }

  const url = `${NEON_API_BASE}/projects/${requireEnv('NEON_PROJECT_ID')}/branches?search=${encodeURIComponent(branch)}`;
  const response = await fetch(url, { headers: authHeader() });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    console.error(
      `[neon-auth] branch lookup failed: ${response.status} ${response.statusText} ${detail}`,
    );
    throw new Error(`Neon branch lookup failed (${response.status})`);
  }

  // `search` is a fuzzy match over name and id, so match the name exactly — a
  // prefix collision (preview/239 vs preview/239-foo) would otherwise pick wrongly.
  const match = parseBranches(await response.json().catch(() => null)).find(
    (candidate) => candidate.name === branch,
  );
  if (!match) throw new Error(`Neon branch "${branch}" not found`);

  cachedBranchId = match.id;
  return match.id;
}

async function authUsersUrl(): Promise<string> {
  const projectId = requireEnv('NEON_PROJECT_ID');
  const branchId = await resolveBranchId();
  return `${NEON_API_BASE}/projects/${projectId}/branches/${branchId}/auth/users`;
}

// ── User provisioning ────────────────────────────────────────────────────────────

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
  const response = await fetch(await authUsersUrl(), {
    method: 'POST',
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
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
      `${await authUsersUrl()}/${encodeURIComponent(authUserId)}`,
      { method: 'DELETE', headers: authHeader() },
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
