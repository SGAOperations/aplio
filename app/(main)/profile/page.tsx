import type { Metadata } from 'next';
import { Suspense } from 'react';

import { getProfileCompleteness, getProfileData } from '@/prisma/data/profile';

import { sanitizeRedirectTo } from '@/lib/auth/redirect';
import { getCurrentUser, requireName } from '@/lib/auth/server';
import {
  SLACK_CONNECT_ERROR_MESSAGES,
  SLACK_CONNECT_GENERIC_MESSAGE,
} from '@/lib/constants';
import { isSlackConfigured } from '@/lib/slack/config';

import { ProfileForm } from '@/components/features/profile-form';
import { ProfileReturnBar } from '@/components/features/profile-return-bar';
import {
  SlackConnectionCard,
  SlackConnectionCardSkeleton,
} from '@/components/features/slack-connection-card';
import { PageHeader } from '@/components/layouts/page-header';

export const metadata: Metadata = { title: 'Profile' };

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await getCurrentUser();
  // Name gate — /profile sits outside app/(main)/(auth)/, so it isn't covered
  // by that layout's check. Name collection itself now lives on /login (see
  // app/login/page.tsx), so a nameless user must be sent there rather than
  // rendering this page.
  await requireName(user);
  const profileData = await getProfileData(user.id);

  const { redirectTo, slack, error } = await searchParams;
  const destination = sanitizeRedirectTo(redirectTo);
  const completeness = destination
    ? await getProfileCompleteness(user.id)
    : null;

  // error_description is never rendered — it's attacker-controllable.
  const callbackError =
    slack === 'error'
      ? ((error && SLACK_CONNECT_ERROR_MESSAGES[error]) ??
        SLACK_CONNECT_GENERIC_MESSAGE)
      : null;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Profile"
          description="Your answers are shared across every application."
        />
        {isSlackConfigured() && (
          <Suspense fallback={<SlackConnectionCardSkeleton />}>
            <SlackConnectionCard
              userId={user.id}
              callbackError={callbackError}
            />
          </Suspense>
        )}
        <ProfileForm profileData={profileData} />
        {destination && completeness && (
          <ProfileReturnBar
            destination={destination}
            completeness={completeness}
          />
        )}
      </div>
    </div>
  );
}
