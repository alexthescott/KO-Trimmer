/** PCM sample formats: what the source has and what WAV output writes. */

export interface SampleFormat {
  bits: number;
  float: boolean;
}

export const PCM16: SampleFormat = { bits: 16, float: false };
export const FLOAT32: SampleFormat = { bits: 32, float: true };

/**
 * Output WAV format: 16-bit PCM unless preserving, in which case the source
 * format is kept — rounded to a standard container (8/16/24/32-bit int,
 * 32-bit float; 64-bit float is narrowed to 32-bit float).
 */
export function resolveOutputFormat(source: SampleFormat | undefined, preserveBitDepth: boolean): SampleFormat {
  if (!preserveBitDepth || !source) return PCM16;
  if (source.float) return FLOAT32;
  if (source.bits <= 8) return { bits: 8, float: false };
  if (source.bits <= 16) return PCM16;
  if (source.bits <= 24) return { bits: 24, float: false };
  return { bits: 32, float: false };
}

export function sameFormat(a: SampleFormat, b: SampleFormat): boolean {
  return a.bits === b.bits && a.float === b.float;
}

/** "32-bit float", "24-bit". */
export function formatLabel(f: SampleFormat): string {
  return `${f.bits}-bit${f.float ? ' float' : ''}`;
}

/** Compact form for table tags: "32f", "24". */
export function formatShortLabel(f: SampleFormat): string {
  return `${f.bits}${f.float ? 'f' : ''}`;
}

export function peakAbs(channels: Float32Array[]): number {
  let peak = 0;
  for (const ch of channels) {
    for (let i = 0; i < ch.length; i++) {
      const v = Math.abs(ch[i]);
      if (v > peak) peak = v;
    }
  }
  return peak;
}

/**
 * Why `intended` integer output is written as 32-bit float instead: its
 * peaks exceed full scale (float sources can go past 1.0) and would
 * hard-clip. Undefined when nothing would clip.
 */
export function clipNote(peak: number, intended: SampleFormat): string | undefined {
  if (intended.float || peak <= 1) return undefined;
  const overDb = 20 * Math.log10(peak);
  return `Kept 32-bit float — peaks +${overDb.toFixed(1)} dB over full scale would clip at ${formatLabel(intended)}`;
}
