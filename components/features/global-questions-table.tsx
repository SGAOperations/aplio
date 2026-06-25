'use client';

import { useState } from 'react';

import { ListChecks } from 'lucide-react';
import { toast } from 'sonner';

import { deleteGlobalQuestion } from '@/prisma/actions/global-questions';

import { QUESTION_TYPE_LABELS } from '@/lib/constants';
import type { GlobalQuestionListItem } from '@/lib/types';

import { GlobalQuestionDialog } from '@/components/features/global-question-dialog';
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

export function GlobalQuestionsTable({ questions }: GlobalQuestionsTableProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    if (!deletingId) return;
    setIsDeleting(true);
    const result = await deleteGlobalQuestion({ id: deletingId });
    setIsDeleting(false);
    if (result?.error) {
      toast.error(result.error);
      return;
    }
    toast.success('Question deleted');
    setDeletingId(null);
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
              <TableHead className="w-16">Order</TableHead>
              <TableHead>Label</TableHead>
              <TableHead className="w-36">Type</TableHead>
              <TableHead>Options</TableHead>
              <TableHead className="w-28">Required</TableHead>
              <TableHead className="w-32">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {questions.map((question) => (
              <TableRow key={question.id}>
                <TableCell>{question.order}</TableCell>
                <TableCell className="font-medium">{question.label}</TableCell>
                <TableCell>
                  <Badge variant="secondary">
                    {QUESTION_TYPE_LABELS[question.type]}
                  </Badge>
                </TableCell>
                <TableCell>
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

      {/* Mobile stacked cards */}
      <div className="flex flex-col gap-3 md:hidden">
        {questions.map((question) => (
          <Card key={question.id} className="p-4">
            <div className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium">{question.label}</p>
                <Badge variant="secondary">
                  {QUESTION_TYPE_LABELS[question.type]}
                </Badge>
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
              {question.options.length > 0 && (
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
