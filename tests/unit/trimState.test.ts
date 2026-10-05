import { describe, it, expect } from 'vitest';
import { TrimState } from '../../src/ui/components/waveform/TrimState';
import { computeAutoTrimBounds } from '../../src/audio/pipeline';
import { DEFAULT_SETTINGS } from '../../src/settings/defaults';

/** 1 s silence, 1 s tone at -20 dBFS-ish, 1 s silence, at 8 kHz. */
function paddedTone() {
  const rate = 8000;
  const samples = new Float32Array(rate * 3);
  for (let i = rate; i < rate * 2; i++) samples[i] = 0.1 * Math.sin(i / 4);
  return { channels: [samples], sampleRate: rate };
}

const audio = paddedTone();
const autoFor = (settings: typeof DEFAULT_SETTINGS) => {
  const { start, end } = computeAutoTrimBounds(audio.channels, audio.sampleRate, settings);
  return { start, end };
};
const strict = { ...DEFAULT_SETTINGS, thresholdDb: -10 }; // the tone is below this: nothing trimmed

describe('TrimState', () => {
  it('starts on the auto-detected range', () => {
    const trim = new TrimState(audio, DEFAULT_SETTINGS);
    expect(trim.range).toEqual(autoFor(DEFAULT_SETTINGS));
    expect(trim.isManual).toBe(false);
    expect(trim.frames).toBe(24000);
  });

  it('starts on a stored manual trim', () => {
    const trim = new TrimState(audio, DEFAULT_SETTINGS, { start: 100, end: 200 });
    expect(trim.range).toEqual({ start: 100, end: 200 });
    expect(trim.isManual).toBe(true);
  });

  it('follows settings changes only while there is no manual override', () => {
    const trim = new TrimState(audio, DEFAULT_SETTINGS);
    trim.redetect(strict);
    expect(trim.range).toEqual({ start: 0, end: 24000 });
    expect(trim.autoWarning).toMatch(/below the silence threshold/);

    trim.moveHandle('start', 500);
    trim.commitManual();
    trim.redetect(DEFAULT_SETTINGS);
    expect(trim.range.start).toBe(500);
  });

  it('clamps handles to the file and never lets them cross', () => {
    const trim = new TrimState(audio, DEFAULT_SETTINGS);
    trim.moveHandle('start', -50);
    expect(trim.range.start).toBe(0);
    trim.moveHandle('end', 1e9);
    expect(trim.range.end).toBe(24000);
    trim.moveHandle('start', 30000);
    expect(trim.range).toEqual({ start: 23999, end: 24000 });
    trim.moveHandle('end', 0);
    expect(trim.range).toEqual({ start: 23999, end: 24000 });
    trim.moveHandle('start', 10.6);
    expect(trim.range.start).toBe(11);
  });

  it('a drag only becomes manual once committed', () => {
    const trim = new TrimState(audio, DEFAULT_SETTINGS);
    trim.moveHandle('end', 20000);
    expect(trim.isManual).toBe(false);
    trim.commitManual();
    expect(trim.isManual).toBe(true);
  });

  it('reverts to the current auto range', () => {
    const trim = new TrimState(audio, DEFAULT_SETTINGS, { start: 1, end: 2 });
    trim.redetect(strict);
    trim.revertToAuto();
    expect(trim.isManual).toBe(false);
    expect(trim.range).toEqual(autoFor(strict));
  });

  it('hands out copies, so callers cannot move the handles', () => {
    const trim = new TrimState(audio, DEFAULT_SETTINGS);
    const range = trim.range;
    range.start = 12345;
    expect(trim.range.start).not.toBe(12345);
  });
});
