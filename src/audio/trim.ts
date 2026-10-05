import type { SilenceRegion } from '../app/types';

export interface TrimBounds {
  start: number;
  end: number; // exclusive
  warning?: string;
}

/**
 * Leading + trailing silence trim: trims silence anchored at the very
 * start and/or very end of the buffer, and leaves every internal region
 * (including any other region touching neither edge) untouched.
 */
export function computeTrimBounds(
  totalLength: number,
  regions: SilenceRegion[],
  sampleRate: number,
  paddingMs: number,
): TrimBounds {
  if (regions.length === 0 || totalLength === 0) {
    return { start: 0, end: totalLength };
  }

  const first = regions[0];
  const last = regions[regions.length - 1];

  const contentStart = first.start === 0 ? first.end + 1 : 0;
  const contentEnd = last.end === totalLength - 1 ? last.start : totalLength;

  if (contentStart >= contentEnd) {
    return {
      start: 0,
      end: totalLength,
      warning: 'Entire file is below the silence threshold — not trimmed.',
    };
  }

  const paddingSamples = Math.round((paddingMs * sampleRate) / 1000);
  let finalStart = Math.max(0, contentStart - paddingSamples);
  let finalEnd = Math.min(totalLength, contentEnd + paddingSamples);

  if (finalStart >= finalEnd) {
    return {
      start: 0,
      end: totalLength,
      warning: 'Padding settings left no audio to keep — not trimmed.',
    };
  }

  return { start: finalStart, end: finalEnd };
}

export function sliceChannels(channels: Float32Array[], bounds: TrimBounds): Float32Array[] {
  return channels.map((channel) => channel.slice(bounds.start, bounds.end));
}
