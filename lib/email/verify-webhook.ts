import 'server-only';

import { createPublicKey, verify as cryptoVerify } from 'crypto';

// EdDSA (Ed25519) signature verification for Neon Auth webhook requests.
//
// Neon signs each webhook request and includes three headers:
//   X-Neon-Signature      — detached JWS: headerB64..signatureB64 (empty payload section)
//   X-Neon-Signature-Kid  — key ID matching a JWK in the JWKS endpoint
//   X-Neon-Timestamp      — Unix timestamp (ms) of when the request was signed
//
// Signing input: headerB64 + "." + base64url(timestamp + "." + base64url(rawBody))
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

export interface VerifyWebhookResult {
  valid: boolean;
}

export async function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  kidHeader: string | null,
  timestampHeader: string | null,
): Promise<VerifyWebhookResult> {
  // Skip Ed25519 signature verification in local dev when the flag is set.
  // The production guard ensures this bypass cannot be deployed accidentally —
  // NODE_ENV=production is always set by Next.js in a production build.
  if (process.env.SKIP_WEBHOOK_VERIFICATION) {
    if (process.env.NODE_ENV === 'production')
      throw new Error('SKIP_WEBHOOK_VERIFICATION cannot be set in production');
    return { valid: true };
  }

  if (!signatureHeader || !kidHeader || !timestampHeader)
    return { valid: false };

  // Reject stale requests (replay-attack guard).
  const ts = parseInt(timestampHeader, 10);
  if (isNaN(ts) || Date.now() - ts > 5 * 60 * 1000) return { valid: false };

  // Parse the detached JWS: headerB64..signatureB64 (empty middle section).
  const parts = signatureHeader.split('.');
  if (parts.length !== 3) return { valid: false };
  const [headerB64, , signatureB64] = parts;

  // Build the signing input per Neon's spec:
  //   headerB64 + "." + base64url(timestamp + "." + base64url(rawBody))
  const payloadB64 = Buffer.from(rawBody).toString('base64url');
  const signingInput =
    headerB64 +
    '.' +
    Buffer.from(timestampHeader + '.' + payloadB64).toString('base64url');
  const sigBuffer = Buffer.from(signatureB64, 'base64url');

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

    // Import the Ed25519 public key from JWK via Node's crypto module.
    // crypto.createPublicKey handles OKP/Ed25519 JWKs more reliably than
    // crypto.subtle across Node versions and is synchronous.
    const publicKey = createPublicKey({
      key: jwk as JsonWebKey,
      format: 'jwk',
    });
    const valid = cryptoVerify(
      null,
      Buffer.from(signingInput),
      publicKey,
      sigBuffer,
    );
    return { valid };
  }

  return { valid: false };
}
