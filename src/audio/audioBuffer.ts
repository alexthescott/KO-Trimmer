import { frameCount } from './channels';

// Web Audio exists only on the main thread; kept out of channels.ts so worker code can't reach it.

/** Copies an AudioBuffer out to planar channels the caller owns. */
export function channelsOf(buffer: AudioBuffer): Float32Array[] {
  return Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i).slice());
}

/** Copies planar channels into a new AudioBuffer on `ctx`. */
export function toAudioBuffer(ctx: BaseAudioContext, channels: Float32Array[], sampleRate: number): AudioBuffer {
  const buffer = ctx.createBuffer(channels.length, frameCount(channels), sampleRate);
  channels.forEach((channel, i) => buffer.copyToChannel(channel as Float32Array<ArrayBuffer>, i));
  return buffer;
}
