// @vercel/blob alias for the db project; onPut is the seam for racing a status change mid-write.
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
