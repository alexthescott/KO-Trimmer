import { describe, it, expect } from 'vitest';
import { forEachConcurrent } from '../../src/app/concurrency';

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('forEachConcurrent', () => {
  it('never runs more than `limit` tasks at once and visits every item', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const seen: number[] = [];
    await forEachConcurrent([1, 2, 3, 4, 5, 6, 7], 3, async (n) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await tick();
      seen.push(n);
      inFlight--;
    });
    expect(maxInFlight).toBe(3);
    expect(seen.sort()).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('keeps going after a task rejects', async () => {
    const seen: number[] = [];
    await forEachConcurrent([1, 2, 3], 1, async (n) => {
      if (n === 2) throw new Error('boom');
      seen.push(n);
    });
    expect(seen).toEqual([1, 3]);
  });

  it('handles an empty list', async () => {
    await expect(forEachConcurrent([], 4, async () => {})).resolves.toBeUndefined();
  });
});
