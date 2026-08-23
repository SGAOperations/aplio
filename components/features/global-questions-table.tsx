'use client';

import { useMemo, useOptimistic, useState, useTransition } from 'react';

import { ListChecks } from 'lucide-react';
import { toast } from 'sonner';

import {
  deleteGlobalQuestion,
  reorderGlobalQuestions,
} from '@/prisma/actions/global-questions';

import {
  QUESTION_TYPE_BADGE_VARIANT,
  QUESTION_TYPE_LABELS,
  SHORT_ANSWER_FORMAT_LABELS,
} from '@/lib/constants';
import { type DataTableColumn } from '@/lib/data-table';
import type { GlobalQuestionListItem } from '@/lib/types';

import { GlobalQuestionDialog } from '@/components/features/global-question-dialog';
import { QuestionOptionChips } from '@/components/features/question-option-chips';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, DataTableRowActions } from '@/components/ui/data-table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';

interface GlobalQuestionsTableProps {
  questions: GlobalQuestionListItem[];
}

export function GlobalQuestionsTable({ questions }: GlobalQuestionsTableProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isReordering, startReorder] = useTransition();
  const [optimisticQuestions, setOptimisticQuestions] = useOptimistic(
    questions,
    (_, next: GlobalQuestionListItem[]) => next,
  );

  const COLUMNS: DataTableColumn<GlobalQuestionListItem>[] = useMemo(
    () => [
      {
        key: 'order',
        header: 'Order',
        headClassName: 'w-16',
        sortAccessor: (q) => q.order,
        cell: (q) => q.order,
      },
      {
        key: 'label',
        header: 'Label',
        cellClassName: 'font-medium',
        sortAccessor: (q) => q.label,
        cell: (q) => q.label,
      },
      {
        key: 'type',
        header: 'Type',
        headClassName: 'w-36',
        sortAccessor: (q) => QUESTION_TYPE_LABELS[q.type],
        cell: (q) => (
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={QUESTION_TYPE_BADGE_VARIANT[q.type]}>
              {QUESTION_TYPE_LABELS[q.type]}
            </Badge>
            {q.format && (
              <Badge variant="outline">
                {SHORT_ANSWER_FORMAT_LABELS[q.format]}
              </Badge>
            )}
          </div>
        ),
      },
      {
        // Not sortable — rendered chips, not data.
        key: 'options',
        header: 'Options',
        cell: (q) =>
          q.options.length > 0 || q.allowOther ? (
            <QuestionOptionChips
              options={q.options}
              allowOther={q.allowOther}
            />
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        key: 'required',
        header: 'Required',
        headClassName: 'w-28',
        // Sort 1 (yes) before 0 (no) when ascending so required questions surface first.
        sortAccessor: (q) => (q.required ? 1 : 0),
        cell: (q) =>
          q.required ? (
            <Badge variant="outline">Required</Badge>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        // Not sortable
        key: 'actions',
        header: 'Actions',
        headClassName: 'w-32',
        cell: (q) => (
          <DataTableRowActions>
            <GlobalQuestionDialog
              trigger={
                <Button variant="outline" size="sm">
                  Edit
                </Button>
              }
              question={q}
            />
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setDeletingId(q.id)}
            >
              Delete
            </Button>
          </DataTableRowActions>
        ),
      },
    ],
    [],
  );

  async function handleDelete() {
    if (!deletingId) return;
    setIsDeleting(true);
    try {
      const result = await deleteGlobalQuestion({ id: deletingId });
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success('Question deleted');
      setDeletingId(null);
    } catch (error) {
      console.error(error);
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  }

  function handleReorder(ids: string[]) {
    const byId = new Map(optimisticQuestions.map((q) => [q.id, q]));
    const next = ids.map((id) => byId.get(id)).filter((q) => q !== undefined);

    startReorder(async () => {
      setOptimisticQuestions(next);
      try {
        const result = await reorderGlobalQuestions({ ids });
        if (result?.error) {
          toast.error(result.error);
          return;
        }
        toast.success('Order saved');
      } catch (error) {
        console.error(error);
        toast.error('Something went wrong. Please try again.');
      }
    });
  }

  if (optimisticQuestions.length === 0)
    return (
      <EmptyState
        icon={ListChecks}
        title="No questions yet"
        description="Add your first global question — applicants answer it once in their profile."
        action={
          <GlobalQuestionDialog
            trigger={<Button size="sm">Add Question</Button>}
          />
        }
      />
    );

  return (
    <>
      <DataTable
        rows={optimisticQuestions}
        columns={COLUMNS}
        getRowKey={(q) => q.id}
        caption="Global questions"
        defaultSort={{ key: 'order', direction: 'asc' }}
        reorder={{
          orderKey: 'order',
          getItemLabel: (q) => q.label,
          onReorder: handleReorder,
          sortHint: 'Sort by Order to drag questions into a new order.',
          disabled: isReordering,
        }}
        mobileCard={(question) => (
          <div className="flex flex-col gap-3 p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="font-medium">{question.label}</p>
              <div className="flex items-center gap-2">
                <Badge variant={QUESTION_TYPE_BADGE_VARIANT[question.type]}>
                  {QUESTION_TYPE_LABELS[question.type]}
                </Badge>
                {question.format && (
                  <Badge variant="outline">
                    {SHORT_ANSWER_FORMAT_LABELS[question.format]}
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-xs">
                Order: {question.order}
              </span>
              {question.required && (
                <Badge variant="outline" className="text-xs">
                  Required
                </Badge>
              )}
            </div>
            <QuestionOptionChips
              options={question.options}
              allowOther={question.allowOther}
            />
            <DataTableRowActions>
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
            </DataTableRowActions>
          </div>
        )}
      />

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
              onClick={() => void handleDelete()}
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
