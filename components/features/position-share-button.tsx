'use client';

import { useState } from 'react';

import { toast } from 'sonner';

import { ACTION_ICONS } from '@/lib/icons';
import { cn } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

interface PositionShareButtonProps {
  url: string;
  className?: string;
}

export function PositionShareButton({
  url,
  className,
}: PositionShareButtonProps) {
  const [fallbackOpen, setFallbackOpen] = useState(false);

  async function handleShare() {
    const clipboard = (navigator as { clipboard?: Clipboard }).clipboard;
    if (!clipboard) {
      setFallbackOpen(true);
      return;
    }
    try {
      await clipboard.writeText(url);
      toast.success('Link copied');
    } catch {
      setFallbackOpen(true);
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className={cn('min-h-11 sm:min-h-9', className)}
        onClick={() => void handleShare()}
      >
        <ACTION_ICONS.copyLink />
        Copy link
      </Button>

      <Dialog open={fallbackOpen} onOpenChange={setFallbackOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Copy this link</DialogTitle>
            <DialogDescription>
              Your browser blocked the copy. Select the link below and copy it
              manually.
            </DialogDescription>
          </DialogHeader>
          <Input
            readOnly
            value={url}
            aria-label="Position link"
            autoFocus
            onFocus={(e) => e.currentTarget.select()}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
