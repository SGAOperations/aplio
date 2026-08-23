import type { ReactNode } from 'react';

import { answerFieldIds, cn } from '@/lib/utils';

import { QuestionCardLabel } from '@/components/features/question-card-label';

interface AnswerCardProps {
  question: { id: string; label: string; required: boolean };
  htmlFor?: string;
  invalid?: boolean;
  footer?: ReactNode;
  children: ReactNode;
}

// Card shell shared by every answer surface — editable, read-only, and stepper read-only.
export function AnswerCard({
  question,
  htmlFor,
  invalid,
  footer,
  children,
}: AnswerCardProps) {
  const { labelId } = answerFieldIds(question.id);

  return (
    <div
      className={cn(
        'bg-card rounded-lg border p-4 shadow-sm',
        invalid && 'border-destructive',
      )}
    >
      <QuestionCardLabel
        id={labelId}
        label={question.label}
        required={question.required}
        htmlFor={htmlFor}
      />
      {children}
      {footer}
    </div>
  );
}
