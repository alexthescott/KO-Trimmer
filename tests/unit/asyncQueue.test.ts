import { describe, it, expect } from 'vitest';
import { AsyncQueue } from '../../src/fs/asyncQueue';

async function drain<T>(queue: AsyncQueue<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const item of queue) out.push(item);
  return out;
}

describe('AsyncQueue', () => {
  it('delivers items pushed before and after the consumer starts, in order', async () => {
    const queue = new AsyncQueue<number>();
    const early = queue.push(1);
    const consumed = drain(queue);
    await early;
    await queue.push(2);
    await queue.push(3);
    queue.close();
    expect(await consumed).toEqual([1, 2, 3]);
  });

  it('resolves a push only once the consumer takes it (backpressure)', async () => {
    const queue = new AsyncQueue<string>();
    let taken = false;
    const pushed = queue.push('a').then(() => (taken = true));
    await Promise.resolve();
    expect(taken).toBe(false);
    const iterator = queue[Symbol.asyncIterator]();
    expect(await iterator.next()).toEqual({ value: 'a', done: false });
    await pushed;
    expect(taken).toBe(true);
  });

  it('ends the consumer after close once queued items drain', async () => {
    const queue = new AsyncQueue<number>();
    void queue.push(1);
    void queue.push(2);
    queue.close();
    expect(await drain(queue)).toEqual([1, 2]);
    await expect(queue.push(3)).rejects.toThrow('closed');
  });

  it('rejects pending and later pushes when the consumer fails', async () => {
    const queue = new AsyncQueue<number>();
    const pending = queue.push(1);
    queue.fail(new Error('disk full'));
    await expect(pending).rejects.toThrow('disk full');
    await expect(queue.push(2)).rejects.toThrow('disk full');
    expect(await drain(queue)).toEqual([]);
  });
});
