import { frameCount, sampleAt } from './channels';

/**
 * WAV output sample rate for a "max sample rate" setting: returns the target
 * only when it actually lowers the rate (never upsamples), else undefined.
 */
export function resolveWavSampleRate(sourceRate: number, setting: number | null): number | undefined {
  return setting !== null && setting < sourceRate ? setting : undefined;
}

/** Frames after resampling `frames` from `fromRate` to `toRate` — shared with the size estimate. */
export function resampledLength(frames: number, fromRate: number, toRate: number): number {
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
    const inputLength = frameCount(channels);
    const outputLength = resampledLength(inputLength, originalSampleRate, targetSampleRate);
    const ctx = new OfflineAudioContext(channels.length, outputLength, targetSampleRate);
    const buffer = ctx.createBuffer(channels.length, inputLength, originalSampleRate);
    channels.forEach((channel, i) =>
      buffer.copyToChannel(channel as Float32Array<ArrayBuffer>, i),
    );

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);

    const rendered = await ctx.startRendering();
    const out: Float32Array[] = [];
    for (let i = 0; i < rendered.numberOfChannels; i++) {
      out.push(rendered.getChannelData(i).slice());
    }
    return out;
  }

  return linearResample(channels, originalSampleRate, targetSampleRate);
}

function linearResample(
  channels: Float32Array[],
  originalSampleRate: number,
  targetSampleRate: number,
): Float32Array[] {
  const ratio = targetSampleRate / originalSampleRate;
  const outputLength = resampledLength(frameCount(channels), originalSampleRate, targetSampleRate);

  return channels.map((channel) => {
    const output = new Float32Array(outputLength);
    for (let i = 0; i < outputLength; i++) output[i] = sampleAt(channel, i / ratio);
    return output;
  });
}
