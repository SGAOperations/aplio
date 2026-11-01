import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const FIXTURE_USER = { id: 'user-1', deletedAt: null, name: 'Fixture User' };

class RedirectSignal extends Error {
  constructor(public target: string) {
    super(`REDIRECT:${target}`);
  }
}

const mockFindUnique = vi.fn();
const mockGetSession = vi.fn();
let cookieValue: string | undefined;

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) =>
      name === 'dev-bypass-user-id' && cookieValue
        ? { value: cookieValue }
        : undefined,
  })),
  headers: vi.fn(async () => new Headers()),
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn((target: string) => {
    throw new RedirectSignal(target);
  }),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: (...args: unknown[]) => mockFindUnique(...args) },
  },
}));

vi.mock('@nusgaops/sgauth/next', () => ({
  getServerSession: () => mockGetSession(),
  loginUrl: (redirect: string) =>
    `https://auth.test/login?redirect=${redirect}`,
  logoutUrl: () => 'https://auth.test/logout',
}));

vi.mock('@/lib/auth/session-hooks', () => ({ resolveSgauthUser: vi.fn() }));

const { getCurrentUser, getIsBypass, getOptionalUser } =
  await import('@/lib/auth/server');

describe('dev-bypass cookie consumer', () => {
  beforeEach(() => {
    cookieValue = FIXTURE_USER.id;
    mockFindUnique.mockReset().mockResolvedValue(FIXTURE_USER);
    mockGetSession.mockReset().mockResolvedValue(null);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe.each(['undefined', 'production', 'preview'] as const)(
    'when VERCEL_ENV is %s on a deployment (bypass disallowed)',
    (envValue) => {
      beforeEach(() => {
        vi.stubEnv('NODE_ENV', 'production');
        vi.stubEnv('ALLOW_DEV_BYPASS', undefined);
        vi.stubEnv(
          'VERCEL_ENV',
          envValue === 'undefined' ? undefined : envValue,
        );
      });

      it('getIsBypass is false', async () => {
        expect(await getIsBypass()).toBe(false);
      });

      it('getOptionalUser ignores the forged cookie', async () => {
        expect(await getOptionalUser()).toBeNull();
        expect(mockFindUnique).not.toHaveBeenCalled();
      });

      it('getCurrentUser redirects to SGAuth sign-in', async () => {
        await expect(getCurrentUser()).rejects.toThrow(
          'REDIRECT:https://auth.test/login',
        );
      });
    },
  );

  describe.each([
    ['local development', 'development', 'development', undefined],
    ['an opted-in preview', 'production', 'preview', '1'],
  ] as const)('on %s (bypass allowed)', (_label, nodeEnv, vercelEnv, flag) => {
    beforeEach(() => {
      vi.stubEnv('NODE_ENV', nodeEnv);
      vi.stubEnv('VERCEL_ENV', vercelEnv);
      vi.stubEnv('ALLOW_DEV_BYPASS', flag);
    });

    it('getIsBypass is true', async () => {
      expect(await getIsBypass()).toBe(true);
    });

    it('getOptionalUser returns the cookie user', async () => {
      expect(await getOptionalUser()).toEqual(FIXTURE_USER);
    });

    it('getCurrentUser redirects to /login/bypass with no cookie', async () => {
      cookieValue = undefined;
      mockFindUnique.mockResolvedValue(null);
      await expect(getCurrentUser()).rejects.toThrow('REDIRECT:/login/bypass');
    });
  });
});
