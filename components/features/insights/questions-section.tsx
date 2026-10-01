import { getQuestionInsights } from '@/prisma/data/insights';

import { maxByValue } from '@/lib/insights';
import type { InsightsRange } from '@/lib/types';

import { ChoiceDistributionChart } from '@/components/features/insights/choice-distribution-chart';
import { InsightBarChart } from '@/components/features/insights/insight-bar-chart';
import {
  InsightCard,
  InsightCardSkeleton,
} from '@/components/features/insights/insight-card';
import {
  InsightSection,
  InsightSectionSkeleton,
} from '@/components/features/insights/insight-section';

interface QuestionsSectionProps {
  range: InsightsRange;
}

export async function QuestionsSection({ range }: QuestionsSectionProps) {
  const questions = await getQuestionInsights(range);
  const eligibleAnswerRates = questions.answerRates.filter((r) => r.total > 0);
  const lowestAnswerRates = eligibleAnswerRates.slice(0, 10);
  const lowestAnswerRate = eligibleAnswerRates[0];

  const topChoiceValue = maxByValue(
    questions.choiceDistributions.flatMap((q) =>
      q.values.map((v) => ({ ...v, questionLabel: q.label })),
    ),
    (v) => v.count,
  );

  const topOtherUsage = maxByValue(questions.otherUsage, (o) => o.rate ?? 0);

  return (
    <InsightSection slug="questions" title="Questions">
      <InsightCard
        title="Answer Rate"
        description="Optional questions everyone skips — lowest answer rates first."
        meta={`n = ${eligibleAnswerRates.length}`}
        takeaway={
          lowestAnswerRate
            ? `${lowestAnswerRate.label} has the lowest answer rate (${lowestAnswerRate.rate}%).`
            : undefined
        }
        isEmpty={lowestAnswerRates.length === 0}
        emptyMessage="No optional questions answered in this range."
        table={{
          headers: ['Question', 'Scope', 'Answered', 'Total', 'Rate'],
          rows: eligibleAnswerRates.map((r) => [
            r.label,
            r.positionTitle ?? 'Global',
            r.answered,
            r.total,
            r.rate !== null ? `${r.rate}%` : '—',
          ]),
        }}
      >
        <InsightBarChart
          data={lowestAnswerRates.map((r) => ({
            label: r.positionTitle
              ? `${r.label} (${r.positionTitle})`
              : r.label,
            value: r.rate ?? 0,
          }))}
        />
      </InsightCard>

      <InsightCard
        title="Choice Distribution"
        description="Answer distribution for a single- or multiple-choice question. Retired options are never dropped."
        meta={`n = ${questions.choiceDistributions.length} question${questions.choiceDistributions.length === 1 ? '' : 's'} charted`}
        takeaway={
          topChoiceValue
            ? `"${topChoiceValue.value}" is the most selected answer, on "${topChoiceValue.questionLabel}" (${topChoiceValue.count}).`
            : undefined
        }
        isEmpty={questions.choiceDistributions.length === 0}
        emptyMessage="No choice questions answered in this range."
      >
        <ChoiceDistributionChart questions={questions.choiceDistributions} />
      </InsightCard>

      <InsightCard
        title="'Other' Usage"
        description="Share of answers using free-text 'Other' instead of a listed option."
        meta={`n = ${questions.otherUsage.length}`}
        takeaway={
          topOtherUsage && topOtherUsage.rate !== null
            ? `${topOtherUsage.label} has the highest 'Other' rate (${topOtherUsage.rate}%).`
            : undefined
        }
        isEmpty={questions.otherUsage.length === 0}
        emptyMessage="No questions allow 'Other' in this range."
        table={{
          headers: ['Question', 'Rate', 'n'],
          rows: questions.otherUsage.map((o) => [
            o.label,
            o.rate !== null ? `${o.rate}%` : '—',
            o.n,
          ]),
        }}
      >
        <InsightBarChart
          data={questions.otherUsage.map((o) => ({
            label: o.label,
            value: o.rate ?? 0,
          }))}
        />
      </InsightCard>

      <InsightCard
        title="Long-Answer Effort"
        description="Length distribution of long-answer responses — a proxy for how seriously a cohort engaged."
        meta={`n = ${questions.longAnswerEffort.n}`}
        takeaway={
          questions.longAnswerEffort.medianChars !== null
            ? `Median ${questions.longAnswerEffort.medianChars.toLocaleString()} characters.`
            : undefined
        }
        isEmpty={questions.longAnswerEffort.n === 0}
        emptyMessage="No long-answer responses in this range."
        table={{
          headers: ['Length', 'Count'],
          rows: questions.longAnswerEffort.buckets.map((b) => [
            b.label,
            b.count,
          ]),
        }}
      >
        <InsightBarChart
          data={questions.longAnswerEffort.buckets.map((b) => ({
            label: b.label,
            value: b.count,
          }))}
        />
      </InsightCard>
    </InsightSection>
  );
}

export function QuestionsSectionSkeleton() {
  return (
    <InsightSectionSkeleton title="Questions">
      <InsightCardSkeleton />
      <InsightCardSkeleton />
      <InsightCardSkeleton />
      <InsightCardSkeleton />
    </InsightSectionSkeleton>
  );
}
