import { Mp3Encoder } from '@breezystack/lamejs';

const SAMPLES_PER_CHUNK = 1152; // lamejs-recommended chunk size
const CANCEL_CHECK_EVERY_N_CHUNKS = 8;

function floatTo16BitPcm(channel: Float32Array): Int16Array {
  const out = new Int16Array(channel.length);
  for (let i = 0; i < channel.length; i++) {
    const sample = Math.max(-1, Math.min(1, channel[i]));
    out[i] = Math.round(sample < 0 ? sample * 0x8000 : sample * 0x7fff);
  }
  return out;
}

/**
 * Ports audio_utils.py's ffmpeg/libmp3lame re-encode path to a pure-JS
 * encoder so MP3 bitrate output works entirely offline, no FFmpeg binary.
 * `isCancelled` is polled between chunks so a Stop click feels responsive
 * even on the single most expensive processing stage.
 */
export function encodeMp3(
  channels: Float32Array[],
  sampleRate: number,
  kbps: number,
  isCancelled?: () => boolean,
): Uint8Array {
  const numChannels = Math.min(channels.length, 2);
  const encoder = new Mp3Encoder(numChannels, sampleRate, kbps);

  const pcm = channels.slice(0, numChannels).map(floatTo16BitPcm);
  const totalSamples = pcm[0]?.length ?? 0;
  const chunks: Uint8Array[] = [];

  let chunkCount = 0;
  for (let i = 0; i < totalSamples; i += SAMPLES_PER_CHUNK) {
    if (chunkCount % CANCEL_CHECK_EVERY_N_CHUNKS === 0 && isCancelled?.()) {
      return concatUint8Arrays(chunks);
    }

    const left = pcm[0].subarray(i, i + SAMPLES_PER_CHUNK);
    const right = numChannels === 2 ? pcm[1].subarray(i, i + SAMPLES_PER_CHUNK) : undefined;
    const encoded = encoder.encodeBuffer(left, right);
    if (encoded.length > 0) chunks.push(encoded);
    chunkCount++;
  }

  const finalChunk = encoder.flush();
  if (finalChunk.length > 0) chunks.push(finalChunk);

  return concatUint8Arrays(chunks);
}

function concatUint8Arrays(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}
