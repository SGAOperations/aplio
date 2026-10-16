import 'server-only';

// Env is read lazily, like lib/email/client.ts, so local dev and CI without
// Slack envs keep working.
export function isSlackConfigured(): boolean {
  return Boolean(
    process.env.SLACK_CLIENT_ID &&
    process.env.SLACK_CLIENT_SECRET &&
    process.env.SLACK_TEAM_ID,
  );
}

export function requireSlackEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}
