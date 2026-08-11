'use client';

import { useRef, useState } from 'react';

import { toast } from 'sonner';

import type { QuestionType } from '@/prisma/client';

import { OTHER_OPTION_LABEL } from '@/lib/constants';
import { cn } from '@/lib/utils';

import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

type QuestionShape = {
  id: string;
  label: string;
  type: QuestionType;
  required: boolean;
  options: string[];
  allowOther: boolean;
};

interface ApplicationQuestionProps {
  question: QuestionShape;
  field: {
    value: string[];
    onChange: (value: string[]) => void;
    onBlur: () => void;
  };
  error?: string;
  onSave: (value: string[]) => Promise<void>;
}

export function ApplicationQuestion({
  question,
  field,
  error,
  onSave,
}: ApplicationQuestionProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const savedValueRef = useRef(JSON.stringify(field.value));
  const options = Array.isArray(question.options)
    ? question.options.filter((o): o is string => typeof o === 'string')
    : [];

  // Any answer value that isn't one of the admin-defined options is the
  // applicant's typed "Other" text (options is a closed set — see issue #322).
  const initialOtherValue = field.value.find((v) => !options.includes(v));
  const [otherSelected, setOtherSelected] = useState(
    initialOtherValue !== undefined,
  );
  const [otherText, setOtherText] = useState(initialOtherValue ?? '');

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
      toast.error('Failed to save answer');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleBlur() {
    field.onBlur();
    await save(field.value);
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
                checked={!otherSelected && field.value[0] === option}
                onChange={() => {
                  // Picking a real option hides the "Other" input and clears
                  // any previously typed text so it is never silently resubmitted.
                  setOtherSelected(false);
                  setOtherText('');
                  field.onChange([option]);
                  save([option]);
                }}
                className="accent-primary size-4"
              />
              {option}
            </Label>
          ))}

          {question.allowOther && (
            <>
              <Label className="flex cursor-pointer items-center gap-2 font-normal">
                <input
                  type="radio"
                  name={question.id}
                  value={OTHER_OPTION_LABEL}
                  checked={otherSelected}
                  onChange={() => {
                    setOtherSelected(true);
                    const next = otherText ? [otherText] : [];
                    field.onChange(next);
                    save(next);
                  }}
                  className="accent-primary size-4"
                />
                {OTHER_OPTION_LABEL}
              </Label>

              {otherSelected && (
                <div className="ml-6 flex flex-col gap-1">
                  <Label
                    htmlFor={`${question.id}-other`}
                    className="text-muted-foreground text-xs font-normal"
                  >
                    {OTHER_OPTION_LABEL}
                    {question.required && (
                      <span className="text-destructive ml-1">*</span>
                    )}
                  </Label>
                  <Input
                    id={`${question.id}-other`}
                    value={otherText}
                    onChange={(e) => {
                      setOtherText(e.target.value);
                      field.onChange(e.target.value ? [e.target.value] : []);
                    }}
                    onBlur={handleBlur}
                    placeholder="Type your answer"
                  />
                </div>
              )}
            </>
          )}
        </div>
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

          {question.allowOther && (
            <>
              <Label className="flex cursor-pointer items-center gap-2 font-normal">
                <Checkbox
                  checked={otherSelected}
                  onCheckedChange={(checked) => {
                    setOtherSelected(!!checked);
                    const checkedOptions = field.value.filter((v) =>
                      options.includes(v),
                    );
                    if (checked) {
                      const next = otherText
                        ? [...checkedOptions, otherText]
                        : checkedOptions;
                      field.onChange(next);
                      save(next);
                    } else {
                      // Uncheck removes the typed text from the saved array
                      // immediately so it isn't silently resubmitted.
                      setOtherText('');
                      field.onChange(checkedOptions);
                      save(checkedOptions);
                    }
                  }}
                />
                {OTHER_OPTION_LABEL}
              </Label>

              {otherSelected && (
                <div className="ml-6 flex flex-col gap-1">
                  <Label
                    htmlFor={`${question.id}-other`}
                    className="text-muted-foreground text-xs font-normal"
                  >
                    {OTHER_OPTION_LABEL}
                    {question.required && (
                      <span className="text-destructive ml-1">*</span>
                    )}
                  </Label>
                  <Input
                    id={`${question.id}-other`}
                    value={otherText}
                    onChange={(e) => {
                      setOtherText(e.target.value);
                      const checkedOptions = field.value.filter((v) =>
                        options.includes(v),
                      );
                      field.onChange(
                        e.target.value
                          ? [...checkedOptions, e.target.value]
                          : checkedOptions,
                      );
                    }}
                    onBlur={handleBlur}
                    placeholder="Type your answer"
                  />
                </div>
              )}
            </>
          )}
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
