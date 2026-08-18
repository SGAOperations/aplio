import type { PositionQuestionForEdit } from '@/lib/types';

import { Card } from '@/components/ui/card';

import { PositionQuestionSummary } from './position-question-summary';

interface PositionQuestionsReadonlyProps {
  questions: PositionQuestionForEdit[];
}

export function PositionQuestionsReadonly({
  questions,
}: PositionQuestionsReadonlyProps) {
  if (questions.length === 0)
    return (
      <p className="text-muted-foreground text-sm">
        No questions were added to this position.
      </p>
    );

  return (
    <div className="flex flex-col gap-3">
      {questions.map((question) => (
        <Card key={question.id} className="p-4">
          <PositionQuestionSummary question={question} />
        </Card>
      ))}
    </div>
  );
}
