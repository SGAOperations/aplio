'use client';

import { useState, useTransition } from 'react';

import { updateGlobalAnswer } from '@/prisma/actions/profile';
import type { GlobalAnswer, GlobalQuestion } from '@/prisma/client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface ProfileQuestionProps {
  question: GlobalQuestion;
  answer: GlobalAnswer | null;
  userId: string;
}

export function ProfileQuestion({
  question,
  answer,
  userId,
}: ProfileQuestionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [currentValue, setCurrentValue] = useState<string[]>(
    answer?.value ?? [],
  );
  const [editValue, setEditValue] = useState<string[]>(answer?.value ?? []);
  const [isPending, startTransition] = useTransition();

  function displayValue() {
    if (currentValue.length === 0) return null;
    if (question.type === 'multiple_choice') return currentValue.join(', ');
    return currentValue[0];
  }

  function handleEdit() {
    setEditValue(currentValue);
    setIsEditing(true);
  }

  function handleCancel() {
    setEditValue(currentValue);
    setIsEditing(false);
  }

  function handleSave() {
    startTransition(async () => {
      await updateGlobalAnswer(userId, question.id, editValue);
      setCurrentValue(editValue);
      setIsEditing(false);
    });
  }

  function handleShortChange(val: string) {
    setEditValue(val ? [val] : []);
  }

  function handleSingleChoice(option: string) {
    setEditValue([option]);
  }

  function handleMultipleChoice(option: string, checked: boolean) {
    if (checked) {
      setEditValue((prev) => [...prev, option]);
    } else {
      setEditValue((prev) => prev.filter((v) => v !== option));
    }
  }

  const display = displayValue();

  return (
    <div className="bg-card rounded-lg border p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-2">
        <span className="text-sm leading-snug font-medium">
          {question.label}
          {question.required && (
            <span className="text-destructive ml-1">*</span>
          )}
        </span>
        {!isEditing && (
          <Button variant="outline" size="sm" onClick={handleEdit}>
            Edit
          </Button>
        )}
      </div>

      {!isEditing && (
        <p className="text-muted-foreground text-sm">
          {display ?? <span className="italic">No answer yet</span>}
        </p>
      )}

      {isEditing && (
        <div className="flex flex-col gap-3">
          {question.type === 'short_answer' && (
            <Input
              value={editValue[0] ?? ''}
              onChange={(e) => handleShortChange(e.target.value)}
              placeholder="Your answer"
            />
          )}

          {question.type === 'long_answer' && (
            <Textarea
              value={editValue[0] ?? ''}
              onChange={(e) => handleShortChange(e.target.value)}
              placeholder="Your answer"
              className="min-h-[100px]"
            />
          )}

          {question.type === 'single_choice' && (
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
                    checked={editValue[0] === option}
                    onChange={() => handleSingleChoice(option)}
                    className="accent-primary size-4"
                  />
                  {option}
                </Label>
              ))}
            </div>
          )}

          {question.type === 'multiple_choice' && (
            <div className="flex flex-col gap-2">
              {question.options.map((option: string) => (
                <Label
                  key={option}
                  className="flex cursor-pointer items-center gap-2 font-normal"
                >
                  <input
                    type="checkbox"
                    value={option}
                    checked={editValue.includes(option)}
                    onChange={(e) =>
                      handleMultipleChoice(option, e.target.checked)
                    }
                    className="accent-primary size-4"
                  />
                  {option}
                </Label>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handleSave} disabled={isPending}>
              {isPending ? 'Saving...' : 'Save'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancel}
              disabled={isPending}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
