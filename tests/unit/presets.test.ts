import { describe, it, expect } from 'vitest';
import { matchingPreset, PRESETS } from '../../src/settings/presets';
import { DEFAULT_SETTINGS } from '../../src/settings/defaults';
import { estimateOutputBytes } from '../../src/audio/estimate';

describe('presets', () => {
  it('the defaults are the Standard preset', () => {
    expect(matchingPreset(DEFAULT_SETTINGS)?.id).toBe('standard');
  });

  it('recognises each preset once applied, and only its own fields matter', () => {
    for (const preset of PRESETS) {
      const applied = { ...DEFAULT_SETTINGS, thresholdDb: -30, speedMultiplier: 2, ...preset.settings };
      expect(matchingPreset(applied)?.id).toBe(preset.id);
    }
  });

  it('reports Custom (undefined) for settings no preset matches', () => {
    expect(matchingPreset({ ...DEFAULT_SETTINGS, wavSampleRateHz: 8000 })).toBeUndefined();
  });

  it('runs from biggest to smallest output for a stereo 24-bit WAV', () => {
    const sizes = PRESETS.map((preset) =>
      estimateOutputBytes({
        trimmedFrames: 44100,
        sourceChannels: 2,
        sourceSampleRate: 44100,
        extension: 'wav',
        sourceFormat: { bits: 24, float: false },
        settings: { ...DEFAULT_SETTINGS, ...preset.settings },
      }),
    );
    expect([...sizes].sort((a, b) => b - a)).toEqual(sizes);
    expect(new Set(sizes).size).toBe(sizes.length);
  });
});
