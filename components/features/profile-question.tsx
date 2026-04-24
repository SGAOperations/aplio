'use client';

import { useRef, useState } from 'react';

import { updateGlobalAnswer } from '@/prisma/actions/profile';
import type { GlobalAnswer, GlobalQuestion } from '@/prisma/client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface ProfileQuestionProps {
  question: GlobalQuestion;
  answer: GlobalAnswer | null;
  userId: string;
  isEditing: boolean;
}

export function ProfileQuestion({
  question,
  answer,
  userId,
  isEditing,
}: ProfileQuestionProps) {
  const initial = answer?.value ?? [];
  const [currentValue, setCurrentValue] = useState<string[]>(initial);
  const [savedValue, setSavedValue] = useState<string[]>(initial);
  const savingRef = useRef(false);
  const pendingValueRef = useRef<string[] | null>(null);

  async function autosave(newValue: string[]) {
    if (JSON.stringify(newValue) === JSON.stringify(savedValue)) return;
    if (savingRef.current) {
      pendingValueRef.current = newValue;
      return;
    }
    savingRef.current = true;
    pendingValueRef.current = null;
    try {
      await updateGlobalAnswer(userId, question.id, newValue);
      setSavedValue(newValue);
    } catch {
      // silent — autosave is best-effort
    } finally {
      savingRef.current = false;
      const pending = pendingValueRef.current;
      if (pending !== null) {
        pendingValueRef.current = null;
        autosave(pending);
      }
    }
  }

  const displayValue =
    currentValue.length === 0
      ? null
      : question.type === 'multiple_choice'
        ? currentValue.join(', ')
        : currentValue[0];

  return (
    <div className="bg-card rounded-lg border p-4 shadow-sm">
      <p className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
        {question.label}
        {question.required && <span className="text-destructive ml-1">*</span>}
      </p>

      {!isEditing && (
        <p
          className={
            displayValue
              ? 'text-foreground text-base font-medium'
              : 'text-muted-foreground text-sm italic'
          }
        >
          {displayValue ?? 'No answer yet'}
        </p>
      )}

      {isEditing && question.type === 'short_answer' && (
        <Input
          value={currentValue[0] ?? ''}
          onChange={(e) =>
            setCurrentValue(e.target.value ? [e.target.value] : [])
          }
          onBlur={() => autosave(currentValue)}
          placeholder="Your answer"
        />
      )}

      {isEditing && question.type === 'long_answer' && (
        <Textarea
          value={currentValue[0] ?? ''}
          onChange={(e) =>
            setCurrentValue(e.target.value ? [e.target.value] : [])
          }
          onBlur={() => autosave(currentValue)}
          placeholder="Your answer"
          className="min-h-[100px]"
        />
      )}

      {isEditing && question.type === 'single_choice' && (
        <div className="flex flex-col gap-2">
          {question.options.map((option: string) => (
            <Label
              key={option}
              className="flex cursor-pointer items-center gap-2 font-normal"
            >
              <input
                type="radio"
                name={question.id}
                value={option}
                checked={currentValue[0] === option}
                onChange={() => {
                  const next = [option];
                  setCurrentValue(next);
                  autosave(next);
                }}
                className="accent-primary size-4"
              />
              {option}
            </Label>
          ))}
        </div>
      )}

      {isEditing && question.type === 'multiple_choice' && (
        <div className="flex flex-col gap-2">
          {question.options.map((option: string) => (
            <Label
              key={option}
              className="flex cursor-pointer items-center gap-2 font-normal"
            >
              <input
                type="checkbox"
                value={option}
                checked={currentValue.includes(option)}
                onChange={(e) => {
                  const next = e.target.checked
                    ? [...currentValue, option]
                    : currentValue.filter((v) => v !== option);
                  setCurrentValue(next);
                  autosave(next);
                }}
                className="accent-primary size-4"
              />
              {option}
            </Label>
          ))}
        </div>
      )}
    </div>
  );
}
