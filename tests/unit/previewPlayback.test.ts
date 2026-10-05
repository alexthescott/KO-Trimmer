import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

let position = 0;
let endCurrent: (() => void) | undefined;
const stopPlayback = vi.fn();
vi.mock('../../src/audio/player', () => ({
  playChannels: (_channels: Float32Array[], _rate: number, onEnded: () => void) => {
    endCurrent = onEnded;
    return { duration: 2, position: () => position, stop: () => {} };
  },
  stopPlayback: () => stopPlayback(),
}));

const { PreviewPlayback } = await import('../../src/ui/components/waveform/PreviewPlayback');

const audio = { channels: [new Float32Array(4)], sampleRate: 2 };

describe('PreviewPlayback', () => {
  const frames: Array<() => void> = [];
  beforeEach(() => {
    position = 0;
    frames.length = 0;
    stopPlayback.mockClear();
    vi.stubGlobal('requestAnimationFrame', (cb: () => void) => frames.push(cb));
    vi.stubGlobal('cancelAnimationFrame', () => {});
  });
  afterEach(() => vi.unstubAllGlobals());

  function make() {
    const listener = { onStateChange: vi.fn(), onFrame: vi.fn() };
    return { playback: new PreviewPlayback(listener), listener };
  }

  it('reports what is playing and how far along, repainting each frame', () => {
    const { playback, listener } = make();
    expect(playback.target).toBeUndefined();
    expect(playback.progress).toBe(0);

    playback.start('processed', audio);
    expect(playback.target).toBe('processed');
    expect(listener.onStateChange).toHaveBeenCalledOnce();
    position = 0.5;
    expect(playback.progress).toBe(0.25);

    frames.shift()!();
    expect(listener.onFrame).toHaveBeenCalledTimes(2); // first paint + one animation frame
    expect(frames).toHaveLength(1);
  });

  it('goes idle when the audio ends on its own', () => {
    const { playback, listener } = make();
    playback.start('original', audio);
    endCurrent!();
    expect(playback.target).toBeUndefined();
    expect(listener.onStateChange).toHaveBeenCalledTimes(2);
    frames.shift()!();
    expect(frames).toHaveLength(0); // stops scheduling frames
  });

  it('ignores the end of a preview that was already replaced', () => {
    const { playback } = make();
    playback.start('original', audio);
    const endFirst = endCurrent!;
    playback.start('processed', audio);
    endFirst();
    expect(playback.target).toBe('processed');
  });

  it('stop() halts the audio and goes idle', () => {
    const { playback } = make();
    playback.start('original', audio);
    playback.stop();
    expect(stopPlayback).toHaveBeenCalledOnce();
    expect(playback.target).toBeUndefined();
  });
});
