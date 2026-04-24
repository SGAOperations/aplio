import { getProfileData } from '@/prisma/data/profile';

import { getCurrentUser } from '@/lib/auth/server';

import { ProfileForm } from '@/components/features/profile-form';

export default async function ProfilePage() {
  const user = await getCurrentUser();
  const profileData = await getProfileData(user.id);

  return <ProfileForm profileData={profileData} userId={user.id} />;
}
