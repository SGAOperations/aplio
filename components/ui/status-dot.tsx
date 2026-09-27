import { STATUS_BADGE_VARIANT_TO_DOT } from '@/lib/constants';
import { cn } from '@/lib/utils';

import type { BadgeVariant } from '@/components/ui/badge';

interface StatusDotProps {
  variant: BadgeVariant;
  className?: string;
}

// Decorative only — colour is always redundant with an adjacent text label.
export function StatusDot({ variant, className }: StatusDotProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'size-2 shrink-0 rounded-full',
        STATUS_BADGE_VARIANT_TO_DOT[variant],
        className,
      )}
    />
  );
}
