import type { Metadata } from 'next';

import { getProfileData } from '@/prisma/data/profile';

import { getCurrentUser, requireName } from '@/lib/auth/server';

import { ProfileForm } from '@/components/features/profile-form';
import { PageHeader } from '@/components/layouts/page-header';

export const metadata: Metadata = { title: 'Profile' };

export default async function ProfilePage() {
  const user = await getCurrentUser();
  // Name gate — /profile sits outside app/(main)/(auth)/, so it isn't covered
  // by that layout's check. Name collection itself now lives on /login (see
  // app/login/page.tsx), so a nameless user must be sent there rather than
  // rendering this page.
  await requireName(user);
  const profileData = await getProfileData(user.id);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Profile"
          description="Your answers are shared across every application."
        />
        <ProfileForm profileData={profileData} />
      </div>
    </div>
  );
}
