import type { SilenceRegion } from '../app/types';

/**
 * Silence-region detection. Threshold dB -> linear amplitude via 10^(db/20); boolean mask vs energy;
 * contiguous true-runs become regions; edge cases at sample 0 and the last
 * sample are handled explicitly.
 */
export function detectSilenceRegions(
  energy: Float32Array,
  sampleRate: number,
  thresholdDb: number,
  minDurationMs: number,
): SilenceRegion[] {
  const n = energy.length;
  if (n === 0) return [];

  const thresholdLinear = Math.pow(10, thresholdDb / 20);
  const minDurationSamples = Math.round((minDurationMs * sampleRate) / 1000);

  const regions: SilenceRegion[] = [];
  let runStart: number | null = energy[0] < thresholdLinear ? 0 : null;

  for (let i = 1; i < n; i++) {
    const isSilent = energy[i] < thresholdLinear;
    const wasSilent = energy[i - 1] < thresholdLinear;
    if (isSilent && !wasSilent) {
      runStart = i;
    } else if (!isSilent && wasSilent && runStart !== null) {
      const end = i - 1;
      pushIfLongEnough(regions, runStart, end, minDurationSamples);
      runStart = null;
    }
  }

  if (runStart !== null) {
    pushIfLongEnough(regions, runStart, n - 1, minDurationSamples);
  }

  return regions;
}

function pushIfLongEnough(
  regions: SilenceRegion[],
  start: number,
  end: number,
  minDurationSamples: number,
): void {
  const duration = end - start + 1;
  if (duration >= minDurationSamples) {
    regions.push({ start, end, duration });
  }
}
