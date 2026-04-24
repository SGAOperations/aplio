'use client';

import { useState } from 'react';

import type { GlobalAnswer, GlobalQuestion } from '@/prisma/client';

import { Button } from '@/components/ui/button';

import { ProfileQuestion } from '@/components/features/profile-question';

interface ProfileFormProps {
  profileData: { question: GlobalQuestion; answer: GlobalAnswer | null }[];
  userId: string;
}

export function ProfileForm({ profileData, userId }: ProfileFormProps) {
  const [isEditing, setIsEditing] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        <Button variant={isEditing ? 'default' : 'outline'} size="sm" onClick={() => setIsEditing(!isEditing)}>
          {isEditing ? 'Done' : 'Edit'}
        </Button>
      </div>
      <div className="flex flex-col gap-4">
        {profileData.map(({ question, answer }) => (
          <ProfileQuestion
            key={question.id}
            question={question}
            answer={answer}
            userId={userId}
            isEditing={isEditing}
          />
        ))}
      </div>
    </div>
  );
}
