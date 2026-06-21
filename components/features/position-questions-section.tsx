'use client';

import { useState, useTransition } from 'react';

import { Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { deletePositionQuestion } from '@/prisma/services/position-question-actions';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

import {
  PositionQuestionDialog,
  type RenderedQuestion,
} from './position-question-dialog';

const QUESTION_TYPE_LABELS: Record<string, string> = {
  short_answer: 'Short Answer',
  long_answer: 'Long Answer',
  single_choice: 'Single Choice',
  multiple_choice: 'Multiple Choice',
};

interface PositionQuestionsSectionProps {
  positionId: string;
  initialQuestions: RenderedQuestion[];
}

export function PositionQuestionsSection({
  positionId,
  initialQuestions,
}: PositionQuestionsSectionProps) {
  const [questions, setQuestions] = useState(initialQuestions);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function handleQuestionSaved(updated: RenderedQuestion) {
    setQuestions((prev) => {
      const exists = prev.find((q) => q.id === updated.id);
      if (exists) return prev.map((q) => (q.id === updated.id ? updated : q));
      return [...prev, updated];
    });
  }

  function handleDelete(id: string) {
    setDeletingId(id);
    startTransition(async () => {
      const result = await deletePositionQuestion({ id, positionId });
      if (result.ok) {
        setQuestions((prev) => prev.filter((q) => q.id !== id));
        toast.success('Question deleted');
      } else {
        toast.error(result.error);
      }
      setDeletingId(null);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {questions.length === 0 && (
        <p className="text-muted-foreground text-sm">
          No questions yet. Add a question to get started.
        </p>
      )}

      {questions.map((question) => (
        <Card key={question.id} className="flex items-start gap-3 p-4">
          <div className="flex-1">
            <p className="text-sm font-medium">{question.label}</p>
            <p className="text-muted-foreground text-xs">
              {QUESTION_TYPE_LABELS[question.type] ?? question.type}
              {question.required ? ' · Required' : ' · Optional'}
            </p>
            {question.options.length > 0 && (
              <ul className="text-muted-foreground mt-1 list-inside list-disc text-xs">
                {question.options.map((opt) => (
                  <li key={opt}>{opt}</li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex items-center gap-1">
            <PositionQuestionDialog
              positionId={positionId}
              question={question}
              trigger={
                <Button variant="ghost" size="icon">
                  <Pencil className="size-4" />
                  <span className="sr-only">Edit question</span>
                </Button>
              }
              onSuccess={handleQuestionSaved}
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleDelete(question.id)}
              disabled={deletingId === question.id}
            >
              <Trash2 className="size-4" />
              <span className="sr-only">Delete question</span>
            </Button>
          </div>
        </Card>
      ))}

      <PositionQuestionDialog
        positionId={positionId}
        trigger={
          <Button variant="outline" className="w-fit">
            <Plus className="size-4" />
            Add Question
          </Button>
        }
        onSuccess={handleQuestionSaved}
      />
    </div>
  );
}
