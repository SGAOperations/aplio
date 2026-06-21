'use client';

import { useState } from 'react';

import { toast } from 'sonner';

import { deleteGlobalQuestion } from '@/prisma/services/global-question-actions';
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
              <th className="px-4 py-3 text-left font-medium">Required</th>
              <th className="px-4 py-3 text-left font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {questions.map((question) => (
              <tr key={question.id} className="hover:bg-muted/30">
                <td className="px-4 py-3">{question.order}</td>
                <td className="px-4 py-3 font-medium">{question.label}</td>
                <td className="text-muted-foreground px-4 py-3">
                  {QUESTION_TYPE_LABELS[question.type]}
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
