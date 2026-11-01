'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { z } from 'zod/v4';

import {
  GATE_COOKIE,
  GATE_MAX_AGE_SECONDS,
  GATE_PATH,
  createAttemptLimiter,
  nowSeconds,
  passwordMatches,
  readGateConfig,
  safeNextPath,
  signGateCookie,
} from '@/lib/preview-gate';

const unlockLimiter = createAttemptLimiter({
  limit: 10,
  windowMs: 15 * 60_000,
  maxKeys: 10_000,
});

const passwordSchema = z.string().min(1).max(256);

function backToGate(error: 'wrong' | 'rate', next: string): never {
  const params = new URLSearchParams({ error, next });
  redirect(`${GATE_PATH}?${params.toString()}`);
}

// No auth check: the pre-auth surface the gate itself guards.
export async function unlockPreviewGate(formData: FormData): Promise<void> {
  const config = readGateConfig(process.env);
  if (config.mode !== 'on') throw new Error('Preview gate is not active');

  const next = safeNextPath(formData.get('next'));

  // Safe only on Vercel, which overwrites x-forwarded-for.
  const ip =
    (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown';
  // Counted before parsing, so malformed submissions are limited too.
  if (!unlockLimiter.hit(ip, Date.now())) backToGate('rate', next);

  const parsed = passwordSchema.safeParse(formData.get('password'));
  if (!parsed.success || !(await passwordMatches(parsed.data, config.password)))
    backToGate('wrong', next);

  const value = await signGateCookie(config.password, nowSeconds());
  (await cookies()).set(GATE_COOKIE, value, {
    path: '/',
    maxAge: GATE_MAX_AGE_SECONDS,
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
  });
  redirect(next);
}
