/**
 * Run `task` over `items` with a bounded number of concurrent executions.
 *
 * Items are pulled from a shared cursor so exactly `items.length` tasks run,
 * with at most `concurrency` in flight at once. Results are returned in the
 * same order as `items`. When a task returns `void`, the result array is
 * filled with `undefined` (use `await mapWithConcurrency(...)` with a `void`
 * task to run for side effects).
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  task: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function worker(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      const item = items[index];
      if (item === undefined) continue;
      results[index] = await task(item);
    }
  }
  const workers = Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, worker);
  await Promise.all(workers);
  return results;
}
