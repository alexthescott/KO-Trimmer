import { getSharedContext } from './decode';

export interface PlaybackHandle {
  /** Seconds elapsed since playback started. */
  position(): number;
  duration: number;
  stop(): void;
}

let current: { source: AudioBufferSourceNode; handle: PlaybackHandle } | null = null;

/**
 * One-shot preview playback of an in-memory buffer (port of the JUCE
 * SamplePlayer). Only one preview plays at a time; starting a new one
 * stops the previous.
 */
export function playChannels(
  channels: Float32Array[],
  sampleRate: number,
  onEnded: () => void,
): PlaybackHandle | null {
  stopPlayback();
  const length = channels[0]?.length ?? 0;
  if (length === 0) return null;

  const ctx = getSharedContext();
  if (ctx.state === 'suspended') void ctx.resume();

  const buffer = ctx.createBuffer(channels.length, length, sampleRate);
  channels.forEach((channel, i) => buffer.copyToChannel(channel as Float32Array<ArrayBuffer>, i));

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  const startedAt = ctx.currentTime;
  source.start();

  const handle: PlaybackHandle = {
    duration: buffer.duration,
    position: () => Math.min(buffer.duration, ctx.currentTime - startedAt),
    stop: () => {
      if (current?.handle === handle) stopPlayback();
    },
  };
  current = { source, handle };
  source.onended = () => {
    if (current?.handle === handle) current = null;
    onEnded();
  };
  return handle;
}

export function stopPlayback(): void {
  if (!current) return;
  const { source } = current;
  current = null;
  try {
    source.stop();
  } catch {
    // already stopped
  }
}
