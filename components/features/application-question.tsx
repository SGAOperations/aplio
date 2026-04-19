'use client';

import { useTransition } from 'react';

import { createOrUpdateApplicationAnswer } from '@/prisma/actions/applications';
import type {
  GlobalApplicationAnswer,
  GlobalQuestion,
  PositionApplicationAnswer,
  PositionQuestion,
} from '@/prisma/client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface ApplicationQuestionProps {
  applicationId: string;
  question: GlobalQuestion | PositionQuestion;
  answer: GlobalApplicationAnswer | PositionApplicationAnswer | null;
  isGlobal: boolean;
  userId: string;
}

export function ApplicationQuestion({
  applicationId,
  question,
  answer,
  isGlobal,
  userId,
}: ApplicationQuestionProps) {
  const [isPending, startTransition] = useTransition();

  const currentValue = answer?.value ?? [];

  function save(value: string[]) {
    startTransition(async () => {
      await createOrUpdateApplicationAnswer({
        applicationId,
        questionId: question.id,
        questionLabel: question.label,
        value,
        isGlobal,
        userId,
      });
    });
  }

  function handleTextChange(newValue: string) {
    save([newValue]);
  }

  function handleRadioChange(option: string) {
    save([option]);
  }

  function handleCheckboxChange(option: string, checked: boolean) {
    const next = checked
      ? [...currentValue, option]
      : currentValue.filter((v: string) => v !== option);
    save(next);
  }

  return (
    <div className="flex flex-col gap-2">
      <Label className={isPending ? 'opacity-60' : ''}>
        {question.label}
        {question.required && (
          <span className="text-destructive ml-0.5">*</span>
        )}
      </Label>

      {question.type === 'short_answer' && (
        <Input
          defaultValue={currentValue[0] ?? ''}
          onBlur={(e) => handleTextChange(e.target.value)}
          placeholder="Your answer"
        />
      )}

      {question.type === 'long_answer' && (
        <Textarea
          defaultValue={currentValue[0] ?? ''}
          onBlur={(e) => handleTextChange(e.target.value)}
          placeholder="Your answer"
          className="min-h-[120px]"
        />
      )}

      {question.type === 'single_choice' && (
        <div className="flex flex-col gap-2">
          {(question.options as string[]).map((option) => (
            <label
              key={option}
              className="flex cursor-pointer items-center gap-2 text-sm"
            >
              <input
                type="radio"
                name={`question-${question.id}`}
                value={option}
                defaultChecked={currentValue[0] === option}
                onChange={() => handleRadioChange(option)}
                className="accent-primary size-4"
              />
              {option}
            </label>
          ))}
        </div>
      )}

      {question.type === 'multiple_choice' && (
        <div className="flex flex-col gap-2">
          {(question.options as string[]).map((option) => (
            <label
              key={option}
              className="flex cursor-pointer items-center gap-2 text-sm"
            >
              <input
                type="checkbox"
                value={option}
                defaultChecked={currentValue.includes(option)}
                onChange={(e) => handleCheckboxChange(option, e.target.checked)}
                className="accent-primary size-4"
              />
              {option}
            </label>
          ))}
        </div>
      )}

      {isPending && (
        <span className="text-muted-foreground text-xs">Saving...</span>
      )}
    </div>
  );
}
