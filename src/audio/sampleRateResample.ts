import { channelsOf, frameCount, sampleAt, toAudioBuffer } from './channels';

/**
 * WAV output sample rate for a "max sample rate" setting: returns the target
 * only when it actually lowers the rate (never upsamples), else undefined.
 */
export function resolveWavSampleRate(sourceRate: number, setting: number | null): number | undefined {
  return setting !== null && setting < sourceRate ? setting : undefined;
}

/** Frames after resampling `frames` from `fromRate` to `toRate` — shared with the size estimate. */
export function resampledFrames(frames: number, fromRate: number, toRate: number): number {
  return Math.ceil((frames * toRate) / fromRate);
}

/**
 * Resample via OfflineAudioContext (high-quality, built into the browser).
 * Must run where OfflineAudioContext is available (main thread, or a
 * worker in browsers that expose it there). Falls back to a pure-JS
 * linear resample if unavailable, as a defensive measure only.
 */
export async function resampleToRate(
  channels: Float32Array[],
  originalSampleRate: number,
  targetSampleRate: number,
): Promise<Float32Array[]> {
  if (originalSampleRate === targetSampleRate) return channels;

  if (typeof OfflineAudioContext !== 'undefined') {
    const inputFrames = frameCount(channels);
    const outputFrames = resampledFrames(inputFrames, originalSampleRate, targetSampleRate);
    const ctx = new OfflineAudioContext(channels.length, outputFrames, targetSampleRate);
    const source = ctx.createBufferSource();
    source.buffer = toAudioBuffer(ctx, channels, originalSampleRate);
    source.connect(ctx.destination);
    source.start(0);

    return channelsOf(await ctx.startRendering());
  }

  return linearResample(channels, originalSampleRate, targetSampleRate);
}

function linearResample(
  channels: Float32Array[],
  originalSampleRate: number,
  targetSampleRate: number,
): Float32Array[] {
  const ratio = targetSampleRate / originalSampleRate;
  const outputFrames = resampledFrames(frameCount(channels), originalSampleRate, targetSampleRate);

  return channels.map((channel) => {
    const output = new Float32Array(outputFrames);
    for (let i = 0; i < outputFrames; i++) output[i] = sampleAt(channel, i / ratio);
    return output;
  });
}
