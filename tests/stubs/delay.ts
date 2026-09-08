// Alias target for lib/delay (db project only) — resolves immediately so a
// decision email's self-managed wait never costs real wall-clock time in a
// test that doesn't care about it. A test asserting on the mid-wait
// behavior (e.g. undo racing the send) overrides this module with vi.mock.
export function delay(): Promise<void> {
  return Promise.resolve();
}
