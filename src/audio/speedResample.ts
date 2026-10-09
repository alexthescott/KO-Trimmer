/**
 * Tape-style speed-up (set in semitones, 0–24 = 1.0x–4.0x): shortens duration and raises pitch,
 * same effect as playing audio back faster. Pure JS/no Web Audio
 * dependency so it's unit-testable in Node and runs identically on the
 * main thread or in a worker.
 *
 * Reads the source at `speed` samples per output sample through the same
 * Kaiser-windowed sinc as the WAV sample-rate reduction, with its cutoff
 * at 1/speed of the Nyquist — so content the speed-up pushes above Nyquist
 * is removed instead of aliasing, at every speed (the old box filter only
 * engaged from 1.5x and barely attenuated between its nulls).
 */
import { frameCount } from './channels';
import { resampleByStep } from './sampleRateResample';

/** Tape speed that raises pitch by `semitones` (12 per octave = 2x). */
export function semitonesToSpeed(semitones: number): number {
  return 2 ** (semitones / 12);
}

/** Nearest whole-semitone pitch shift for a tape speed (migrates old multiplier settings). */
export function speedToSemitones(speedMultiplier: number): number {
  return speedMultiplier > 1 ? Math.round(12 * Math.log2(speedMultiplier)) : 0;
}

/** Frames left after speeding `frames` up by `speedMultiplier` — shared with the size estimate. */
export function speedUpFrames(frames: number, speedMultiplier: number): number {
  if (speedMultiplier <= 1.0 || frames === 0) return frames;
  return Math.max(1, Math.round(frames / speedMultiplier));
}

export function speedUp(channels: Float32Array[], speedMultiplier: number): Float32Array[] {
  if (speedMultiplier <= 1.0) return channels;
  return resampleByStep(channels, speedMultiplier, speedUpFrames(frameCount(channels), speedMultiplier));
}
