import 'server-only';

// Misconfiguration, not a request problem — throwing surfaces it in Vercel's
// logs instead of silently rejecting every cron call as unauthorized.
export function rejectUnauthorizedCron(request: Request): Response | null {
  if (!process.env.CRON_SECRET)
    throw new Error('CRON_SECRET is not configured');

  const authorization = request.headers.get('authorization');
  if (authorization !== `Bearer ${process.env.CRON_SECRET}`)
    return Response.json({ error: 'Unauthorized' }, { status: 401 });

  return null;
}
