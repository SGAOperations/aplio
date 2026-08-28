// Alias target for next/server (db project only) — after() requires a real
// request scope in Next 16; actions under test call it after every write.
// Fire-and-forget by default so unmodified tests don't have to await it;
// a test asserting on the dispatched work overrides this module with vi.mock.
export function after(task: () => unknown): void {
  void task();
}
