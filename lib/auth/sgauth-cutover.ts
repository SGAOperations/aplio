// SGAuth owns admin status, deactivation and user creation once the read cutover has passed.
// Remove with the legacy Aplio auth code.
export function isSgauthCutoverPassed(): boolean {
  const cutover = process.env.APLIO_READ_CUTOVER_AT;
  if (!cutover) return false;

  const cutoverAt = new Date(cutover).getTime();
  if (Number.isNaN(cutoverAt))
    throw new Error('APLIO_READ_CUTOVER_AT is not a valid ISO 8601 time');

  return Date.now() >= cutoverAt;
}
