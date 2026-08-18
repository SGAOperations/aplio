import {
  QUESTION_TYPE_BADGE_VARIANT,
  QUESTION_TYPE_LABELS,
  SHORT_ANSWER_FORMAT_LABELS,
} from '@/lib/constants';
import type { PositionQuestionForEdit } from '@/lib/types';

import { QuestionOptionChips } from '@/components/features/question-option-chips';
import { Badge } from '@/components/ui/badge';

interface PositionQuestionSummaryProps {
  question: PositionQuestionForEdit;
}

// Extracted so the editable and read-only question lists can't drift.
export function PositionQuestionSummary({
  question,
}: PositionQuestionSummaryProps) {
  return (
    <div className="flex-1">
      <p className="text-sm font-medium">{question.label}</p>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <Badge variant={QUESTION_TYPE_BADGE_VARIANT[question.type]}>
          {QUESTION_TYPE_LABELS[question.type]}
        </Badge>
        {question.format && (
          <Badge variant="outline">
            {SHORT_ANSWER_FORMAT_LABELS[question.format]}
          </Badge>
        )}
        <span className="text-muted-foreground text-xs">
          {question.required ? 'Required' : 'Optional'}
        </span>
      </div>
      <QuestionOptionChips
        options={question.options}
        allowOther={question.allowOther}
        className="mt-1"
      />
    </div>
  );
}
