let sharedContext: AudioContext | null = null;

function getSharedContext(): AudioContext {
  if (!sharedContext) sharedContext = new AudioContext();
  return sharedContext;
}

export interface DecodedAudio {
  channels: Float32Array[];
  sampleRate: number;
}

/**
 * Decodes a file's bytes via the Web Audio API. Runs on the main thread
 * (decodeAudioData is async/non-blocking) with per-file isolation: a
 * decode failure for one file must not abort the rest of the batch,
 * mirroring the desktop app's per-file error handling in ProcessingThread.
 */
export async function decodeAudioFile(arrayBuffer: ArrayBuffer): Promise<DecodedAudio> {
  const ctx = getSharedContext();
  // decodeAudioData detaches/consumes the buffer, so pass a copy if the
  // caller still needs the original bytes afterward.
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
  const channels: Float32Array[] = [];
  for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
    channels.push(audioBuffer.getChannelData(i).slice());
  }
  return { channels, sampleRate: audioBuffer.sampleRate };
}
