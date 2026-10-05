/**
 * Tape-style speed-up (1.0x–3.0x): shortens duration and raises pitch,
 * same effect as playing audio back faster. Pure JS/no Web Audio
 * dependency so it's unit-testable in Node and runs identically on the
 * main thread or in a worker.
 *
 * At >= 1.5x each output sample averages round(speed) linearly-interpolated
 * taps centred on its source position — a box-filter anti-alias, the same
 * idea as the JUCE KOTrimmer's average-then-decimate, but centred so it
 * adds no time shift. At 2x this puts a null exactly at the source Nyquist.
 */
import { frameCount, sampleAt } from './channels';

/** Frames left after speeding `frames` up by `speedMultiplier` — shared with the size estimate. */
export function speedUpFrames(frames: number, speedMultiplier: number): number {
  if (speedMultiplier <= 1.0 || frames === 0) return frames;
  return Math.max(1, Math.round(frames / speedMultiplier));
}

export function speedUp(channels: Float32Array[], speedMultiplier: number): Float32Array[] {
  if (speedMultiplier <= 1.0) return channels;

  const outputFrames = speedUpFrames(frameCount(channels), speedMultiplier);
  const taps = speedMultiplier >= 1.5 ? Math.round(speedMultiplier) : 1;
  const tapOffset = (taps - 1) / 2;

  return channels.map((channel) => {
    const output = new Float32Array(outputFrames);
    for (let i = 0; i < outputFrames; i++) {
      const center = i * speedMultiplier;
      let sum = 0;
      for (let k = 0; k < taps; k++) {
        sum += sampleAt(channel, center + k - tapOffset);
      }
      output[i] = sum / taps;
    }
    return output;
  });
}
