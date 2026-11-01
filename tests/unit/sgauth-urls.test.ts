import { describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ get: () => undefined })),
  headers: vi.fn(
    async () =>
      new Headers({
        host: 'aplio-staging.vercel.app',
        'x-forwarded-host': 'apply-dev.northeasternsga.com',
        'x-forwarded-proto': 'https',
      }),
  ),
}));

vi.mock('next/navigation', () => ({ redirect: vi.fn() }));

vi.mock('@nusgaops/sgauth/next', () => ({
  getServerSession: vi.fn(),
  loginUrl: (redirect: string) =>
    `https://auth-dev.northeasternsga.com/login?redirect=${encodeURIComponent(redirect)}`,
  logoutUrl: (redirect: string) =>
    `https://auth-dev.northeasternsga.com/logout?redirect=${encodeURIComponent(redirect)}`,
}));

vi.mock('@/lib/auth/session-hooks', () => ({ resolveSgauthUser: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma: {} }));

const { sgauthLoginUrl, sgauthSignUpUrl } = await import('@/lib/auth/server');

describe('SGAuth URLs', () => {
  it('returns to the origin the browser used', async () => {
    const url = new URL(await sgauthLoginUrl('/applications'));
    expect(url.searchParams.get('redirect')).toBe(
      'https://apply-dev.northeasternsga.com/applications',
    );
  });

  it('points sign-up at /sign-up with the same return URL', async () => {
    const url = new URL(await sgauthSignUpUrl('/positions/p1/apply'));
    expect(url.pathname).toBe('/sign-up');
    expect(url.searchParams.get('redirect')).toBe(
      'https://apply-dev.northeasternsga.com/positions/p1/apply',
    );
  });
});
