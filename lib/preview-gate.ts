// No next/* imports and Web Crypto only, so the proxy and the unit project can both load it.
export const GATE_COOKIE = '__Host-aplio.preview-gate';
export const GATE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
export const GATE_PATH = '/preview-gate';

const CLOCK_SKEW_SECONDS = 60;

// Exact paths: each authenticates its caller with its own secret.
const EXEMPT_PATHS = new Set([
  '/api/webhooks/resend',
  '/api/cron/manager-daily-digest',
  '/api/cron/manager-weekly-digest',
]);

export function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export type GateConfig =
  | { mode: 'off' }
  | { mode: 'misconfigured' }
  | { mode: 'on'; password: string };

// Previews fail closed without a password unless explicitly opted out.
export function readGateConfig(
  env: Record<string, string | undefined>,
): GateConfig {
  const vercelEnv = env.VERCEL_ENV;
  if (vercelEnv !== 'preview' || env.APLIO_PREVIEW_GATE === 'off')
    return { mode: 'off' };
  const password = env.APLIO_PREVIEW_GATE_PASSWORD;
  return password ? { mode: 'on', password } : { mode: 'misconfigured' };
}

function stripTrailingSlash(pathname: string): string {
  return pathname.length > 1 && pathname.endsWith('/')
    ? pathname.slice(0, -1)
    : pathname;
}

export function isExemptPath(pathname: string): boolean {
  return EXEMPT_PATHS.has(stripTrailingSlash(pathname));
}

export function isGatePath(pathname: string): boolean {
  return stripTrailingSlash(pathname) === GATE_PATH;
}

const encoder = new TextEncoder();

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

function toBase64Url(bytes: ArrayBuffer): string {
  return Buffer.from(bytes).toString('base64url');
}

// Keyed by the password itself, so rotating it invalidates every cookie.
function gateSecret(password: string): string {
  return `aplio-preview-gate.v1|${password}`;
}

export async function signGateCookie(
  password: string,
  nowSeconds: number,
): Promise<string> {
  const exp = nowSeconds + GATE_MAX_AGE_SECONDS;
  const key = await hmacKey(gateSecret(password));
  const mac = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(`v1.${exp}`),
  );
  return `${exp}.${toBase64Url(mac)}`;
}

export async function verifyGateCookie(
  password: string,
  value: string | undefined,
  nowSeconds: number,
): Promise<boolean> {
  if (!value) return false;
  const [expRaw, macRaw, extra] = value.split('.');
  if (!expRaw || !macRaw || extra !== undefined) return false;
  if (!/^[1-9]\d{0,15}$/.test(expRaw)) return false;

  const exp = Number(expRaw);
  if (exp <= nowSeconds) return false;
  if (exp > nowSeconds + GATE_MAX_AGE_SECONDS + CLOCK_SKEW_SECONDS)
    return false;

  const key = await hmacKey(gateSecret(password));
  // subtle.verify compares in constant time.
  return crypto.subtle.verify(
    'HMAC',
    key,
    Buffer.from(macRaw, 'base64url'),
    encoder.encode(`v1.${exp}`),
  );
}

// Both sides are MACed with a fresh key first, so the compare is constant-time.
export async function passwordMatches(
  input: string,
  expected: string,
): Promise<boolean> {
  const key = await hmacKey(crypto.randomUUID());
  const expectedMac = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(expected),
  );
  return crypto.subtle.verify('HMAC', key, expectedMac, encoder.encode(input));
}

// A same-site absolute path outside the gate, else '/'.
export function safeNextPath(raw: unknown): string {
  if (
    typeof raw !== 'string' ||
    raw.length > 2048 ||
    !raw.startsWith('/') ||
    raw.startsWith('//') ||
    raw.startsWith('/\\') ||
    /[\u0000-\u001f\u007f]/.test(raw)
  )
    return '/';
  const pathname = raw.split(/[?#]/, 1)[0] ?? raw;
  return isGatePath(pathname) ? '/' : raw;
}

type AttemptWindow = { count: number; resetAt: number };

// In-memory fixed window per key, per instance.
export function createAttemptLimiter(options: {
  limit: number;
  windowMs: number;
  maxKeys: number;
}) {
  const windows = new Map<string, AttemptWindow>();
  return {
    hit(key: string, nowMs: number): boolean {
      for (const [k, w] of windows) if (w.resetAt <= nowMs) windows.delete(k);

      let entry = windows.get(key);
      if (!entry) {
        // Map iterates in insertion order, so the first key is the oldest.
        while (windows.size >= options.maxKeys) {
          const oldest = windows.keys().next().value;
          if (oldest === undefined) break;
          windows.delete(oldest);
        }
        entry = { count: 0, resetAt: nowMs + options.windowMs };
        windows.set(key, entry);
      }
      entry.count += 1;
      return entry.count <= options.limit;
    },
  };
}
