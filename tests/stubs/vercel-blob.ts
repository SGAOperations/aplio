// Alias target for @vercel/blob (db project only) — no test may reach real
// blob storage. onPut is the seam question-file-answers.test.ts uses to race
// a status change between the pre-check and the write transaction.
let onPutHook: (() => Promise<void> | void) | null = null;

export const deletedUrls: string[] = [];

export function resetBlobStub(): void {
  onPutHook = null;
  deletedUrls.length = 0;
}

// Fires once, then clears itself — callers re-arm per test.
export function onPut(fn: () => Promise<void> | void): void {
  onPutHook = fn;
}

export async function put(pathname: string): Promise<{ url: string }> {
  if (onPutHook) {
    const hook = onPutHook;
    onPutHook = null;
    await hook();
  }
  return { url: `https://blob.test/${pathname}` };
}

export async function del(url: string): Promise<void> {
  deletedUrls.push(url);
}

export async function get(): Promise<never> {
  throw new Error('blob get not stubbed');
}
