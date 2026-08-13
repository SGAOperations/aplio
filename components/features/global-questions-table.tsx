'use client';

import { useState } from 'react';

import { ListChecks } from 'lucide-react';
import { toast } from 'sonner';

import { deleteGlobalQuestion } from '@/prisma/actions/global-questions';

import {
  QUESTION_TYPE_BADGE_VARIANT,
  QUESTION_TYPE_LABELS,
  SHORT_ANSWER_FORMAT_LABELS,
} from '@/lib/constants';
import type { GlobalQuestionListItem } from '@/lib/types';
import {
  type SortableColumn,
  useSortableTable,
} from '@/lib/use-sortable-table';

import { GlobalQuestionDialog } from '@/components/features/global-question-dialog';
import { SortableHeader } from '@/components/features/sortable-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface GlobalQuestionsTableProps {
  questions: GlobalQuestionListItem[];
}

const COLUMNS: SortableColumn<GlobalQuestionListItem>[] = [
  { key: 'order', accessor: (q) => q.order },
  { key: 'label', accessor: (q) => q.label },
  { key: 'type', accessor: (q) => QUESTION_TYPE_LABELS[q.type] },
  // Sort 1 (yes) before 0 (no) when ascending so required questions surface first.
  { key: 'required', accessor: (q) => (q.required ? 1 : 0) },
];

export function GlobalQuestionsTable({ questions }: GlobalQuestionsTableProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Default sort: order ascending — the meaningful sequence for global questions.
  const { sortedRows, sort, toggle, ariaSort } = useSortableTable(
    questions,
    COLUMNS,
    { defaultSort: { key: 'order', direction: 'asc' } },
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

  if (questions.length === 0)
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
      {/* Desktop table */}
      <Card className="hidden gap-0 p-0 md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHeader
                label="Order"
                active={sort.key === 'order'}
                direction={sort.direction}
                ariaSort={ariaSort('order')}
                onToggle={() => toggle('order')}
                className="w-16"
              />
              <SortableHeader
                label="Label"
                active={sort.key === 'label'}
                direction={sort.direction}
                ariaSort={ariaSort('label')}
                onToggle={() => toggle('label')}
              />
              <SortableHeader
                label="Type"
                active={sort.key === 'type'}
                direction={sort.direction}
                ariaSort={ariaSort('type')}
                onToggle={() => toggle('type')}
                className="w-36"
              />
              {/* Options column — not sortable (rendered chips, not data) */}
              <TableHead>Options</TableHead>
              <SortableHeader
                label="Required"
                active={sort.key === 'required'}
                direction={sort.direction}
                ariaSort={ariaSort('required')}
                onToggle={() => toggle('required')}
                className="w-28"
              />
              {/* Actions column — not sortable */}
              <TableHead className="w-32">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedRows.map((question) => (
              <TableRow key={question.id}>
                <TableCell>{question.order}</TableCell>
                <TableCell className="font-medium">{question.label}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={QUESTION_TYPE_BADGE_VARIANT[question.type]}>
                      {QUESTION_TYPE_LABELS[question.type]}
                    </Badge>
                    {question.format && (
                      <Badge variant="outline">
                        {SHORT_ANSWER_FORMAT_LABELS[question.format]}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {question.options.length > 0 || question.allowOther ? (
                    <div className="flex flex-wrap gap-1">
                      {question.options.map((opt) => (
                        <span
                          key={opt}
                          className="bg-secondary text-secondary-foreground rounded-full px-2 py-0.5 text-xs"
                        >
                          {opt}
                        </span>
                      ))}
                      {question.allowOther && (
                        <span className="bg-secondary text-secondary-foreground rounded-full px-2 py-0.5 text-xs">
                          + Other
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {question.required ? (
                    <Badge variant="outline">Required</Badge>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
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
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Mobile stacked cards — sort order from sortedRows reflects active sort */}
      <div className="flex flex-col gap-3 md:hidden">
        {sortedRows.map((question) => (
          <Card key={question.id} className="p-4">
            <div className="flex flex-col gap-3">
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
              {(question.options.length > 0 || question.allowOther) && (
                <div className="flex flex-wrap gap-1">
                  {question.options.map((opt) => (
                    <span
                      key={opt}
                      className="bg-secondary text-secondary-foreground rounded-full px-2 py-0.5 text-xs"
                    >
                      {opt}
                    </span>
                  ))}
                  {question.allowOther && (
                    <span className="bg-secondary text-secondary-foreground rounded-full px-2 py-0.5 text-xs">
                      + Other
                    </span>
                  )}
                </div>
              )}
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
            </div>
          </Card>
        ))}
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
