import { getSlackConnection } from '@/prisma/data/slack';

import { CONCEPT_ICONS } from '@/lib/icons';
import { resolveSlackHandle } from '@/lib/slack/handle';

import {
  SlackConnectButton,
  SlackDisconnectButton,
} from '@/components/features/slack-connection-actions';
import { SectionCard, SectionCardSkeleton } from '@/components/ui/section-card';
import { WarningCallout } from '@/components/ui/warning-callout';

interface SlackConnectionCardProps {
  userId: string;
  callbackError: string | null;
}

export async function SlackConnectionCard({
  userId,
  callbackError,
}: SlackConnectionCardProps) {
  const connection = await getSlackConnection(userId);
  const handle = connection
    ? await resolveSlackHandle(connection.slackUserId)
    : null;

  return (
    <SectionCard
      title="Slack"
      titleAs="h2"
      subtitle="Only accounts in the SGA Slack workspace can be connected."
      icon={CONCEPT_ICONS.slack}
    >
      <div className="px-4 py-4">
        {callbackError && !connection && (
          <WarningCallout className="mb-4">{callbackError}</WarningCallout>
        )}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium">
              {connection
                ? handle
                  ? `Connected as ${handle}`
                  : 'Connected to Slack'
                : 'Not connected'}
            </p>
            <p className="text-muted-foreground text-sm">
              {connection
                ? 'Linked to your Aplio account.'
                : 'Connect the Slack account you use in the SGA workspace.'}
            </p>
          </div>
          {connection ? (
            <SlackDisconnectButton handleLabel={handle} />
          ) : (
            <SlackConnectButton />
          )}
        </div>
      </div>
    </SectionCard>
  );
}

export function SlackConnectionCardSkeleton() {
  return (
    <SectionCardSkeleton
      rows={1}
      rowShape="stacked-action"
      hasSubtitle
      hasLink={false}
    />
  );
}
