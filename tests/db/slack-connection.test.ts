import { cleanupFixtures, createTestUser } from '@/tests/helpers/fixtures';
import { actAs } from '@/tests/stubs/auth-server';
import { randomUUID } from 'node:crypto';
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { User } from '@/prisma/client';

import { SLACK_CONNECT_ERROR, SLACK_PROVIDER_ID } from '@/lib/constants';
import { prisma } from '@/lib/prisma';

const mockLinkSocialAccount = vi.fn();

vi.mock('@/lib/auth/config', () => ({
  auth: {
    api: {
      linkSocialAccount: (...args: unknown[]) => mockLinkSocialAccount(...args),
    },
  },
}));

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }));

const { completeSlackLink, validateSlackLink } =
  await import('@/lib/auth/slack-link');
const { connectSlack, disconnectSlack } =
  await import('@/prisma/actions/slack');

const TEAM_ID = 'T_TEST_TEAM';

async function createSlackAccountRow(user: User): Promise<string> {
  const account = await prisma.account.create({
    data: {
      userId: user.id,
      providerId: SLACK_PROVIDER_ID,
      accountId: `slack-${randomUUID()}`,
      issuer: `local:${SLACK_PROVIDER_ID}`,
    },
  });
  return account.id;
}

afterAll(async () => {
  await cleanupFixtures();
});

describe('validateSlackLink', () => {
  beforeEach(() => {
    vi.stubEnv('SLACK_TEAM_ID', TEAM_ID);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns void for a non-oauth source', async () => {
    const result = await validateSlackLink({
      user: { id: 'user-1' },
      source: { method: 'email-otp', action: 'sign-in' },
    });
    expect(result).toBeUndefined();
  });

  it('returns void for an oauth source from a different provider', async () => {
    const result = await validateSlackLink({
      user: { id: 'user-1' },
      source: {
        method: 'oauth',
        action: 'link-account',
        oauth: { providerId: 'google' },
      },
    });
    expect(result).toBeUndefined();
  });

  it('rejects a Slack sign-in action', async () => {
    const result = await validateSlackLink({
      user: { id: 'user-1' },
      source: {
        method: 'oauth',
        action: 'sign-in',
        oauth: {
          providerId: SLACK_PROVIDER_ID,
          profile: { sub: 'U1', teamId: TEAM_ID },
        },
      },
    });
    expect(result).toEqual({ error: SLACK_CONNECT_ERROR.signInDisabled });
  });

  it('rejects a mismatched workspace and writes no row', async () => {
    const user = await createTestUser();
    const result = await validateSlackLink({
      user: { id: user.id },
      source: {
        method: 'oauth',
        action: 'link-account',
        oauth: {
          providerId: SLACK_PROVIDER_ID,
          profile: { sub: 'U-wrong-team', teamId: 'T_OTHER' },
        },
      },
    });
    expect(result).toEqual({ error: SLACK_CONNECT_ERROR.wrongWorkspace });

    const row = await prisma.slackConnection.findUnique({
      where: { userId: user.id },
    });
    expect(row).toBeNull();
  });

  it('rejects a Slack account already linked to a different user', async () => {
    const owner = await createTestUser();
    const other = await createTestUser();
    const slackUserId = `U-${randomUUID()}`;
    await prisma.slackConnection.create({
      data: { userId: owner.id, slackUserId, slackTeamId: TEAM_ID },
    });

    const result = await validateSlackLink({
      user: { id: other.id },
      source: {
        method: 'oauth',
        action: 'link-account',
        oauth: {
          providerId: SLACK_PROVIDER_ID,
          profile: { sub: slackUserId, teamId: TEAM_ID },
        },
      },
    });
    expect(result).toEqual({ error: SLACK_CONNECT_ERROR.alreadyLinked });
  });

  it('allows a same-user re-link', async () => {
    const user = await createTestUser();
    const slackUserId = `U-${randomUUID()}`;
    await prisma.slackConnection.create({
      data: { userId: user.id, slackUserId, slackTeamId: TEAM_ID },
    });

    const result = await validateSlackLink({
      user: { id: user.id },
      source: {
        method: 'oauth',
        action: 'link-account',
        oauth: {
          providerId: SLACK_PROVIDER_ID,
          profile: { sub: slackUserId, teamId: TEAM_ID },
        },
      },
    });
    expect(result).toBeUndefined();
  });
});

describe('completeSlackLink', () => {
  beforeEach(() => {
    vi.stubEnv('SLACK_TEAM_ID', TEAM_ID);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('creates the SlackConnection row and deletes the Account row', async () => {
    const user = await createTestUser();
    const slackUserId = `U-${randomUUID()}`;
    const accountId = await createSlackAccountRow(user);

    await completeSlackLink({
      id: accountId,
      userId: user.id,
      accountId: slackUserId,
      providerId: SLACK_PROVIDER_ID,
    });

    const connection = await prisma.slackConnection.findUnique({
      where: { userId: user.id },
    });
    expect(connection?.slackUserId).toBe(slackUserId);
    expect(connection?.slackTeamId).toBe(TEAM_ID);

    const account = await prisma.account.findUnique({
      where: { id: accountId },
    });
    expect(account).toBeNull();
  });

  it('upserts without error on a second call', async () => {
    const user = await createTestUser();
    const slackUserId = `U-${randomUUID()}`;
    const firstAccountId = await createSlackAccountRow(user);

    await completeSlackLink({
      id: firstAccountId,
      userId: user.id,
      accountId: slackUserId,
      providerId: SLACK_PROVIDER_ID,
    });

    const secondAccountId = await createSlackAccountRow(user);
    await expect(
      completeSlackLink({
        id: secondAccountId,
        userId: user.id,
        accountId: slackUserId,
        providerId: SLACK_PROVIDER_ID,
      }),
    ).resolves.toBeUndefined();

    const connections = await prisma.slackConnection.findMany({
      where: { userId: user.id },
    });
    expect(connections).toHaveLength(1);
  });
});

describe('connectSlack', () => {
  beforeEach(() => {
    vi.stubEnv('SLACK_CLIENT_ID', 'client-id');
    vi.stubEnv('SLACK_CLIENT_SECRET', 'client-secret');
    vi.stubEnv('SLACK_TEAM_ID', TEAM_ID);
    mockLinkSocialAccount.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns connected and never calls linkSocialAccount when already connected', async () => {
    const user = await createTestUser();
    actAs(user);
    await prisma.slackConnection.create({
      data: {
        userId: user.id,
        slackUserId: `U-${randomUUID()}`,
        slackTeamId: TEAM_ID,
      },
    });

    const result = await connectSlack();

    expect(result).toEqual({ status: 'connected' });
    expect(mockLinkSocialAccount).not.toHaveBeenCalled();
  });

  it('returns the redirect url and clears a stale Slack Account row when not connected', async () => {
    const user = await createTestUser();
    actAs(user);
    await createSlackAccountRow(user);
    mockLinkSocialAccount.mockResolvedValue({
      url: 'https://slack.com/openid/connect/authorize?state=abc',
      redirect: false,
    });

    const result = await connectSlack();

    expect(result).toEqual({
      status: 'redirect',
      url: 'https://slack.com/openid/connect/authorize?state=abc',
    });
    expect(mockLinkSocialAccount).toHaveBeenCalledOnce();

    const staleAccounts = await prisma.account.findMany({
      where: { userId: user.id, providerId: SLACK_PROVIDER_ID },
    });
    expect(staleAccounts).toHaveLength(0);
  });
});

describe('disconnectSlack', () => {
  it('deletes the row, and a repeat call succeeds', async () => {
    const user = await createTestUser();
    actAs(user);
    await prisma.slackConnection.create({
      data: {
        userId: user.id,
        slackUserId: `U-${randomUUID()}`,
        slackTeamId: TEAM_ID,
      },
    });

    await disconnectSlack();
    const row = await prisma.slackConnection.findUnique({
      where: { userId: user.id },
    });
    expect(row).toBeNull();

    await expect(disconnectSlack()).resolves.toBeUndefined();
  });
});

describe('SlackConnection cascade', () => {
  it('is deleted when the owning user is hard-deleted', async () => {
    const user = await createTestUser();
    const connection = await prisma.slackConnection.create({
      data: {
        userId: user.id,
        slackUserId: `U-${randomUUID()}`,
        slackTeamId: TEAM_ID,
      },
    });

    await prisma.user.delete({ where: { id: user.id } });

    const row = await prisma.slackConnection.findUnique({
      where: { id: connection.id },
    });
    expect(row).toBeNull();
  });
});
