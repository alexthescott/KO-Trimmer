/** Planar float PCM at a sample rate — decoded, rendered or about to be encoded. */
export interface PcmAudio {
  channels: Float32Array[];
  sampleRate: number;
}

/** Frames (samples per channel) in a planar buffer; 0 when there are no channels. */
export function frameCount(channels: Float32Array[]): number {
  return channels[0]?.length ?? 0;
}

/** Linearly interpolated sample at fractional `pos`, clamped to the channel's ends. */
export function sampleAt(channel: Float32Array, pos: number): number {
  const last = channel.length - 1;
  const clamped = Math.max(0, Math.min(last, pos));
  const idxFloor = Math.floor(clamped);
  const idxCeil = Math.min(idxFloor + 1, last);
  const frac = clamped - idxFloor;
  return channel[idxFloor] + (channel[idxCeil] - channel[idxFloor]) * frac;
}

/** Float sample -> signed integer, clamped to [-1, 1] and scaled asymmetrically (e.g. -0x8000..0x7fff). */
export function floatToInt(sample: number, negativeScale: number, positiveScale: number): number {
  const clamped = Math.max(-1, Math.min(1, sample));
  return Math.round(clamped < 0 ? clamped * negativeScale : clamped * positiveScale);
}
