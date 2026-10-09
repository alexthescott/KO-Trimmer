import { frameCount } from './channels';

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

/** Zero crossings of the windowed sinc on each side of its centre. */
const ZERO_CROSSINGS = 32;
/** Kernel table resolution: entries per zero crossing (linearly interpolated between). */
const TABLE_STEPS = 512;
/** Cutoff as a fraction of the lower Nyquist, leaving room for the transition band. */
const ROLLOFF = 0.92;
/** Kaiser window shape; ~9 puts the sidelobes below -80 dB. */
const KAISER_BETA = 9;

/** sinc(u) · kaiser(u / ZERO_CROSSINGS) for u in [0, ZERO_CROSSINGS], plus a trailing 0 for interpolation. */
const KERNEL_TABLE = buildKernelTable();

function buildKernelTable(): Float64Array {
  const size = ZERO_CROSSINGS * TABLE_STEPS;
  const table = new Float64Array(size + 2);
  const i0Beta = besselI0(KAISER_BETA);
  for (let k = 0; k <= size; k++) {
    const u = k / TABLE_STEPS;
    const r = u / ZERO_CROSSINGS;
    const sinc = u === 0 ? 1 : Math.sin(Math.PI * u) / (Math.PI * u);
    table[k] = (sinc * besselI0(KAISER_BETA * Math.sqrt(Math.max(0, 1 - r * r)))) / i0Beta;
  }
  return table;
}

/** Zeroth-order modified Bessel function of the first kind (power series). */
function besselI0(x: number): number {
  let sum = 1;
  let term = 1;
  const quarterSq = (x * x) / 4;
  for (let k = 1; term > sum * 1e-12; k++) {
    term *= quarterSq / (k * k);
    sum += term;
  }
  return sum;
}

/**
 * Band-limited resample (Kaiser-windowed sinc), pure JS so the batch worker
 * and the editor preview run the exact same filter in every browser — no
 * OfflineAudioContext, which isn't exposed to workers. When downsampling,
 * the cutoff sits just below the new Nyquist so nothing above it aliases.
 * Edge samples are held beyond the buffer's ends, so audio that starts on a
 * transient (as trimmed samples do) isn't faded in.
 */
export function resampleToRate(
  channels: Float32Array[],
  originalSampleRate: number,
  targetSampleRate: number,
): Float32Array[] {
  if (originalSampleRate === targetSampleRate) return channels;

  const outputFrames = resampledFrames(frameCount(channels), originalSampleRate, targetSampleRate);
  const step = originalSampleRate / targetSampleRate;
  // Cutoff in cycles per source sample, times 2: kernel zero crossings per source sample.
  const cutoff = Math.min(1, targetSampleRate / originalSampleRate) * ROLLOFF;
  const halfWidth = ZERO_CROSSINGS / cutoff;
  const tableScale = cutoff * TABLE_STEPS;

  return channels.map((channel) => {
    const last = channel.length - 1;
    const output = new Float32Array(outputFrames);
    for (let i = 0; i < outputFrames; i++) {
      const centre = i * step;
      const first = Math.ceil(centre - halfWidth);
      const end = Math.floor(centre + halfWidth);
      let sum = 0;
      let weightSum = 0;
      for (let j = first; j <= end; j++) {
        const pos = Math.abs(j - centre) * tableScale;
        const k = Math.floor(pos);
        const frac = pos - k;
        const weight = KERNEL_TABLE[k] + (KERNEL_TABLE[k + 1] - KERNEL_TABLE[k]) * frac;
        sum += weight * channel[j < 0 ? 0 : j > last ? last : j];
        weightSum += weight;
      }
      output[i] = sum / weightSum;
    }
    return output;
  });
}
