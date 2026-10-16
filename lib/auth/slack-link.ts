import 'server-only';

import { z } from 'zod/v4';

import { SLACK_CONNECT_ERROR, SLACK_PROVIDER_ID } from '@/lib/constants';
import { prisma } from '@/lib/prisma';
import { requireSlackEnv } from '@/lib/slack/config';

const slackProfileSchema = z.object({ sub: z.string(), teamId: z.string() });

interface ValidateSlackLinkParams {
  user: { id?: string };
  source: {
    method: string;
    action: string;
    oauth?: { providerId: string; profile?: Record<string, unknown> };
  };
}

// Read-only — never throw for expected cases: Better Auth turns a throw into
// a generic validation_failed.
export async function validateSlackLink({
  user,
  source,
}: ValidateSlackLinkParams): Promise<{ error: string } | void> {
  if (
    source.method !== 'oauth' ||
    source.oauth?.providerId !== SLACK_PROVIDER_ID
  )
    return;

  if (source.action !== 'link-account')
    return { error: SLACK_CONNECT_ERROR.signInDisabled };

  const parsed = slackProfileSchema.safeParse(source.oauth.profile);
  if (!parsed.success) return { error: SLACK_CONNECT_ERROR.profileInvalid };

  if (parsed.data.teamId !== process.env.SLACK_TEAM_ID)
    return { error: SLACK_CONNECT_ERROR.wrongWorkspace };

  const existing = await prisma.slackConnection.findUnique({
    where: { slackUserId: parsed.data.sub },
    select: { userId: true },
  });
  if (existing && existing.userId !== user.id)
    return { error: SLACK_CONNECT_ERROR.alreadyLinked };
}

interface CompletedAccount {
  id: string;
  userId: string;
  accountId: string;
  providerId: string;
}

// The upsert makes a repeat connect idempotent.
export async function completeSlackLink(
  account: CompletedAccount,
): Promise<void> {
  if (account.providerId !== SLACK_PROVIDER_ID) return;

  const slackTeamId = requireSlackEnv('SLACK_TEAM_ID');

  await prisma.$transaction(async (tx) => {
    await tx.slackConnection.upsert({
      where: { userId: account.userId },
      update: { slackUserId: account.accountId, slackTeamId },
      create: {
        userId: account.userId,
        slackUserId: account.accountId,
        slackTeamId,
      },
    });
    await tx.account.delete({ where: { id: account.id } });
  });
}
