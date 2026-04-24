import { getProfileData } from '@/prisma/data/profile';

import { getCurrentUser } from '@/lib/auth/server';

import { ProfileQuestion } from '@/components/features/profile-question';

export default async function ProfilePage() {
  const user = await getCurrentUser();
  const profileData = await getProfileData(user.id);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
      <div className="flex flex-col gap-4">
        {profileData.map(({ question, answer }) => (
          <ProfileQuestion
            key={question.id}
            question={question}
            answer={answer}
            userId={user.id}
            isEditing={false}
          />
        ))}
      </div>
    </div>
  );
}
