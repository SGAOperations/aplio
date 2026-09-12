'use client';

import { useState } from 'react';

import { toast } from 'sonner';

import { downloadQuestionFileAnswer } from '@/prisma/actions/question-files';

import { base64ToBlob, getFileDisplayName } from '@/lib/files';
import { ACTION_ICONS, FILE_TYPE_ICONS } from '@/lib/icons';
import type { QuestionFileTarget } from '@/lib/types';
import { isError } from '@/lib/utils';

import { FilePreviewDialog } from '@/components/features/file-preview-dialog';
import { Button } from '@/components/ui/button';

interface AnswerFileLinkProps {
  target: QuestionFileTarget;
  url: string;
}

// Server Action, not a Route Handler: base64 becomes a Blob and downloads client-side.
export function AnswerFileLink({ target, url }: AnswerFileLinkProps) {
  const [isPending, setIsPending] = useState(false);
  const filename = getFileDisplayName(url);
  const Icon = filename.toLowerCase().endsWith('.pdf')
    ? FILE_TYPE_ICONS.pdf
    : FILE_TYPE_ICONS.image;

  async function handleDownload() {
    setIsPending(true);
    try {
      const result = await downloadQuestionFileAnswer(target);
      if (isError(result)) {
        toast.error(result.error);
        return;
      }

      const blob = base64ToBlob(result.data, result.contentType);
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = result.filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      toast.error('Something went wrong');
    } finally {
      setIsPending(false);
    }
  }

  return (
    // Fills the container so a long filename still pushes Download right.
    <div className="flex w-full min-w-0 items-center gap-2">
      <FilePreviewDialog target={target} filename={filename}>
        <Button
          type="button"
          variant="link"
          size="sm"
          className="min-w-0 flex-1 justify-start gap-2 px-0 font-normal"
          aria-label={`Preview ${filename}`}
        >
          <Icon className="text-muted-foreground shrink-0" />
          <span className="min-w-0 truncate" title={filename}>
            {filename}
          </span>
        </Button>
      </FilePreviewDialog>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-h-11 shrink-0 sm:min-h-9"
        onClick={() => void handleDownload()}
        disabled={isPending}
        aria-label={`Download ${filename}`}
      >
        {isPending ? (
          <>
            <ACTION_ICONS.pending className="animate-spin" />
            Preparing…
          </>
        ) : (
          <>
            <ACTION_ICONS.download />
            Download
          </>
        )}
      </Button>
    </div>
  );
}
