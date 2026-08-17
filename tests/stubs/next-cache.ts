// Alias target for next/cache (db project only) — the real functions throw
// outside a request scope; actions under test call them after every write.
export function revalidatePath(): void {}
export function revalidateTag(): void {}
