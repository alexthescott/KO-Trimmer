/**
 * Runs `task` over `items` with at most `limit` in flight, starting the next
 * as each one settles. Bounding this is what keeps a big batch's memory flat:
 * each in-flight task holds a file's bytes and decoded PCM. Tasks are expected
 * not to throw; a rejection is logged, and never stalls the rest.
 */
export async function forEachConcurrent<T>(
  items: readonly T[],
  limit: number,
  task: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0;
  const runner = async (): Promise<void> => {
    while (next < items.length) {
      const item = items[next++];
      await task(item).catch((err) => console.error('Concurrent task failed', err));
    }
  };
  const runners = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: runners }, runner));
}
