import 'server-only';

import { z } from 'zod/v4';

import { requireSlackEnv } from '@/lib/slack/config';

// Slack returns HTTP 200 with `ok: false` when it refuses a call — the one
// thing a bare fetch would read as success.
export class SlackApiError extends Error {
  constructor(
    readonly method: string,
    readonly code: string,
  ) {
    super(`Slack ${method} failed: ${code}`);
  }
}

const slackBaseSchema = z.object({
  ok: z.boolean(),
  error: z.string().optional(),
});

async function callSlack<T extends z.ZodTypeAny>(
  method: string,
  token: string,
  schema: T,
  params: Record<string, string> = {},
): Promise<z.infer<T>> {
  const response = await fetch(`https://slack.com/api/${method}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(params),
  });

  if (!response.ok) throw new SlackApiError(method, `http_${response.status}`);

  const json: unknown = await response.json();
  const base = slackBaseSchema.safeParse(json);
  if (!base.success) throw new SlackApiError(method, 'unknown_error');
  if (!base.data.ok)
    throw new SlackApiError(method, base.data.error ?? 'unknown_error');

  const parsed = schema.safeParse(json);
  if (!parsed.success) throw new SlackApiError(method, 'unknown_error');
  return parsed.data;
}

const postMessageResponseSchema = z.object({
  channel: z.string(),
  ts: z.string(),
});

export async function postMessage(params: {
  channel: string;
  text: string;
  blocks?: unknown[];
}): Promise<{ channel: string; ts: string }> {
  const token = requireSlackEnv('SLACK_BOT_TOKEN');
  const body: Record<string, string> = {
    channel: params.channel,
    text: params.text,
  };
  if (params.blocks) body.blocks = JSON.stringify(params.blocks);

  return callSlack('chat.postMessage', token, postMessageResponseSchema, body);
}

const lookupByEmailResponseSchema = z.object({
  user: z.object({ id: z.string(), team_id: z.string() }),
});

// Slack's real miss code is `users_not_found`, not `user_not_found`.
export async function lookupByEmail(
  email: string,
): Promise<{ id: string; teamId: string }> {
  const token = requireSlackEnv('SLACK_BOT_TOKEN');
  const result = await callSlack(
    'users.lookupByEmail',
    token,
    lookupByEmailResponseSchema,
    { email },
  );
  return { id: result.user.id, teamId: result.user.team_id };
}

const getUserResponseSchema = z.object({
  user: z.object({
    name: z.string().optional(),
    real_name: z.string().optional(),
    profile: z
      .object({
        display_name: z.string().optional(),
        real_name: z.string().optional(),
      })
      .optional(),
  }),
});

export interface SlackUserInfo {
  displayName: string;
  realName: string;
  name: string;
}

// Needs the `users:read` scope on the bot token.
export async function getUser(slackUserId: string): Promise<SlackUserInfo> {
  const token = requireSlackEnv('SLACK_BOT_TOKEN');
  const result = await callSlack('users.info', token, getUserResponseSchema, {
    user: slackUserId,
  });
  return {
    displayName: result.user.profile?.display_name ?? '',
    realName: result.user.profile?.real_name ?? result.user.real_name ?? '',
    name: result.user.name ?? '',
  };
}

const openIdUserInfoResponseSchema = z.object({
  sub: z.string(),
  'https://slack.com/team_id': z.string(),
  name: z.string().optional(),
  email: z.string().optional(),
  email_verified: z.boolean().optional(),
  picture: z.string().optional(),
});

export interface SlackOpenIdUserInfo {
  sub: string;
  teamId: string;
  name?: string;
  email?: string;
  emailVerified: boolean;
  picture?: string;
  [key: string]: unknown;
}

export async function getOpenIdUserInfo(
  accessToken: string,
): Promise<SlackOpenIdUserInfo> {
  const result = await callSlack(
    'openid.connect.userInfo',
    accessToken,
    openIdUserInfoResponseSchema,
  );
  return {
    sub: result.sub,
    teamId: result['https://slack.com/team_id'],
    name: result.name,
    email: result.email,
    emailVerified: result.email_verified ?? false,
    picture: result.picture,
  };
}
