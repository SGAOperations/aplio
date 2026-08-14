import { TriangleAlert } from 'lucide-react';

import type { QuestionType } from '@/prisma/client';

interface AnswerMismatchNoticeProps {
  id: string;
  values: string[];
  questionType: QuestionType;
}

// Renders every orphaned value so nothing is silently dropped; callers wire
// `id` to the control via `aria-describedby`.
export function AnswerMismatchNotice({
  id,
  values,
  questionType,
}: AnswerMismatchNoticeProps) {
  if (values.length === 0) return null;

  return (
    <div
      id={id}
      className="border-warning/40 bg-warning/10 text-warning-foreground mb-2 flex gap-2 rounded-lg border p-3 text-sm"
    >
      <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="flex flex-col gap-1">
        <p className="font-medium">This question has changed</p>
        <p>
          Your previous answer no longer matches the available choices.
          It&apos;s saved below until you answer again.
        </p>
        {questionType === 'multiple_choice' ? (
          <div className="mt-1 flex flex-wrap gap-1.5">
            {values.map((v, i) => (
              <span
                key={i}
                className="bg-warning/20 rounded-md px-2 py-0.5 text-xs font-medium"
              >
                {v}
              </span>
            ))}
          </div>
        ) : (
          <ul className="mt-1 flex flex-col gap-0.5">
            {values.map((v, i) => (
              <li key={i} className="font-medium">
                {v}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
