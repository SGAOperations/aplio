'use client';

import { useState } from 'react';

import type { GlobalAnswer, GlobalQuestion } from '@/prisma/client';

import { CONCEPT_ICONS } from '@/lib/icons';

import { ProfileQuestion } from '@/components/features/profile-question';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

interface ProfileFormProps {
  profileData: { question: GlobalQuestion; answer: GlobalAnswer | null }[];
}

export function ProfileForm({ profileData }: ProfileFormProps) {
  const [isEditing, setIsEditing] = useState(false);

  if (profileData.length === 0)
    return (
      <EmptyState
        icon={CONCEPT_ICONS.question}
        title="No profile questions yet"
        description="Questions added by an admin will appear here for you to answer."
      />
    );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-end">
        <Button
          variant={isEditing ? 'default' : 'outline'}
          size="sm"
          onClick={() => setIsEditing(!isEditing)}
        >
          {isEditing ? 'Done' : 'Edit'}
        </Button>
      </div>
      <div className="flex flex-col gap-4">
        {profileData.map(({ question, answer }) => (
          <ProfileQuestion
            key={question.id}
            question={question}
            answer={answer}
            isEditing={isEditing}
          />
        ))}
      </div>
    </div>
  );
}
