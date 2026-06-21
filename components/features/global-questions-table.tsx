'use client';

import { useState } from 'react';

import { ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';

import {
  deleteGlobalQuestion,
  reorderGlobalQuestion,
} from '@/prisma/services/global-question-actions';
import { QUESTION_TYPE_LABELS } from '@/prisma/services/global-question-constants';
import type { GlobalQuestionListItem } from '@/prisma/services/global-question-types';

import { GlobalQuestionDialog } from '@/components/features/global-question-dialog';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface GlobalQuestionsTableProps {
  questions: GlobalQuestionListItem[];
}

export function GlobalQuestionsTable({ questions }: GlobalQuestionsTableProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [movingId, setMovingId] = useState<string | null>(null);

  async function handleDelete() {
    if (!deletingId) return;
    setIsDeleting(true);
    const result = await deleteGlobalQuestion({ id: deletingId });
    setIsDeleting(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success('Question deleted');
    setDeletingId(null);
  }

  async function handleMove(id: string, direction: 'up' | 'down') {
    setMovingId(id);
    const result = await reorderGlobalQuestion({ id, direction });
    setMovingId(null);
    if (!result.ok) toast.error(result.error);
  }

  if (questions.length === 0)
    return (
      <div className="text-muted-foreground flex flex-col items-center justify-center gap-2 rounded-lg border py-16 text-sm">
        <p className="font-medium">No questions yet</p>
        <p>Create your first global question using the button above.</p>
      </div>
    );

  return (
    <>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Order</th>
              <th className="px-4 py-3 text-left font-medium">Label</th>
              <th className="px-4 py-3 text-left font-medium">Type</th>
              <th className="px-4 py-3 text-left font-medium">Options</th>
              <th className="px-4 py-3 text-left font-medium">Required</th>
              <th className="px-4 py-3 text-left font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {questions.map((question, index) => (
              <tr key={question.id} className="hover:bg-muted/30">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <span className="w-6 text-center">{question.order}</span>
                    <div className="flex flex-col">
                      <button
                        type="button"
                        aria-label="Move up"
                        disabled={index === 0 || movingId === question.id}
                        onClick={() => handleMove(question.id, 'up')}
                        className="hover:text-foreground text-muted-foreground disabled:opacity-30"
                      >
                        <ChevronUp className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        aria-label="Move down"
                        disabled={
                          index === questions.length - 1 ||
                          movingId === question.id
                        }
                        onClick={() => handleMove(question.id, 'down')}
                        className="hover:text-foreground text-muted-foreground disabled:opacity-30"
                      >
                        <ChevronDown className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 font-medium">{question.label}</td>
                <td className="text-muted-foreground px-4 py-3">
                  {QUESTION_TYPE_LABELS[question.type]}
                </td>
                <td className="px-4 py-3">
                  {question.options.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {question.options.map((opt) => (
                        <span
                          key={opt}
                          className="bg-secondary text-secondary-foreground rounded-full px-2 py-0.5 text-xs"
                        >
                          {opt}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {question.required ? 'Yes' : 'No'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <GlobalQuestionDialog
                      trigger={
                        <Button variant="outline" size="sm">
                          Edit
                        </Button>
                      }
                      question={question}
                    />
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setDeletingId(question.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog
        open={!!deletingId}
        onOpenChange={(open) => !open && setDeletingId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete question?</DialogTitle>
            <DialogDescription>
              This will remove the question from all future profile views.
              Existing answers are preserved.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeletingId(null)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
