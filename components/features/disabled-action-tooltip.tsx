'use client';

import { type ReactElement, cloneElement, useId } from 'react';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface DisabledActionTooltipProps {
  reason: string | null;
  children: ReactElement<{ disabled?: boolean; 'aria-describedby'?: string }>;
}

// Shared "disabled with reason" pattern: hover/focus tooltip plus a
// persistent sr-only copy, since Radix unmounts closed tooltip content.
// A plain element (never a function) so a server component can pass this
// through props without crossing a function across the RSC boundary.
// Wraps in a span so hover still reaches the trigger even when the child
// itself has pointer-events:none (aria-disabled). A natively `disabled`
// child can't take focus, so the span becomes the tab stop and description
// target instead; an aria-disabled child keeps its own focus and describedby.
export function DisabledActionTooltip({
  reason,
  children,
}: DisabledActionTooltipProps) {
  const reasonId = useId();

  if (reason === null) return children;

  const childTakesFocus = !children.props.disabled;
  const trigger = childTakesFocus
    ? cloneElement(children, { 'aria-describedby': reasonId })
    : children;

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            tabIndex={childTakesFocus ? undefined : 0}
            aria-describedby={childTakesFocus ? undefined : reasonId}
          >
            {trigger}
          </span>
        </TooltipTrigger>
        <TooltipContent>{reason}</TooltipContent>
      </Tooltip>
      <span id={reasonId} className="sr-only">
        {reason}
      </span>
    </TooltipProvider>
  );
}
