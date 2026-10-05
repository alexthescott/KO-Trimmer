/**
 * Single-consumer async queue: producers `push` and the consumer iterates
 * with `for await`. A push resolves once the consumer has taken that item,
 * so awaiting it gives backpressure — producers can't run ahead of a slow
 * consumer and pile items up in memory. `fail` rejects every pending and
 * future push (the consumer died), so producers never hang.
 */
export class AsyncQueue<T> implements AsyncIterable<T> {
  private items: Array<{ value: T; taken: () => void }> = [];
  private waiting?: (result: IteratorResult<T>) => void;
  private closed = false;
  private failure?: unknown;
  private rejectors = new Set<(err: unknown) => void>();

  push(value: T): Promise<void> {
    if (this.failure !== undefined) return Promise.reject(this.failure);
    if (this.closed) return Promise.reject(new Error('Queue is closed'));
    return new Promise((resolve, reject) => {
      if (this.waiting) {
        const deliver = this.waiting;
        this.waiting = undefined;
        deliver({ value, done: false });
        resolve();
        return;
      }
      this.rejectors.add(reject);
      this.items.push({
        value,
        taken: () => {
          this.rejectors.delete(reject);
          resolve();
        },
      });
    });
  }

  /** No more items: the consumer's loop ends once the queue drains. */
  close(): void {
    this.closed = true;
    if (this.items.length === 0) this.release({ value: undefined, done: true });
  }

  fail(err: unknown): void {
    this.failure = err ?? new Error('Queue consumer failed');
    for (const reject of this.rejectors) reject(this.failure);
    this.rejectors.clear();
    this.items = [];
    this.release({ value: undefined, done: true });
  }

  [Symbol.asyncIterator](): AsyncIterator<T> {
    return {
      next: () => {
        const item = this.items.shift();
        if (item) {
          item.taken();
          return Promise.resolve({ value: item.value, done: false });
        }
        if (this.closed || this.failure !== undefined) return Promise.resolve({ value: undefined, done: true });
        return new Promise((resolve) => (this.waiting = resolve));
      },
    };
  }

  private release(result: IteratorResult<T>): void {
    const deliver = this.waiting;
    this.waiting = undefined;
    deliver?.(result);
  }
}
