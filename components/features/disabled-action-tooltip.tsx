'use client';

import { type ReactNode, useId } from 'react';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface DisabledActionTooltipProps {
  reason: string | null;
  children: (describedBy: string | undefined) => ReactNode;
}

// Shared "disabled with reason" pattern: hover/focus tooltip plus a
// persistent sr-only copy, since Radix unmounts closed tooltip content.
export function DisabledActionTooltip({
  reason,
  children,
}: DisabledActionTooltipProps) {
  const reasonId = useId();

  if (reason === null) return children(undefined);

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>{children(reasonId)}</TooltipTrigger>
        <TooltipContent>{reason}</TooltipContent>
      </Tooltip>
      <span id={reasonId} className="sr-only">
        {reason}
      </span>
    </TooltipProvider>
  );
}
