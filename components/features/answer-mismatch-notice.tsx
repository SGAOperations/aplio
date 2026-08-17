import { TriangleAlert } from 'lucide-react';

import type { QuestionType } from '@/prisma/client';

import { WarningCallout } from '@/components/ui/warning-callout';

interface AnswerMismatchNoticeProps {
  id: string;
  values: string[];
  questionType: QuestionType;
}

// Callers wire `id` to the control's `aria-describedby`.
export function AnswerMismatchNotice({
  id,
  values,
  questionType,
}: AnswerMismatchNoticeProps) {
  if (values.length === 0) return null;

  return (
    <WarningCallout id={id} icon={TriangleAlert} className="mb-2">
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
    </WarningCallout>
  );
}
