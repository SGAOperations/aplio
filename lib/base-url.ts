// Server-side only (not NEXT_PUBLIC_). Pinned in production; derived
// elsewhere since VERCEL_URL changes per deployment.
export function getBaseUrl(): string {
  const raw =
    process.env.BETTER_AUTH_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '') ||
    'http://localhost:3000';
  return raw.replace(/\/+$/, '');
}
