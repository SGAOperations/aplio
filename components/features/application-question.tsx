'use client';

import { useRef, useTransition } from 'react';

import { createOrUpdateApplicationAnswer } from '@/prisma/actions/applications';
import type {
  GlobalAnswer,
  GlobalApplicationAnswer,
  GlobalQuestion,
  PositionApplicationAnswer,
  PositionQuestion,
} from '@/prisma/client';

import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';

interface ApplicationQuestionProps {
  applicationId: string;
  question: GlobalQuestion | PositionQuestion;
  answer: GlobalApplicationAnswer | PositionApplicationAnswer | null;
  profileAnswer: GlobalAnswer | null;
  readOnly: boolean;
  isGlobal: boolean;
  userId: string;
}

export function ApplicationQuestion({
  applicationId,
  question,
  answer,
  profileAnswer,
  readOnly,
  isGlobal,
  userId,
}: ApplicationQuestionProps) {
  const [isPending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string>(JSON.stringify(answer?.value ?? []));

  const currentValue = answer?.value ?? profileAnswer?.value ?? [];
  const options = question.options as string[];

  function save(value: string[]) {
    const serialized = JSON.stringify(value);
    if (serialized === lastSavedRef.current) return;
    lastSavedRef.current = serialized;

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

  function scheduleSave(value: string[]) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => save(value), 1500);
  }

  function handleTextBlur(newValue: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    save([newValue]);
  }

  if (readOnly) {
    const displayValue = profileAnswer?.value ?? [];
    return (
      <div className="flex flex-col gap-1.5">
        <Label>
          {question.label}
          {question.required && (
            <span className="text-destructive ml-0.5">*</span>
          )}
        </Label>
        {displayValue.length === 0 ? (
          <p className="text-muted-foreground text-sm italic">No answer</p>
        ) : question.type === 'multiple_choice' ? (
          <div className="flex flex-wrap gap-1.5">
            {displayValue.map((v) => (
              <span
                key={v}
                className="bg-muted text-muted-foreground rounded-md px-2 py-0.5 text-sm"
              >
                {v}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm">{displayValue[0]}</p>
        )}
      </div>
    );
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
          onChange={(e) => scheduleSave([e.target.value])}
          onBlur={(e) => handleTextBlur(e.target.value)}
          placeholder="Your answer"
        />
      )}

      {question.type === 'long_answer' && (
        <Textarea
          defaultValue={currentValue[0] ?? ''}
          onChange={(e) => scheduleSave([e.target.value])}
          onBlur={(e) => handleTextBlur(e.target.value)}
          placeholder="Your answer"
          className="min-h-[120px]"
        />
      )}

      {question.type === 'single_choice' && (
        <RadioGroup
          defaultValue={currentValue[0] ?? ''}
          onValueChange={(value) => scheduleSave([value])}
          className="flex flex-col gap-2"
        >
          {options.map((option) => (
            <div key={option} className="flex items-center gap-2">
              <RadioGroupItem value={option} id={`${question.id}-${option}`} />
              <Label
                htmlFor={`${question.id}-${option}`}
                className="cursor-pointer font-normal"
              >
                {option}
              </Label>
            </div>
          ))}
        </RadioGroup>
      )}

      {question.type === 'multiple_choice' && (
        <div className="flex flex-col gap-2">
          {options.map((option) => (
            <div key={option} className="flex items-center gap-2">
              <Checkbox
                id={`${question.id}-${option}`}
                defaultChecked={currentValue.includes(option)}
                onCheckedChange={(checked) => {
                  const next = checked
                    ? [...currentValue, option]
                    : currentValue.filter((v) => v !== option);
                  scheduleSave(next);
                }}
              />
              <Label
                htmlFor={`${question.id}-${option}`}
                className="cursor-pointer font-normal"
              >
                {option}
              </Label>
            </div>
          ))}
        </div>
      )}

      {isPending && (
        <span className="text-muted-foreground text-xs">Saving...</span>
      )}
    </div>
  );
}
