import type { SampleRange, SilenceRegion } from '../app/types';

export interface TrimBounds extends SampleRange {
  warning?: string;
}

/**
 * Leading + trailing silence trim: trims silence anchored at the very
 * start and/or very end of the buffer, and leaves every internal region
 * (including any other region touching neither edge) untouched.
 */
export function computeTrimBounds(
  totalFrames: number,
  regions: SilenceRegion[],
  sampleRate: number,
  paddingMs: number,
): TrimBounds {
  if (regions.length === 0 || totalFrames === 0) {
    return { start: 0, end: totalFrames };
  }

  const first = regions[0];
  const last = regions[regions.length - 1];

  const contentStart = first.start === 0 ? first.end + 1 : 0;
  const contentEnd = last.end === totalFrames - 1 ? last.start : totalFrames;

  if (contentStart >= contentEnd) {
    return {
      start: 0,
      end: totalFrames,
      warning: 'Entire file is below the silence threshold — not trimmed.',
    };
  }

  const paddingSamples = Math.round((paddingMs * sampleRate) / 1000);
  const finalStart = Math.max(0, contentStart - paddingSamples);
  const finalEnd = Math.min(totalFrames, contentEnd + paddingSamples);

  if (finalStart >= finalEnd) {
    return {
      start: 0,
      end: totalFrames,
      warning: 'Padding settings left no audio to keep — not trimmed.',
    };
  }

  return { start: finalStart, end: finalEnd };
}

/** Views (not copies) of each channel within `bounds` — later stages never write to their input. */
export function sliceChannels(channels: Float32Array[], bounds: SampleRange): Float32Array[] {
  return channels.map((channel) => channel.subarray(bounds.start, bounds.end));
}
