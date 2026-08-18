import type { Metadata } from 'next';

import { getProfileCompleteness, getProfileData } from '@/prisma/data/profile';

import { sanitizeRedirectTo } from '@/lib/auth/redirect';
import { getCurrentUser, requireName } from '@/lib/auth/server';

import { ProfileForm } from '@/components/features/profile-form';
import { ProfileReturnBar } from '@/components/features/profile-return-bar';
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

  const { redirectTo } = await searchParams;
  const destination = sanitizeRedirectTo(redirectTo);
  const completeness = destination
    ? await getProfileCompleteness(user.id)
    : null;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Profile"
          description="Your answers are shared across every application."
        />
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
