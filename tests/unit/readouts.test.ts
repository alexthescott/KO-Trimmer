import { describe, it, expect } from 'vitest';
import { sizeSummaryText, trimInfoText, type ReadoutInput } from '../../src/ui/components/waveform/readouts';
import { DEFAULT_SETTINGS } from '../../src/settings/defaults';
import type { FileEntry } from '../../src/app/types';

const input = (overrides: Partial<ReadoutInput> = {}): ReadoutInput => ({
  file: { name: 'a.wav', size: 400_044, sourceFormat: { bits: 32, float: true } } as FileEntry,
  container: 'wav',
  sampleRate: 1000,
  channelCount: 1,
  totalFrames: 4000,
  trim: { start: 500, end: 2500 },
  isManual: false,
  settings: DEFAULT_SETTINGS,
  ...overrides,
});

describe('trimInfoText', () => {
  it('shows mode, bounds and kept length', () => {
    expect(trimInfoText(input())).toBe('AUTO · START 0.50s · END 2.50s · LENGTH 2.00s of 4.00s');
  });

  it('shows the auto warning only without a manual override, plus any clip warning', () => {
    expect(trimInfoText(input({ autoWarning: 'not trimmed' }))).toMatch(/ · not trimmed$/);
    expect(trimInfoText(input({ autoWarning: 'not trimmed', isManual: true }))).not.toMatch(/not trimmed/);
    expect(trimInfoText(input({ processedPeak: 2 }))).toMatch(
      / · Kept 32-bit float — peaks \+6\.0 dB over full scale would clip at 16-bit$/,
    );
  });
});

describe('sizeSummaryText', () => {
  it('shows the estimate, bit-depth conversion and sample-rate reduction', () => {
    const text = sizeSummaryText(
      input({ sampleRate: 44100, settings: { ...DEFAULT_SETTINGS, wavSampleRateHz: 22050 } }),
    );
    expect(text).toMatch(/^390\.7 KB → ~/);
    expect(text).toMatch(/ · 32-bit float → 16-bit · 44\.1 → 22\.05 kHz$/);
  });

  it('shows a clipping float source as kept, at its float size', () => {
    const quiet = sizeSummaryText(input({ processedPeak: 0.5 }));
    const loud = sizeSummaryText(input({ processedPeak: 2 }));
    expect(loud).toMatch(/ · 32-bit float \(kept to avoid clipping\)$/);
    expect(loud).not.toBe(quiet);
  });

  it('shows the bitrate for MP3 and no bit depth', () => {
    const text = sizeSummaryText(input({ container: 'mp3' }));
    expect(text).toMatch(/ · 320 kbps MP3$/);
    expect(text).not.toMatch(/bit/);
  });
});
