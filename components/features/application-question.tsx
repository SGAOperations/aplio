'use client';

import { useRef, useState } from 'react';

import type { GlobalQuestion, PositionQuestion } from '@/prisma/client';

import { cn } from '@/lib/utils';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface ApplicationQuestionProps {
  question: GlobalQuestion | PositionQuestion;
  field: {
    value: string[];
    onChange: (value: string[]) => void;
    onBlur: () => void;
  };
  isDirty: boolean;
  error?: string;
  onSave: (value: string[]) => Promise<void>;
}

export function ApplicationQuestion({
  question,
  field,
  isDirty,
  error,
  onSave,
}: ApplicationQuestionProps) {
  const [isSaving, setIsSaving] = useState(false);
  const savedValueRef = useRef(JSON.stringify(field.value));
  const options = question.options as string[];

  async function save(value: string[]) {
    const serialized = JSON.stringify(value);
    if (serialized === savedValueRef.current) return;
    setIsSaving(true);
    try {
      await onSave(value);
      savedValueRef.current = serialized;
    } finally {
      setIsSaving(false);
    }
  }

  function handleBlur() {
    field.onBlur();
    if (isDirty) save(field.value);
  }

  return (
    <div
      className={cn(
        'bg-card rounded-lg border p-4 shadow-sm',
        error && 'border-destructive',
      )}
    >
      <p className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
        {question.label}
        {question.required && <span className="text-destructive ml-1">*</span>}
      </p>

      {question.type === 'short_answer' && (
        <Input
          value={field.value[0] ?? ''}
          onChange={(e) =>
            field.onChange(e.target.value ? [e.target.value] : [])
          }
          onBlur={handleBlur}
          placeholder="Your answer"
        />
      )}

      {question.type === 'long_answer' && (
        <Textarea
          value={field.value[0] ?? ''}
          onChange={(e) =>
            field.onChange(e.target.value ? [e.target.value] : [])
          }
          onBlur={handleBlur}
          placeholder="Your answer"
          className="min-h-[120px]"
        />
      )}

      {question.type === 'single_choice' && (
        <div className="flex flex-col gap-2">
          {options.map((option) => (
            <Label
              key={option}
              className="flex cursor-pointer items-center gap-2 font-normal"
            >
              <input
                type="radio"
                name={question.id}
                value={option}
                checked={field.value[0] === option}
                onChange={() => {
                  field.onChange([option]);
                  save([option]);
                }}
                className="accent-primary size-4"
              />
              {option}
            </Label>
          ))}
        </div>
      )}

      {question.type === 'multiple_choice' && (
        <div className="flex flex-col gap-2">
          {options.map((option) => (
            <Label
              key={option}
              className="flex cursor-pointer items-center gap-2 font-normal"
            >
              <input
                type="checkbox"
                checked={field.value.includes(option)}
                onChange={() => {
                  const next = field.value.includes(option)
                    ? field.value.filter((v) => v !== option)
                    : [...field.value, option];
                  field.onChange(next);
                  save(next);
                }}
                className="accent-primary size-4"
              />
              {option}
            </Label>
          ))}
        </div>
      )}

      {error && <p className="text-destructive mt-2 text-xs">{error}</p>}
      {isSaving && (
        <span className="text-muted-foreground mt-2 block text-xs">
          Saving...
        </span>
      )}
    </div>
  );
}
