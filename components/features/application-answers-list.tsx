import { type ApplicationReviewAnswer } from '@/lib/types';

import { AnswerFileLink } from '@/components/features/answer-file-link';
import { Badge } from '@/components/ui/badge';

interface ApplicationAnswersListProps {
  answers: ApplicationReviewAnswer[];
  emptyMessage: string;
  applicationId: string;
}

function ChipList({ values }: { values: string[] }) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {values.map((v, i) => (
        <li key={i}>
          <Badge variant="secondary">{v}</Badge>
        </li>
      ))}
    </ul>
  );
}

function AnswerValue({
  answer,
  applicationId,
}: {
  answer: ApplicationReviewAnswer;
  applicationId: string;
}) {
  if (answer.value.length === 0)
    return <dd className="text-muted-foreground text-sm">No answer</dd>;

  switch (answer.type) {
    case 'file_upload':
      return (
        <dd>
          <AnswerFileLink
            target={{
              scope: 'application',
              applicationId,
              questionId: answer.questionId,
              isGlobal: answer.isGlobal,
            }}
            url={answer.value[0] ?? ''}
          />
        </dd>
      );
    case 'multiple_choice':
      return (
        <dd>
          <ChipList values={answer.value} />
        </dd>
      );
    case 'single_choice':
      return answer.value.length > 1 ? (
        <dd>
          <ChipList values={answer.value} />
        </dd>
      ) : (
        <dd>
          <Badge variant="secondary">{answer.value[0]}</Badge>
        </dd>
      );
    case 'long_answer':
      return answer.value.length > 1 ? (
        <dd>
          <ChipList values={answer.value} />
        </dd>
      ) : (
        <dd className="max-w-prose text-sm leading-relaxed whitespace-pre-wrap">
          {answer.value[0]}
        </dd>
      );
    case 'short_answer':
      return answer.value.length > 1 ? (
        <dd>
          <ChipList values={answer.value} />
        </dd>
      ) : (
        <dd className="text-sm break-words">{answer.value[0]}</dd>
      );
    default: {
      const exhaustiveCheck: never = answer.type;
      return exhaustiveCheck;
    }
  }
}

function isFullWidthAnswer(answer: ApplicationReviewAnswer) {
  return answer.type === 'long_answer' && answer.value.length <= 1;
}

export function ApplicationAnswersList({
  answers,
  emptyMessage,
  applicationId,
}: ApplicationAnswersListProps) {
  if (answers.length === 0)
    return <p className="text-muted-foreground text-sm">{emptyMessage}</p>;

  return (
    <dl className="divide-y">
      {answers.map((answer) => (
        <div
          key={answer.id}
          className={
            isFullWidthAnswer(answer)
              ? 'flex flex-col gap-1.5 px-4 py-3'
              : 'px-4 py-3 sm:grid sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)] sm:gap-4'
          }
        >
          <dt className="text-muted-foreground text-sm">
            {answer.questionLabel}
          </dt>
          <AnswerValue answer={answer} applicationId={applicationId} />
        </div>
      ))}
    </dl>
  );
}
