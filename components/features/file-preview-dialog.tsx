'use client';

import Image from 'next/image';
import { useRef, useState } from 'react';

import { toast } from 'sonner';

import { downloadQuestionFileAnswer } from '@/prisma/actions/question-files';

import { base64ToBlob, getFilePreviewKind } from '@/lib/files';
import { ACTION_ICONS, STATE_ICONS } from '@/lib/icons';
import type { QuestionFileTarget } from '@/lib/types';
import { isError } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';

interface FilePreviewDialogProps {
  target: QuestionFileTarget;
  filename: string;
  children: React.ReactNode;
}

interface Preview {
  objectUrl: string;
  contentType: string;
}

// Fetch runs from onOpenChange, not a useEffect — there is no mount to sync to.
export function FilePreviewDialog({
  target,
  filename,
  children,
}: FilePreviewDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const requestIdRef = useRef(0);

  async function handleOpen() {
    const requestId = ++requestIdRef.current;
    setIsPending(true);
    try {
      const result = await downloadQuestionFileAnswer(target);
      if (requestId !== requestIdRef.current) return;
      if (isError(result)) {
        toast.error(result.error);
        setOpen(false);
        return;
      }
      const blob = base64ToBlob(result.data, result.contentType);
      setPreview({
        objectUrl: URL.createObjectURL(blob),
        contentType: result.contentType,
      });
    } catch {
      if (requestId !== requestIdRef.current) return;
      toast.error('Something went wrong');
      setOpen(false);
    } finally {
      if (requestId === requestIdRef.current) setIsPending(false);
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      void handleOpen();
      return;
    }
    requestIdRef.current++;
    if (preview) URL.revokeObjectURL(preview.objectUrl);
    setPreview(null);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogTitle className="truncate" title={filename}>
          {filename}
        </DialogTitle>
        <DialogDescription>
          Preview only — download the file to keep a copy.
        </DialogDescription>

        {isPending || !preview ? (
          <Skeleton className="h-[70vh] w-full" />
        ) : (
          <FilePreviewBody
            objectUrl={preview.objectUrl}
            contentType={preview.contentType}
            filename={filename}
          />
        )}

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Close
            </Button>
          </DialogClose>
          {preview ? (
            <Button asChild>
              <a href={preview.objectUrl} download={filename}>
                <ACTION_ICONS.download />
                Download
              </a>
            </Button>
          ) : (
            <Button type="button" disabled>
              <ACTION_ICONS.download />
              Download
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface FilePreviewBodyProps {
  objectUrl: string;
  contentType: string;
  filename: string;
}

function FilePreviewBody({
  objectUrl,
  contentType,
  filename,
}: FilePreviewBodyProps) {
  const kind = getFilePreviewKind(contentType);

  switch (kind) {
    case 'image':
      return (
        <Image
          src={objectUrl}
          alt={filename}
          width={0}
          height={0}
          unoptimized
          className="mx-auto h-auto max-h-[70vh] w-auto max-w-full"
        />
      );
    case 'pdf':
      return (
        <div className="flex flex-col gap-2">
          <iframe
            src={objectUrl}
            title={filename}
            className="h-[70vh] w-full rounded-md border"
          />
          <p className="text-muted-foreground text-xs">
            Not displaying? Download the file to open it in your device&apos;s
            viewer.
          </p>
        </div>
      );
    case 'unsupported':
      return (
        <div className="text-muted-foreground flex flex-col items-center gap-2 py-12 text-center text-sm">
          <STATE_ICONS.info className="size-8" />
          <p>
            This file can&apos;t be previewed here. Download it to open it on
            your device.
          </p>
        </div>
      );
    default: {
      const exhaustiveCheck: never = kind;
      return exhaustiveCheck;
    }
  }
}
