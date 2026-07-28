'use client';

import { useId, useState, useTransition } from 'react';

import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  removeQuestionFileAnswer,
  uploadQuestionFileAnswer,
} from '@/prisma/actions/question-files';

import {
  FILE_UPLOAD_ACCEPT,
  FILE_UPLOAD_HELP_TEXT,
  FILE_UPLOAD_MAX_BYTES,
  FILE_UPLOAD_MIME_TYPES,
} from '@/lib/constants';
import type { QuestionFileTarget } from '@/lib/types';
import { cn, isError } from '@/lib/utils';

import { AnswerFileLink } from '@/components/features/answer-file-link';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button, buttonVariants } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

interface QuestionFileFieldProps {
  target: QuestionFileTarget;
  value: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
}

// Mirrors the server's zod messages exactly (see prisma/actions/question-files.ts)
// so behavior matches whether or not the request is actually sent. This is a
// UX pre-check only — the server is the source of truth (magic-byte sniff +
// the same size/mime checks run again there).
function clientValidationError(file: File): string | null {
  if (file.size > FILE_UPLOAD_MAX_BYTES) return 'File must be 4MB or smaller.';
  if (
    !FILE_UPLOAD_MIME_TYPES.includes(
      file.type as (typeof FILE_UPLOAD_MIME_TYPES)[number],
    )
  )
    return 'Only PDF, PNG and JPG files are allowed.';
  return null;
}

// Editable file-answer control shared by the applicant apply flow
// (application-question.tsx) and the profile page (profile-question.tsx).
// No useEffect: all state here is driven directly by user events (file
// picker change, remove confirm), never by syncing with an external system.
export function QuestionFileField({
  target,
  value,
  onChange,
  disabled,
}: QuestionFileFieldProps) {
  const inputId = useId();
  const helpId = `${inputId}-help`;
  const errorId = `${inputId}-error`;
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [removeOpen, setRemoveOpen] = useState(false);
  const url = value[0];

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const clientError = clientValidationError(file);
    if (clientError) {
      setError(clientError);
      toast.error(clientError);
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set('file', file);
        formData.set('scope', target.scope);
        formData.set('questionId', target.questionId);
        if (target.scope === 'application') {
          formData.set('applicationId', target.applicationId);
          formData.set('isGlobal', String(target.isGlobal));
        }

        const result = await uploadQuestionFileAnswer(formData);
        if (isError(result)) {
          setError(result.error);
          toast.error(result.error);
          return;
        }
        onChange([result.url]);
        toast.success('File uploaded');
      } catch {
        setError('Something went wrong');
        toast.error('Something went wrong');
      }
    });
  }

  function handleRemove() {
    startTransition(async () => {
      try {
        const result = await removeQuestionFileAnswer(target);
        if (result && isError(result)) {
          toast.error(result.error);
          return;
        }
        onChange([]);
        toast.success('File removed');
        setRemoveOpen(false);
      } catch {
        toast.error('Something went wrong');
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {isPending ? (
        <span
          aria-live="polite"
          className="text-muted-foreground flex items-center gap-2 text-sm"
        >
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Uploading…
        </span>
      ) : url ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <AnswerFileLink target={target} url={url} />
          <div className="flex gap-2">
            <Label
              htmlFor={inputId}
              aria-disabled={disabled}
              className={cn(
                buttonVariants({ variant: 'outline', size: 'sm' }),
                'min-h-11 cursor-pointer sm:min-h-9',
                disabled && 'pointer-events-none opacity-50',
              )}
            >
              Replace
            </Label>
            <AlertDialog open={removeOpen} onOpenChange={setRemoveOpen}>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive min-h-11 sm:min-h-9"
                  disabled={disabled}
                >
                  Remove
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remove this file?</AlertDialogTitle>
                  <AlertDialogDescription>
                    The uploaded file will be permanently deleted. This
                    can&apos;t be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isPending}>
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    disabled={isPending}
                    onClick={(e) => {
                      e.preventDefault();
                      handleRemove();
                    }}
                  >
                    {isPending ? (
                      <Loader2
                        className="size-4 animate-spin"
                        aria-hidden="true"
                      />
                    ) : null}
                    Remove file
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      ) : (
        <>
          <p className="text-muted-foreground text-sm">No file uploaded yet.</p>
          <Label
            htmlFor={inputId}
            aria-disabled={disabled}
            className={cn(
              buttonVariants({ variant: 'outline', size: 'sm' }),
              'peer-focus-visible:ring-ring min-h-11 w-fit cursor-pointer peer-focus-visible:ring-2 sm:min-h-9',
              disabled && 'pointer-events-none opacity-50',
            )}
          >
            Choose file
          </Label>
        </>
      )}

      <input
        id={inputId}
        type="file"
        accept={FILE_UPLOAD_ACCEPT}
        onChange={handleFileChange}
        disabled={disabled || isPending}
        aria-describedby={error ? `${helpId} ${errorId}` : helpId}
        className="peer sr-only"
      />

      <p id={helpId} className="text-muted-foreground text-xs">
        {FILE_UPLOAD_HELP_TEXT}
      </p>

      {error && (
        <p id={errorId} className="text-destructive text-xs">
          {error}
        </p>
      )}
    </div>
  );
}
