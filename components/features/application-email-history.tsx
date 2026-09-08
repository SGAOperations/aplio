import { Mail } from 'lucide-react';

import { getApplicationEmailHistory } from '@/prisma/data/applications';

import { EMAIL_TEMPLATE_LABELS } from '@/lib/constants';
import { type ApplicationEmailEntry, type Reviewer } from '@/lib/types';
import { getEmailLogDescription } from '@/lib/utils';

import { EmailStatusBadge } from '@/components/features/status-badge';
import { LocalTime } from '@/components/ui/local-time';
import { SectionCard, SectionCardEmpty } from '@/components/ui/section-card';

interface ApplicationEmailHistoryProps {
  applicationId: string;
  user: Reviewer;
}

export async function ApplicationEmailHistory({
  applicationId,
  user,
}: ApplicationEmailHistoryProps) {
  const entries = await getApplicationEmailHistory(applicationId, user);

  return (
    <SectionCard
      title="Email history"
      titleAs="h2"
      subtitle="Emails sent to this applicant about this application."
    >
      {entries.length === 0 ? (
        <SectionCardEmpty
          icon={Mail}
          title="No emails yet"
          description="Nothing has been emailed to this applicant about this application."
        />
      ) : (
        <EmailHistoryList entries={entries} />
      )}
    </SectionCard>
  );
}

function EmailHistoryList({ entries }: { entries: ApplicationEmailEntry[] }) {
  return (
    <ul className="divide-y">
      {entries.map((entry) => {
        const description = getEmailLogDescription(entry);
        return (
          <li key={entry.id} className="px-4 py-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="min-w-0 flex-1 text-sm font-medium">
                {entry.subject}
              </span>
              <EmailStatusBadge status={entry.status} />
            </div>
            <p className="text-muted-foreground mt-1 text-xs">
              {EMAIL_TEMPLATE_LABELS[entry.template]} ·{' '}
              <LocalTime date={entry.occurredAt} precision="datetime" />
              {description && <> · {description}</>}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
