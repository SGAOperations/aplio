// Alias target for next/server (db project only), fire-and-forget by default.
// A test asserting on the dispatched work overrides this module with vi.mock.
export function after(task: () => unknown): void {
  void task();
}
