import { getEmailInsights } from '@/prisma/data/insights';

import {
  DECISION_EMAIL_DELAY_SECONDS,
  EMAIL_STATUS_LABELS,
  EMAIL_TEMPLATE_LABELS,
  ORG_TIMEZONE,
} from '@/lib/constants';
import { formatInstant } from '@/lib/dates';
import type { InsightsRange } from '@/lib/types';

import { InsightBarChart } from '@/components/features/insights/insight-bar-chart';
import {
  InsightCard,
  InsightCardSkeleton,
} from '@/components/features/insights/insight-card';
import {
  InsightSection,
  InsightSectionSkeleton,
} from '@/components/features/insights/insight-section';
import { InsightStackedBarChart } from '@/components/features/insights/insight-stacked-bar-chart';
import { InsightTile } from '@/components/features/insights/insight-tile';

// Collapses the 8 raw statuses to the 5 series the chart draws; the data
// table underneath keeps all 8.
const DELIVERY_SERIES = [
  { key: 'delivered', label: 'Delivered', statuses: ['delivered'] },
  { key: 'sent', label: 'Sent (unconfirmed)', statuses: ['sent'] },
  {
    key: 'undeliverable',
    label: 'Undeliverable',
    statuses: ['bounced', 'complained', 'suppressed'],
  },
  { key: 'failed', label: 'Failed', statuses: ['failed'] },
  {
    key: 'cancelledOrScheduled',
    label: 'Cancelled / Scheduled',
    statuses: ['cancelled', 'scheduled'],
  },
] as const;

interface EmailSectionProps {
  range: InsightsRange;
}

export async function EmailSection({ range }: EmailSectionProps) {
  const email = await getEmailInsights(range);

  const templates = [
    ...new Set(email.deliveryByTemplate.map((r) => r.template)),
  ];
  const deliveryData = templates.map((template) => {
    const row: Record<string, string | number> = {
      label:
        EMAIL_TEMPLATE_LABELS[template as keyof typeof EMAIL_TEMPLATE_LABELS],
    };
    for (const series of DELIVERY_SERIES)
      row[series.key] = email.deliveryByTemplate
        .filter(
          (r) =>
            r.template === template &&
            series.statuses.includes(r.status as never),
        )
        .reduce((sum, r) => sum + r.count, 0);
    return row;
  });

  const historyNote =
    range.start && range.start < email.historyStart
      ? `Email logging started ${formatInstant(email.historyStart, { precision: 'date', timeZone: ORG_TIMEZONE })}; earlier sends aren't recorded.`
      : undefined;

  return (
    <InsightSection slug="email" title="Email">
      <InsightCard
        title="Delivery Funnel by Template"
        description="Delivered, sent-unconfirmed, undeliverable, failed, and cancelled/scheduled counts per template."
        meta={historyNote}
        isEmpty={email.deliveryByTemplate.length === 0}
        emptyMessage="No emails in this range."
        table={{
          headers: ['Template', 'Status', 'Count'],
          rows: email.deliveryByTemplate.map((r) => [
            EMAIL_TEMPLATE_LABELS[
              r.template as keyof typeof EMAIL_TEMPLATE_LABELS
            ],
            EMAIL_STATUS_LABELS[r.status as keyof typeof EMAIL_STATUS_LABELS],
            r.count,
          ]),
        }}
      >
        <InsightStackedBarChart
          data={deliveryData}
          keys={DELIVERY_SERIES.map((s) => ({ key: s.key, label: s.label }))}
        />
      </InsightCard>

      <InsightCard
        title="Bounce Rate by Type"
        description="Bounced emails grouped by provider bounce type, and the top failure reasons behind them."
        isEmpty={email.bounceByType.length === 0}
        emptyMessage="No bounces in this range."
        table={{
          headers: ['Reason', 'Count'],
          rows: email.bounceErrors.map((e) => [e.error, e.count]),
        }}
      >
        <InsightBarChart
          data={email.bounceByType.map((b) => ({
            label: b.bounceType,
            value: b.count,
          }))}
        />
      </InsightCard>

      <div className="flex flex-col gap-4">
        <InsightTile
          label="Scheduled-to-sent lag"
          value={
            email.lag.medianMinutes !== null
              ? `${Math.round(email.lag.medianMinutes)}m`
              : '—'
          }
          caption={
            email.lag.p95Minutes !== null
              ? `p95 ${Math.round(email.lag.p95Minutes)}m · n = ${email.lag.n}`
              : undefined
          }
        />
        <InsightTile
          label="Cancelled sends"
          value={String(email.lag.cancelledCount)}
          caption={`The ${DECISION_EMAIL_DELAY_SECONDS}s decision-email undo window, in practice.`}
        />
      </div>
    </InsightSection>
  );
}

export function EmailSectionSkeleton() {
  return (
    <InsightSectionSkeleton title="Email">
      <InsightCardSkeleton />
      <InsightCardSkeleton />
      <div className="flex flex-col gap-4">
        <InsightCardSkeleton />
      </div>
    </InsightSectionSkeleton>
  );
}
