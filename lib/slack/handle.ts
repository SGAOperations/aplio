import 'server-only';

import { SlackApiError, getUser } from '@/lib/slack/client';

// Fail-open: a Slack outage must not take /profile down.
export async function resolveSlackHandle(
  slackUserId: string,
): Promise<string | null> {
  try {
    const user = await getUser(slackUserId);
    const handle = user.displayName || user.realName || user.name;
    return handle ? `@${handle}` : null;
  } catch (err) {
    console.error(
      'resolveSlackHandle failed',
      err instanceof SlackApiError ? err.code : err,
    );
    return null;
  }
}
