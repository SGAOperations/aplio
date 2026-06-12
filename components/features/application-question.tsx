'use client';

import { useRef, useState } from 'react';

import type { GlobalQuestion, PositionQuestion } from '@/prisma/client';

import { cn } from '@/lib/utils';

import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
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
  const [saveError, setSaveError] = useState(false);
  const savedValueRef = useRef(JSON.stringify(field.value));
  const options = Array.isArray(question.options)
    ? question.options.filter((o): o is string => typeof o === 'string')
    : [];

  async function save(value: string[]) {
    const serialized = JSON.stringify(value);
    if (serialized === savedValueRef.current) return;
    setIsSaving(true);
    setSaveError(false);
    try {
      await onSave(value);
      savedValueRef.current = serialized;
    } catch {
      setSaveError(true);
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
        <RadioGroup
          value={field.value[0] ?? ''}
          onValueChange={(value) => {
            field.onChange([value]);
            save([value]);
          }}
        >
          {options.map((option) => (
            <Label
              key={option}
              className="flex cursor-pointer items-center gap-2 font-normal"
            >
              <RadioGroupItem value={option} />
              {option}
            </Label>
          ))}
        </RadioGroup>
      )}

      {question.type === 'multiple_choice' && (
        <div className="flex flex-col gap-2">
          {options.map((option) => (
            <Label
              key={option}
              className="flex cursor-pointer items-center gap-2 font-normal"
            >
              <Checkbox
                checked={field.value.includes(option)}
                onCheckedChange={(checked) => {
                  const next = checked
                    ? [...field.value, option]
                    : field.value.filter((v) => v !== option);
                  field.onChange(next);
                  save(next);
                }}
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
      {saveError && (
        <p className="text-destructive mt-2 text-xs">
          Failed to save. Please try again.
        </p>
      )}
    </div>
  );
}
