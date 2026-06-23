import { type ApplicationReviewAnswer } from '@/lib/types';

interface ApplicationAnswersListProps {
  answers: ApplicationReviewAnswer[];
  emptyMessage: string;
}

export function ApplicationAnswersList({
  answers,
  emptyMessage,
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
