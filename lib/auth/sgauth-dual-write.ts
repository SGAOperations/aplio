import 'server-only';

import { delay } from '@/lib/delay';
import { prisma } from '@/lib/prisma';

const RETRY_DELAYS_MS = [500, 2000, 5000];
const REQUEST_TIMEOUT_MS = 10_000;

type DualWriteConfig = { url: string; secret: string; cutoverAt: Date };

export type DualWriteUser = { id: string; email: string; name: string | null };

export type DualWriteVerdict = 'store' | 'retry' | 'stop';

// All set or none: preview and local set none, so dual write is off there.
export function readDualWriteConfig(
  env: Record<string, string | undefined>,
): DualWriteConfig | null {
  const url = env.SGAUTH_URL;
  const secret = env.APLIO_DUAL_WRITE_SECRET;
  const cutover = env.APLIO_READ_CUTOVER_AT;
  if (!url || !secret || !cutover) return null;

  const cutoverAt = new Date(cutover);
  if (Number.isNaN(cutoverAt.getTime()))
    throw new Error('APLIO_READ_CUTOVER_AT is not a valid ISO 8601 time');

  return { url: url.replace(/\/+$/, ''), secret, cutoverAt };
}

// 409 and 410 are final; 400/401/404 are configuration errors a retry can't fix.
export function classifyDualWriteStatus(status: number): DualWriteVerdict {
  if (status === 200) return 'store';
  if (status >= 500) return 'retry';
  return 'stop';
}

async function postProvision(
  config: DualWriteConfig,
  user: DualWriteUser,
): Promise<Response | null> {
  try {
    return await fetch(`${config.url}/api/provision/aplio/users`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.secret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        aplioId: user.id,
        email: user.email,
        name: user.name,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    return null;
  }
}

// Run after the user row commits; never throws, so a signup is never blocked.
// Logs carry the Aplio id only, never the address.
export async function dualWriteSignup(user: DualWriteUser): Promise<void> {
  try {
    const config = readDualWriteConfig(process.env);
    if (!config) return;

    for (let attempt = 0; ; attempt++) {
      if (Date.now() >= config.cutoverAt.getTime()) return;

      const response = await postProvision(config, user);
      const verdict = response
        ? classifyDualWriteStatus(response.status)
        : 'retry';

      if (verdict === 'store' && response) {
        const body: unknown = await response.json();
        const sgauthUserId =
          typeof body === 'object' && body !== null && 'sgauthUserId' in body
            ? body.sgauthUserId
            : null;
        if (typeof sgauthUserId !== 'string' || !sgauthUserId)
          throw new Error('SGAuth provision response had no sgauthUserId');

        await prisma.user.updateMany({
          where: { id: user.id, sgauthUserId: null },
          data: { sgauthUserId },
        });
        return;
      }

      const wait = RETRY_DELAYS_MS[attempt];
      if (verdict === 'stop' || wait === undefined) {
        console.error(
          `dualWriteSignup: not provisioned for user ${user.id}`,
          response?.status ?? 'network error',
        );
        return;
      }

      await delay(wait);
    }
  } catch (error) {
    console.error(`dualWriteSignup: failed for user ${user.id}`, error);
  }
}
