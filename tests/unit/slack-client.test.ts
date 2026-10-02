import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  SlackApiError,
  getOpenIdUserInfo,
  lookupByEmail,
  postMessage,
} from '@/lib/slack/client';
import { resolveSlackHandle } from '@/lib/slack/handle';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('Slack client', () => {
  beforeEach(() => {
    vi.stubEnv('SLACK_BOT_TOKEN', 'xoxb-test-token');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('postMessage rejects an ok:false refusal with the Slack error code', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse(200, { ok: false, error: 'not_in_channel' }),
        ),
    );

    const error = await postMessage({ channel: 'C123', text: 'hello' }).catch(
      (err: unknown) => err,
    );

    expect(error).toBeInstanceOf(SlackApiError);
    expect((error as SlackApiError).code).toBe('not_in_channel');
    expect((error as SlackApiError).method).toBe('chat.postMessage');
    expect((error as SlackApiError).message).toContain('not_in_channel');
  });

  it('lookupByEmail rejects an ok:false refusal with users_not_found', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse(200, { ok: false, error: 'users_not_found' }),
        ),
    );

    const error = await lookupByEmail('nobody@example.com').catch(
      (err: unknown) => err,
    );

    expect(error).toBeInstanceOf(SlackApiError);
    expect((error as SlackApiError).code).toBe('users_not_found');
  });

  it('maps a non-2xx response to an http_<status> code', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(429, {})));

    const error = await postMessage({ channel: 'C123', text: 'hi' }).catch(
      (err: unknown) => err,
    );

    expect(error).toBeInstanceOf(SlackApiError);
    expect((error as SlackApiError).code).toBe('http_429');
  });

  it('throws before fetch when SLACK_BOT_TOKEN is missing', async () => {
    vi.stubEnv('SLACK_BOT_TOKEN', '');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(postMessage({ channel: 'C123', text: 'hi' })).rejects.toThrow(
      'SLACK_BOT_TOKEN is not configured',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends the bearer token and a form-encoded body on success', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(200, { ok: true, channel: 'C123', ts: '123.45' }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const result = await postMessage({ channel: 'C123', text: 'hello' });

    expect(result).toEqual({ channel: 'C123', ts: '123.45' });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://slack.com/api/chat.postMessage');
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer xoxb-test-token',
      'Content-Type': 'application/x-www-form-urlencoded',
    });
    expect(init.body).toBeInstanceOf(URLSearchParams);
    expect((init.body as URLSearchParams).get('channel')).toBe('C123');
    expect((init.body as URLSearchParams).get('text')).toBe('hello');
  });

  it('getOpenIdUserInfo maps the team claim', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse(200, {
            ok: true,
            sub: 'U123',
            'https://slack.com/team_id': 'T456',
            name: 'Ada Lovelace',
            email: 'ada@example.com',
            email_verified: true,
          }),
        ),
    );

    const result = await getOpenIdUserInfo('user-access-token');

    expect(result).toEqual({
      sub: 'U123',
      teamId: 'T456',
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      emailVerified: true,
      picture: undefined,
    });
  });

  it('resolveSlackHandle returns null and logs the code on a refusal', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse(200, { ok: false, error: 'invalid_auth' }),
        ),
    );

    const handle = await resolveSlackHandle('U123');

    expect(handle).toBeNull();
    expect(consoleError).toHaveBeenCalledWith(
      expect.any(String),
      'invalid_auth',
    );
    consoleError.mockRestore();
  });
});
