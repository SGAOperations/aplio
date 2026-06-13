'use client';

import { useEffect, useState, useTransition } from 'react';

import { Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import type { PositionQuestion, QuestionType } from '@/prisma/client';
import {
  createPositionQuestion,
  updatePositionQuestion,
} from '@/prisma/services/position-question-actions';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const QUESTION_TYPE_OPTIONS: { value: QuestionType; label: string }[] = [
  { value: 'short_answer', label: 'Short Answer' },
  { value: 'long_answer', label: 'Long Answer' },
  { value: 'single_choice', label: 'Single Choice' },
  { value: 'multiple_choice', label: 'Multiple Choice' },
];

const CHOICE_TYPES: QuestionType[] = ['single_choice', 'multiple_choice'];

interface PositionQuestionDialogProps {
  positionId: string;
  question?: PositionQuestion;
  trigger: React.ReactNode;
  onSuccess: (question: PositionQuestion) => void;
}

export function PositionQuestionDialog({
  positionId,
  question,
  trigger,
  onSuccess,
}: PositionQuestionDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [label, setLabel] = useState(question?.label ?? '');
  const [type, setType] = useState<QuestionType>(
    question?.type ?? 'short_answer',
  );
  const [required, setRequired] = useState(question?.required ?? true);
  const [options, setOptions] = useState<string[]>(question?.options ?? ['']);

  useEffect(() => {
    if (open) {
      setLabel(question?.label ?? '');
      setType(question?.type ?? 'short_answer');
      setRequired(question?.required ?? true);
      setOptions(question?.options?.length ? question.options : ['']);
    }
  }, [open, question]);

  const isChoiceType = CHOICE_TYPES.includes(type);

  function addOption() {
    setOptions((prev) => [...prev, '']);
  }

  function removeOption(index: number) {
    setOptions((prev) => prev.filter((_, i) => i !== index));
  }

  function updateOption(index: number, value: string) {
    setOptions((prev) => prev.map((o, i) => (i === index ? value : o)));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const filteredOptions = isChoiceType
      ? options.filter((o) => o.trim() !== '')
      : [];

    startTransition(async () => {
      let result;

      if (question) {
        result = await updatePositionQuestion({
          id: question.id,
          positionId,
          label,
          type,
          required,
          options: filteredOptions,
        });
      } else {
        result = await createPositionQuestion({
          positionId,
          label,
          type,
          required,
          options: filteredOptions,
        });
      }

      if (result.ok) {
        toast.success(question ? 'Question updated' : 'Question added');
        setOpen(false);
        onSuccess({
          id: question?.id ?? '',
          positionId,
          label,
          type,
          required,
          order: question?.order ?? 0,
          options: filteredOptions,
          createdAt: question?.createdAt ?? new Date(),
          updatedAt: new Date(),
          deletedAt: null,
          createdById: question?.createdById ?? '',
          updatedById: '',
          deletedById: null,
        });
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {question ? 'Edit Question' : 'Add Question'}
          </DialogTitle>
        </DialogHeader>
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
              onChange={(e) => setType(e.target.value as QuestionType)}
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
            <div className="flex flex-col gap-2">
              <Label>Options</Label>
              {options.map((opt, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    value={opt}
                    onChange={(e) => updateOption(index, e.target.value)}
                    placeholder={`Option ${index + 1}`}
                    disabled={isPending}
                  />
                  {options.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeOption(index)}
                      disabled={isPending}
                    >
                      <Trash2 className="size-4" />
                      <span className="sr-only">Remove option</span>
                    </Button>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addOption}
                disabled={isPending}
                className="w-fit"
              >
                <Plus className="size-4" />
                Add Option
              </Button>
            </div>
          )}
          <Button type="submit" disabled={isPending} className="mt-2">
            {isPending && <Loader2 className="animate-spin" />}
            {question ? 'Save Changes' : 'Add Question'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
