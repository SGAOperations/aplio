'use client';

import { useState, useTransition } from 'react';

import { Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { deletePositionQuestion } from '@/prisma/actions/position-question-actions';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

import {
  QuestionForm,
  type RenderedQuestion,
} from './position-question-dialog';
import { PositionQuestionSummary } from './position-question-summary';

interface PositionQuestionsSectionProps {
  positionId: string;
  initialQuestions: RenderedQuestion[];
}

export function PositionQuestionsSection({
  positionId,
  initialQuestions,
}: PositionQuestionsSectionProps) {
  const [questions, setQuestions] = useState(initialQuestions);
  // `deleteTarget` is never nulled on close — only replaced on the next
  // open — so the dialog's description keeps the last valid value through
  // Radix's exit animation instead of re-rendering blank mid-fade.
  const [deleteTarget, setDeleteTarget] = useState<RenderedQuestion | null>(
    null,
  );
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [isDeleting, startTransition] = useTransition();

  function handleQuestionSaved(updated: RenderedQuestion) {
    setQuestions((prev) => {
      const exists = prev.find((q) => q.id === updated.id);
      if (exists) return prev.map((q) => (q.id === updated.id ? updated : q));
      return [...prev, updated];
    });
    setEditingId(null);
    setShowAddForm(false);
  }

  function handleDeleteConfirm() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    startTransition(async () => {
      try {
        const result = await deletePositionQuestion({
          id: target.id,
          positionId,
        });
        if (result && 'error' in result) {
          toast.error(result.error);
          return;
        }
        setQuestions((prev) => prev.filter((q) => q.id !== target.id));
        toast.success('Question deleted');
        setDeleteDialogOpen(false);
      } catch (error) {
        console.error(error);
        toast.error('Something went wrong. Please try again.');
      }
    });
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        {questions.length === 0 && !showAddForm && (
          <p className="text-muted-foreground text-sm">
            No questions yet. Add a question to get started.
          </p>
        )}

        {questions.map((question) => (
          <div key={question.id}>
            {editingId === question.id ? (
              <Card className="gap-4 p-4">
                <h2 className="text-sm font-medium">Edit Question</h2>
                <QuestionForm
                  key={question.id}
                  positionId={positionId}
                  question={question}
                  onSuccess={handleQuestionSaved}
                  onClose={() => setEditingId(null)}
                />
              </Card>
            ) : (
              <Card className="flex flex-row items-center gap-3 p-4">
                <PositionQuestionSummary question={question} />
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setShowAddForm(false);
                      setEditingId(question.id);
                    }}
                    disabled={isDeleting && deleteTarget?.id === question.id}
                  >
                    <Pencil className="size-4" />
                    <span className="sr-only">Edit question</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setDeleteTarget(question);
                      setDeleteDialogOpen(true);
                    }}
                    disabled={isDeleting && deleteTarget?.id === question.id}
                  >
                    <Trash2 className="text-destructive size-4" />
                    <span className="sr-only">
                      Delete question &quot;{question.label}&quot;
                    </span>
                  </Button>
                </div>
              </Card>
            )}
          </div>
        ))}

        {showAddForm ? (
          <Card className="gap-4 p-4">
            <h2 className="text-sm font-medium">Add Question</h2>
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

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete this question?"
        description={
          <div className="flex flex-col gap-2">
            <p>
              &quot;{deleteTarget?.label}&quot; will be removed from this
              position&apos;s application form. New applicants will no longer
              see it.
            </p>
            {!!deleteTarget && deleteTarget.answerCount > 0 && (
              <p className="text-destructive">
                {deleteTarget.answerCount}{' '}
                {deleteTarget.answerCount === 1
                  ? 'application already has'
                  : 'applications already have'}{' '}
                an answer to this question. Existing answers stay visible on
                those applications, but the question disappears from any draft
                still in progress.
              </p>
            )}
          </div>
        }
        confirmLabel="Delete question"
        pendingLabel="Deleting…"
        destructive
        isPending={isDeleting}
        onConfirm={handleDeleteConfirm}
      />
    </>
  );
}
