import { redirect } from 'next/navigation';

import { getProfileData } from '@/prisma/services/global-answers';

import { authServer } from '@/lib/auth/server';
import prisma from '@/lib/prisma';

import { ProfileQuestion } from '@/components/features/profile-question';

export const metadata = { title: 'Profile' };

export default async function ProfilePage() {
  const { data: session } = await authServer.getSession();
  if (!session?.user) redirect('/handler/sign-in');

  const dbUser = await prisma.user.findUnique({
    where: { neonAuthId: session.user.id },
    select: { id: true },
  });
  if (!dbUser) redirect('/handler/sign-in');

  const questions = await getProfileData(dbUser.id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="text-muted-foreground text-sm">
          Your answers are saved automatically and pre-fill your applications.
        </p>
      </div>
      {questions.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No profile questions have been configured yet.
        </p>
      ) : (
        <div className="flex max-w-2xl flex-col gap-4">
          {questions.map((q) => (
            <ProfileQuestion
              key={q.id}
              id={q.id}
              label={q.label}
              type={q.type}
              required={q.required}
              options={q.options}
              value={q.value}
            />
          ))}
        </div>
      )}
    </div>
  );
}
