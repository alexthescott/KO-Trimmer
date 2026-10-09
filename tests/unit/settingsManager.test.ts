import { describe, it, expect } from 'vitest';
import { migrateLegacyBitrate, migrateLegacySpeed } from '../../src/settings/settingsManager';
import { DEFAULT_SETTINGS } from '../../src/settings/defaults';
import type { BitrateKbps } from '../../src/app/types';

const legacy = (bitrateKbps: BitrateKbps) =>
  migrateLegacyBitrate({ ...DEFAULT_SETTINGS, bitrateKbps }, { bitrateKbps }).wavSampleRateHz;

describe('migrateLegacyBitrate', () => {
  it('maps an old bitrate onto the sample rate it implied', () => {
    expect(legacy(320)).toBeNull();
    expect(legacy(192)).toBe(44100);
    expect(legacy(160)).toBe(22050);
    expect(legacy(128)).toBe(22050);
    expect(legacy(96)).toBe(16000);
    expect(legacy(64)).toBe(11025);
  });

  it('leaves settings that already have a WAV sample rate alone', () => {
    const stored = { bitrateKbps: 64, wavSampleRateHz: null };
    expect(migrateLegacyBitrate({ ...DEFAULT_SETTINGS, bitrateKbps: 64 }, stored).wavSampleRateHz).toBeNull();
  });
});

describe('migrateLegacySpeed', () => {
  const migrate = (stored: Record<string, unknown>) => migrateLegacySpeed({ ...DEFAULT_SETTINGS, ...stored }, stored);

  it('maps an old speed multiplier onto the nearest semitone shift', () => {
    expect(migrate({ speedMultiplier: 2 }).speedSemitones).toBe(12);
    expect(migrate({ speedMultiplier: 1.5 }).speedSemitones).toBe(7);
    expect(migrate({ speedMultiplier: 1 }).speedSemitones).toBe(0);
    expect(migrate({ speedMultiplier: 2 })).not.toHaveProperty('speedMultiplier');
  });

  it('leaves settings that already have semitones alone', () => {
    expect(migrate({ speedSemitones: 5, speedMultiplier: 2 }).speedSemitones).toBe(5);
  });
});
