import { cn } from '@/lib/utils';

import { Badge } from '@/components/ui/badge';

interface QuestionOptionChipsProps {
  options: string[];
  allowOther: boolean;
  className?: string;
}

// Shared read-only chip row for question options + "+ Other", used by the
// global questions table (desktop + mobile) and the position questions list.
export function QuestionOptionChips({
  options,
  allowOther,
  className,
}: QuestionOptionChipsProps) {
  if (options.length === 0 && !allowOther) return null;

  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {options.map((option) => (
        <Badge key={option} variant="secondary">
          {option}
        </Badge>
      ))}
      {allowOther && <Badge variant="secondary">+ Other</Badge>}
    </div>
  );
}
