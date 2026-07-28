'use client';

import { useState } from 'react';

import { Download, FileText, Image as ImageIcon, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { downloadQuestionFileAnswer } from '@/prisma/actions/question-files';

import { getFileDisplayName } from '@/lib/files';
import type { QuestionFileTarget } from '@/lib/types';
import { isError } from '@/lib/utils';

import { Button } from '@/components/ui/button';

interface AnswerFileLinkProps {
  target: QuestionFileTarget;
  url: string;
}

function base64ToBlob(base64: string, contentType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: contentType });
}

// Read-only file-answer leaf shared by the reviewer detail page, the
// stepper's read-only profile card, and profile view mode. Delivery goes
// through a Server Action (no Route Handler, per this repo's convention) —
// the base64 payload is turned into a Blob client-side and downloaded via a
// programmatic anchor click.
export function AnswerFileLink({ target, url }: AnswerFileLinkProps) {
  const [isPending, setIsPending] = useState(false);
  const filename = getFileDisplayName(url);
  const Icon = filename.toLowerCase().endsWith('.pdf') ? FileText : ImageIcon;

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
    <div className="flex min-w-0 items-center gap-2">
      <Icon
        className="text-muted-foreground size-4 shrink-0"
        aria-hidden="true"
      />
      <span className="min-w-0 truncate text-sm" title={filename}>
        {filename}
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-h-11 shrink-0 sm:min-h-9"
        onClick={handleDownload}
        disabled={isPending}
        aria-label={`Download ${filename}`}
      >
        {isPending ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Preparing…
          </>
        ) : (
          <>
            <Download className="size-4" aria-hidden="true" />
            Download
          </>
        )}
      </Button>
    </div>
  );
}
