import { describe, it, expect } from 'vitest';
import { Viewport } from '../../src/ui/components/waveform/Viewport';

function viewport(total = 100_000, sampleRate = 44100): Viewport {
  const v = new Viewport();
  v.reset(total, sampleRate);
  return v;
}

describe('Viewport', () => {
  it('starts showing the whole file and maps proportions to samples', () => {
    const v = viewport();
    expect([v.start, v.end]).toEqual([0, 100_000]);
    expect(v.sampleAt(0.25)).toBe(25_000);
    expect(v.proportionOf(75_000)).toBe(0.75);
  });

  it('zooms around the anchor without moving the sample under it', () => {
    const v = viewport();
    v.zoom(0.5, 0.5);
    expect(v.range).toBe(50_000);
    expect(v.sampleAt(0.5)).toBe(50_000);
  });

  it('never zooms out past the file or in past the minimum window', () => {
    const v = viewport();
    v.zoom(0.5, 10);
    expect([v.start, v.end]).toEqual([0, 100_000]);
    for (let i = 0; i < 100; i++) v.zoom(0.5, 0.1);
    expect(v.range).toBe(50); // max(32 samples, 0.5 ms, total / 2000)
  });

  it('pans by a fraction of the view and stops at the edges', () => {
    const v = viewport();
    v.zoom(0, 0.1);
    v.pan(1);
    expect(v.start).toBe(1500);
    v.pan(-1);
    v.pan(-1);
    expect(v.start).toBe(0);
  });
});
