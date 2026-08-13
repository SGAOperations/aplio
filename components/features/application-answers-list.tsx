import { type ApplicationReviewAnswer } from '@/lib/types';

import { AnswerFileLink } from '@/components/features/answer-file-link';

interface ApplicationAnswersListProps {
  answers: ApplicationReviewAnswer[];
  emptyMessage: string;
  applicationId: string;
}

export function ApplicationAnswersList({
  answers,
  emptyMessage,
  applicationId,
}: ApplicationAnswersListProps) {
  if (answers.length === 0)
    return <p className="text-muted-foreground text-sm">{emptyMessage}</p>;

  return (
    <div className="flex flex-col gap-4">
      {answers.map((answer) => (
        <div key={answer.id} className="flex flex-col gap-1">
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            {answer.questionLabel}
          </p>
          {answer.value.length === 0 ? (
            <p className="text-muted-foreground text-sm">—</p>
          ) : answer.type === 'file_upload' ? (
            <AnswerFileLink
              target={{
                scope: 'application',
                applicationId,
                questionId: answer.questionId,
                isGlobal: answer.isGlobal,
              }}
              url={answer.value[0]}
            />
          ) : answer.value.length === 1 ? (
            <p className="text-sm">{answer.value[0]}</p>
          ) : (
            <ul className="list-disc pl-4 text-sm">
              {answer.value.map((v, i) => (
                <li key={i}>{v}</li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
