import type { AnswerQuestion, QuestionFileTarget } from '@/lib/types';
import { answerFieldIds, partitionAnswerValue } from '@/lib/utils';

import { AnswerFileLink } from '@/components/features/answer-file-link';
import { AnswerMismatchNotice } from '@/components/features/answer-mismatch-notice';

interface AnswerDisplayProps {
  question: AnswerQuestion;
  value: string[];
  fileTarget: QuestionFileTarget;
}

// Read-only rendering shared by the profile view mode and the stepper's read-only step.
export function AnswerDisplay({
  question,
  value,
  fileTarget,
}: AnswerDisplayProps) {
  const { noticeId } = answerFieldIds(question.id);
  // Full stored value renders as-is; orphaned only flags the mismatch, it isn't hidden.
  const { orphaned } = partitionAnswerValue(question, value);

  return (
    <>
      {orphaned.length > 0 && (
        <AnswerMismatchNotice
          id={noticeId}
          values={orphaned}
          questionType={question.type}
        />
      )}

      {value.length === 0 ? (
        <p className="text-muted-foreground text-sm italic">No answer yet</p>
      ) : question.type === 'file_upload' ? (
        <AnswerFileLink target={fileTarget} url={value[0] ?? ''} />
      ) : question.type === 'multiple_choice' ? (
        <div className="flex flex-wrap gap-1.5">
          {value.map((v) => (
            <span
              key={v}
              className="bg-muted text-muted-foreground rounded-md px-2 py-0.5 text-sm"
            >
              {v}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-foreground text-base font-medium">{value[0]}</p>
      )}
    </>
  );
}
