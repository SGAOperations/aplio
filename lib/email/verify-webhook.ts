import 'server-only';

// EdDSA (Ed25519) signature verification for Neon Auth webhook requests.
//
// Neon signs each webhook request with an Ed25519 private key and includes:
//   X-Neon-Signature      — base64url-encoded signature over the raw body bytes
//   X-Neon-Signature-Kid  — key ID matching a JWK in the JWKS endpoint
//
// The JWKS is fetched once and cached in-module (process lifetime) to avoid
// a network round-trip per webhook. The cache is busted only on a kid miss,
// which handles key rotation without unbounded cache lifetimes.

interface JWK {
  kid: string;
  kty: string;
  crv?: string;
  x?: string;
  use?: string;
  alg?: string;
}

interface JWKSResponse {
  keys: JWK[];
}

// Module-level JWKS cache — one fetch per process start (or on kid miss).
let cachedJwks: JWKSResponse | null = null;

async function fetchJwks(bustCache = false): Promise<JWKSResponse> {
  if (cachedJwks && !bustCache) return cachedJwks;

  const baseUrl = process.env.NEON_AUTH_BASE_URL;
  if (!baseUrl) throw new Error('NEON_AUTH_BASE_URL is not configured');

  const res = await fetch(`${baseUrl}/.well-known/jwks.json`, {
    // Always fetch fresh from the network — no Next.js data cache here, this is
    // a server-only module called from an API route, not a Server Component.
    cache: 'no-store',
  });
  if (!res.ok)
    throw new Error(`Failed to fetch JWKS: ${res.status} ${res.statusText}`);

  const data = (await res.json()) as JWKSResponse;
  cachedJwks = data;
  return data;
}

async function importEd25519Key(jwk: JWK): Promise<CryptoKey> {
  // Ed25519 JWKs have kty=OKP, crv=Ed25519, and a base64url-encoded public key x.
  return crypto.subtle.importKey(
    'jwk',
    {
      kty: jwk.kty,
      crv: jwk.crv,
      x: jwk.x,
      use: jwk.use ?? 'sig',
      alg: jwk.alg ?? 'EdDSA',
    },
    { name: 'Ed25519' },
    false,
    ['verify'],
  );
}

function base64UrlDecode(input: string): Uint8Array<ArrayBuffer> {
  // Convert base64url → base64, then decode.
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(
    base64.length + ((4 - (base64.length % 4)) % 4),
    '=',
  );
  const binary = atob(padded);
  // Explicit ArrayBuffer allocation so the resulting Uint8Array is
  // Uint8Array<ArrayBuffer> (not Uint8Array<ArrayBufferLike>) — required by
  // crypto.subtle.verify's BufferSource parameter in strict TypeScript.
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export interface VerifyWebhookResult {
  valid: boolean;
}

// The dev sentinel value: when NEON_AUTH_WEBHOOK_SECRET=dev, signature
// verification is skipped entirely. This matches the local dev workflow where
// you POST directly to the endpoint without a real Neon signing key.
const DEV_SENTINEL = 'dev';

export async function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  kidHeader: string | null,
): Promise<VerifyWebhookResult> {
  // Skip verification in local dev when the sentinel is set.
  if (process.env.NEON_AUTH_WEBHOOK_SECRET === DEV_SENTINEL)
    return { valid: true };

  if (!signatureHeader || !kidHeader) return { valid: false };

  // Attempt verification; if the kid is not in the cache, bust it and retry
  // once to handle key rotation.
  for (let attempt = 0; attempt < 2; attempt++) {
    const jwks = await fetchJwks(attempt === 1);
    const jwk = jwks.keys.find(
      (k) => k.kid === kidHeader && k.kty === 'OKP' && k.crv === 'Ed25519',
    );
    if (!jwk) {
      if (attempt === 0) continue; // retry with fresh JWKS
      return { valid: false };
    }

    const key = await importEd25519Key(jwk);
    const bodyBytes = new TextEncoder().encode(rawBody);
    const sigBytes = base64UrlDecode(signatureHeader);

    const valid = await crypto.subtle.verify(
      'Ed25519',
      key,
      sigBytes,
      bodyBytes,
    );
    return { valid };
  }

  return { valid: false };
}
