'use client';

import { useRef, useState, useTransition } from 'react';

import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import type { QuestionType } from '@/prisma/client';
import {
  createPositionQuestion,
  updatePositionQuestion,
} from '@/prisma/services/position-question-actions';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const QUESTION_TYPE_OPTIONS: { value: QuestionType; label: string }[] = [
  { value: 'short_answer', label: 'Short Answer' },
  { value: 'long_answer', label: 'Long Answer' },
  { value: 'single_choice', label: 'Single Choice' },
  { value: 'multiple_choice', label: 'Multiple Choice' },
];

const CHOICE_TYPES: QuestionType[] = ['single_choice', 'multiple_choice'];

// Only the fields rendered in PositionQuestionsSection and needed for optimistic updates.
export interface RenderedQuestion {
  id: string;
  positionId: string;
  label: string;
  type: QuestionType;
  required: boolean;
  options: string[];
  order: number;
}

export interface QuestionFormProps {
  positionId: string;
  question?: RenderedQuestion;
  onSuccess: (question: RenderedQuestion) => void;
  onClose: () => void;
}

export function QuestionForm({
  positionId,
  question,
  onSuccess,
  onClose,
}: QuestionFormProps) {
  const [isPending, startTransition] = useTransition();
  const [label, setLabel] = useState(question?.label ?? '');
  const [type, setType] = useState<QuestionType>(
    question?.type ?? 'short_answer',
  );
  const [required, setRequired] = useState(question?.required ?? true);
  // Options are tracked as a plain string array; UUIDs are not needed with badge input.
  const [options, setOptions] = useState<string[]>(question?.options ?? []);
  const optionInputRef = useRef<HTMLInputElement>(null);

  const isChoiceType = CHOICE_TYPES.includes(type);

  function addOption(value: string) {
    const trimmed = value.trim();
    if (!trimmed || options.includes(trimmed)) return;
    setOptions((prev) => [...prev, trimmed]);
  }

  function removeOption(opt: string) {
    setOptions((prev) => prev.filter((o) => o !== opt));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const filteredOptions = isChoiceType ? options : [];

    startTransition(async () => {
      if (question) {
        const result = await updatePositionQuestion({
          id: question.id,
          positionId,
          label,
          type,
          required,
          options: filteredOptions,
        });
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success('Question updated');
        onClose();
        onSuccess({
          id: question.id,
          positionId,
          label,
          type,
          required,
          order: question.order,
          options: filteredOptions,
        });
      } else {
        const result = await createPositionQuestion({
          positionId,
          label,
          type,
          required,
          options: filteredOptions,
        });
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success('Question added');
        onClose();
        onSuccess({
          id: result.data.id,
          positionId,
          label,
          type,
          required,
          order: result.data.order,
          options: filteredOptions,
        });
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid gap-2">
        <Label htmlFor="q-label">Question</Label>
        <Input
          id="q-label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Enter question text"
          required
          disabled={isPending}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="q-type">Type</Label>
        <select
          id="q-type"
          value={type}
          onChange={(e) => {
            setType(e.target.value as QuestionType);
            // Clear options when switching away from a choice type
            if (!CHOICE_TYPES.includes(e.target.value as QuestionType))
              setOptions([]);
          }}
          disabled={isPending}
          className="border-input bg-background placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {QUESTION_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id="q-required"
          checked={required}
          onCheckedChange={(checked) => setRequired(checked === true)}
          disabled={isPending}
        />
        <Label htmlFor="q-required">Required</Label>
      </div>
      {isChoiceType && (
        <div className="grid gap-2">
          <Label>Options</Label>
          {options.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {options.map((opt) => (
                <span
                  key={opt}
                  className="bg-secondary text-secondary-foreground flex items-center gap-1 rounded-full px-2 py-0.5 text-xs"
                >
                  {opt}
                  <button
                    type="button"
                    onClick={() => removeOption(opt)}
                    disabled={isPending}
                    className="hover:text-destructive ml-0.5 disabled:cursor-not-allowed"
                    aria-label={`Remove ${opt}`}
                  >
                    &times;
                  </button>
                </span>
              ))}
            </div>
          )}
          <Input
            ref={optionInputRef}
            placeholder="Type an option and press Enter"
            disabled={isPending}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addOption(e.currentTarget.value);
                e.currentTarget.value = '';
              }
            }}
          />
        </div>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="animate-spin" />}
          {question ? 'Save Changes' : 'Add Question'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={isPending}
          onClick={onClose}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
