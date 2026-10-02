'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';

import { auth } from '@/lib/auth/config';
import { getCurrentUser, getIsBypass } from '@/lib/auth/server';
import { SLACK_PROVIDER_ID } from '@/lib/constants';
import { prisma } from '@/lib/prisma';
import { isSlackConfigured } from '@/lib/slack/config';
import { type ConnectSlackResult } from '@/lib/types';
import { type ResponseType } from '@/lib/utils';

export async function connectSlack(): Promise<
  ResponseType<ConnectSlackResult>
> {
  const user = await getCurrentUser();
  // The UI hides the card when Slack isn't configured, so this is unreachable.
  if (!isSlackConfigured()) throw new Error('Slack is not configured');

  if (await getIsBypass())
    return { error: "Slack can't be connected while using a bypass sign-in." };

  const existing = await prisma.slackConnection.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });
  if (existing) {
    revalidatePath('/profile');
    return { status: 'connected' };
  }

  // Guards against drift: a leftover row would send Better Auth down its
  // update-only path and skip completeSlackLink.
  await prisma.account.deleteMany({
    where: { userId: user.id, providerId: SLACK_PROVIDER_ID },
  });

  const result = await auth.api.linkSocialAccount({
    headers: await headers(),
    body: {
      provider: SLACK_PROVIDER_ID,
      callbackURL: '/profile',
      errorCallbackURL: '/profile?slack=error',
      disableRedirect: true,
    },
  });

  return { status: 'redirect', url: result.url };
}

export async function disconnectSlack(): Promise<void> {
  const user = await getCurrentUser();

  await prisma.$transaction(async (tx) => {
    await tx.slackConnection.deleteMany({ where: { userId: user.id } });
    await tx.account.deleteMany({
      where: { userId: user.id, providerId: SLACK_PROVIDER_ID },
    });
  });

  revalidatePath('/profile');
}
