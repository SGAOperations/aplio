'use client';

import { useState } from 'react';

import type { ChoiceDistributionQuestion } from '@/lib/types';

import { InsightBarChart } from '@/components/features/insights/insight-bar-chart';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ChoiceDistributionChartProps {
  questions: ChoiceDistributionQuestion[];
}

// Never dropped — a retired option keeps its own bar, suffixed so it reads
// distinctly from a current one; colour alone never carries this distinction.
function valueLabel(
  value: ChoiceDistributionQuestion['values'][number],
): string {
  if (value.kind === 'option') return value.value;
  if (value.kind === 'other') return 'Other';
  return `${value.value} (retired option)`;
}

/** A per-question Select (local state, not URL state) over a bar chart. */
export function ChoiceDistributionChart({
  questions,
}: ChoiceDistributionChartProps) {
  const [selectedId, setSelectedId] = useState(questions[0]?.questionId ?? '');
  const question =
    questions.find((q) => q.questionId === selectedId) ?? questions[0];
  if (!question) return null;

  return (
    <div className="flex flex-col gap-3">
      <Select value={question.questionId} onValueChange={setSelectedId}>
        <SelectTrigger className="w-full" aria-label="Choose a question">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {questions.map((q) => (
            <SelectItem key={q.questionId} value={q.questionId}>
              {q.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <InsightBarChart
        data={question.values.map((v) => ({
          label: valueLabel(v),
          value: v.count,
        }))}
      />
    </div>
  );
}
