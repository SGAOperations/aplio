'use client';

import { Controller, useForm, useWatch } from 'react-hook-form';

import { updateGlobalAnswer } from '@/prisma/actions/profile';
import type { GlobalAnswer, GlobalQuestion } from '@/prisma/client';

import { ActionError, isError } from '@/lib/utils';

import { AnswerCard } from '@/components/features/answer-card';
import { AnswerDisplay } from '@/components/features/answer-display';
import { AnswerEditor } from '@/components/features/answer-editor';

interface ProfileQuestionProps {
  question: GlobalQuestion;
  answer: GlobalAnswer | null;
  isEditing: boolean;
}

export function ProfileQuestion({
  question,
  answer,
  isEditing,
}: ProfileQuestionProps) {
  const initialValue = Array.isArray(answer?.value) ? answer.value : [];
  const { control, reset } = useForm<{ value: string[] }>({
    defaultValues: { value: initialValue },
  });
  const value = useWatch({ control, name: 'value' });
  const fileTarget = { scope: 'profile' as const, questionId: question.id };

  if (!isEditing)
    return (
      <AnswerCard question={question}>
        <AnswerDisplay
          question={question}
          value={value}
          fileTarget={fileTarget}
        />
      </AnswerCard>
    );

  return (
    <Controller
      control={control}
      name="value"
      render={({ field }) => (
        <AnswerEditor
          question={question}
          field={field}
          fileTarget={fileTarget}
          onSave={async (v) => {
            const result = await updateGlobalAnswer(question.id, v);
            if (isError(result)) throw new ActionError(result.error);
          }}
          onSaved={(v) => reset({ value: v })}
        />
      )}
    />
  );
}
