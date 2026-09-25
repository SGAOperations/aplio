import { rejectUnauthorizedCron } from '@/lib/cron';
import { dispatchWeeklyManagerDigests } from '@/lib/email/manager-digests';

export const maxDuration = 300;

export async function GET(request: Request): Promise<Response> {
  const denied = rejectUnauthorizedCron(request);
  if (denied) return denied;

  return Response.json(await dispatchWeeklyManagerDigests());
}
