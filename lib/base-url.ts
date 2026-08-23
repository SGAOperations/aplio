// Server-side only — these vars are not NEXT_PUBLIC_, so this must never be imported client-side.
// Pinned in production because a wrong origin on the custom domain fails silently;
// derived elsewhere since VERCEL_URL changes every deployment.
export function getBaseUrl(): string {
  const raw =
    process.env.BETTER_AUTH_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '') ||
    'http://localhost:3000';
  return raw.replace(/\/+$/, '');
}
