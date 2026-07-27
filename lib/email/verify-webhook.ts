import 'server-only';

import { compactVerify, importJWK } from 'jose';

// Neon Auth webhook signature verification.
//
// Neon signs webhook requests using EdDSA (Ed25519) with a detached JWS format:
//   X-Neon-Signature     — detached JWS: headerB64..signatureB64 (empty middle section)
//   X-Neon-Signature-Kid — key ID matching a JWK in the JWKS endpoint
//   X-Neon-Timestamp     — Unix timestamp (ms) when the request was signed
//
// The signing input is reconstructed as a compact JWS by filling in the detached
// payload: headerB64.base64url(timestamp + "." + base64url(rawBody)).signatureB64
//
// jose is used for key import and verification rather than Node's crypto.createPublicKey
// because the latter delegates Ed25519 JWK handling to Web Crypto internally and throws
// InvalidCharacterError in the Next.js runtime despite the key being valid.

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
  if (parts.length !== 3 || parts[1] !== '') return { valid: false };
  const [headerB64, , signatureB64] = parts;

  // Reconstruct the compact JWS by filling in the detached payload.
  const payloadB64 = Buffer.from(rawBody).toString('base64url');
  const reconstructedPayloadB64 = Buffer.from(
    `${timestampHeader}.${payloadB64}`,
  ).toString('base64url');
  const compactJws = `${headerB64}.${reconstructedPayloadB64}.${signatureB64}`;

  for (let attempt = 0; attempt < 2; attempt++) {
    const jwks = await fetchJwks(attempt === 1);
    const jwk = jwks.keys.find(
      (k) => k.kid === kidHeader && k.kty === 'OKP' && k.crv === 'Ed25519',
    );
    if (!jwk) {
      if (attempt === 0) continue; // retry with fresh JWKS on kid miss
      return { valid: false };
    }

    try {
      const key = await importJWK(
        { kty: jwk.kty, crv: jwk.crv, x: jwk.x, alg: jwk.alg },
        'EdDSA',
      );
      await compactVerify(compactJws, key);
      return { valid: true };
    } catch {
      return { valid: false };
    }
  }

  return { valid: false };
}
