'use client';

import { type ComponentProps, useTransition } from 'react';

import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { restoreDraftApplication } from '@/prisma/actions/applications';

import { isError } from '@/lib/utils';

import { Button } from '@/components/ui/button';

interface RestoreDraftButtonProps extends Pick<
  ComponentProps<typeof Button>,
  'variant' | 'size' | 'className'
> {
  applicationId: string;
  positionTitle: string;
}

export function RestoreDraftButton({
  applicationId,
  positionTitle,
  variant = 'outline',
  size = 'sm',
  className,
}: RestoreDraftButtonProps) {
  const [isPending, startTransition] = useTransition();

  function handleRestore() {
    startTransition(async () => {
      try {
        const result = await restoreDraftApplication(applicationId);
        if (result && isError(result)) {
          toast.error(result.error);
          return;
        }
        toast.success('Draft restored');
      } catch {
        toast.error('Something went wrong. Please try again.');
      }
    });
  }

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      disabled={isPending}
      aria-label={`Restore draft for ${positionTitle}`}
      onClick={handleRestore}
    >
      {isPending && (
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      )}
      Restore
    </Button>
  );
}
