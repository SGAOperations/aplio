'use client';

import { useState, useTransition } from 'react';

import { Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { deletePositionQuestion } from '@/prisma/actions/position-question-actions';

import { QUESTION_TYPE_LABELS } from '@/lib/constants';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

import {
  QuestionForm,
  type RenderedQuestion,
} from './position-question-dialog';

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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [, startTransition] = useTransition();

  function handleQuestionSaved(updated: RenderedQuestion) {
    setQuestions((prev) => {
      const exists = prev.find((q) => q.id === updated.id);
      if (exists) return prev.map((q) => (q.id === updated.id ? updated : q));
      return [...prev, updated];
    });
    setEditingId(null);
    setShowAddForm(false);
  }

  function handleDelete(id: string) {
    setDeletingId(id);
    startTransition(async () => {
      const result = await deletePositionQuestion({ id, positionId });
      if (result && 'error' in result) {
        toast.error(result.error);
      } else {
        setQuestions((prev) => prev.filter((q) => q.id !== id));
        toast.success('Question deleted');
      }
      setDeletingId(null);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {questions.length === 0 && !showAddForm && (
        <p className="text-muted-foreground text-sm">
          No questions yet. Add a question to get started.
        </p>
      )}

      {questions.map((question) => (
        <div key={question.id}>
          {editingId === question.id ? (
            <Card className="p-4">
              <p className="mb-4 text-sm font-medium">Edit Question</p>
              <QuestionForm
                key={question.id}
                positionId={positionId}
                question={question}
                onSuccess={handleQuestionSaved}
                onClose={() => setEditingId(null)}
              />
            </Card>
          ) : (
            <Card className="flex items-center gap-3 p-4">
              <div className="flex-1">
                <p className="text-sm font-medium">{question.label}</p>
                <p className="text-muted-foreground text-xs">
                  {QUESTION_TYPE_LABELS[question.type] ?? question.type}
                  {question.required ? ' · Required' : ' · Optional'}
                </p>
                {question.options.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {question.options.map((opt) => (
                      <span
                        key={opt}
                        className="bg-secondary text-secondary-foreground rounded-full px-2 py-0.5 text-xs"
                      >
                        {opt}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setShowAddForm(false);
                    setEditingId(question.id);
                  }}
                  disabled={deletingId === question.id}
                >
                  <Pencil className="size-4" />
                  <span className="sr-only">Edit question</span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(question.id)}
                  disabled={deletingId === question.id}
                >
                  <Trash2 className="text-destructive size-4" />
                  <span className="sr-only">Delete question</span>
                </Button>
              </div>
            </Card>
          )}
        </div>
      ))}

      {showAddForm ? (
        <Card className="p-4">
          <p className="mb-4 text-sm font-medium">Add Question</p>
          <QuestionForm
            positionId={positionId}
            onSuccess={handleQuestionSaved}
            onClose={() => setShowAddForm(false)}
          />
        </Card>
      ) : (
        <Button
          variant="outline"
          className="w-fit"
          onClick={() => {
            setEditingId(null);
            setShowAddForm(true);
          }}
        >
          <Plus className="size-4" />
          Add Question
        </Button>
      )}
    </div>
  );
}
