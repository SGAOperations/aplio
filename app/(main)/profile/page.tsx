import type { Metadata } from 'next';

import { getProfileData } from '@/prisma/data/profile';

import { getCurrentUser } from '@/lib/auth/server';

import { ProfileForm } from '@/components/features/profile-form';
import { PageHeader } from '@/components/layouts/page-header';

export const metadata: Metadata = { title: 'Profile' };

export default async function ProfilePage() {
  const user = await getCurrentUser();
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
