import { describe, it, expect } from 'vitest';
import { migrateLegacyBitrate } from '../../src/settings/settingsManager';
import { DEFAULT_SETTINGS } from '../../src/audio/settingsDefaults';
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
