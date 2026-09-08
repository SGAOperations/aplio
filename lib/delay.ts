// Its own module so a self-managed wait (e.g. the decision-email undo
// window in lib/email/application-emails.ts) can be mocked in tests without
// faking global timers.
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
