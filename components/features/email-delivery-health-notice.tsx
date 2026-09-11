import { getDeliveryEventHealth } from '@/prisma/data/emails';

import { WarningCallout } from '@/components/ui/warning-callout';

export async function EmailDeliveryHealthNotice() {
  const { awaitingEvents, recentEvents } = await getDeliveryEventHealth();
  if (awaitingEvents === 0 || recentEvents > 0) return null;

  return (
    <WarningCallout>
      <p>
        <strong>Delivery events aren&apos;t arriving.</strong> {awaitingEvents}{' '}
        {awaitingEvents === 1 ? 'email' : 'emails'} sent in the last 7 days,
        none confirmed delivered. Check that the Resend webhook is registered
        for /api/webhooks/resend and subscribed to the delivered, bounced,
        complained and suppressed events.
      </p>
    </WarningCallout>
  );
}
