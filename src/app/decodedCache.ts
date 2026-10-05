import type { FileEntry } from './types';
import { decodeAudioFile } from '../audio/decode';
import type { PcmAudio } from '../audio/channels';

const MAX_ENTRIES = 3;
const cache = new Map<string, Promise<PcmAudio>>();

/**
 * Small LRU of decoded audio for the waveform editor, so flipping between
 * a few files doesn't re-decode each time while bounding memory for large
 * batches (decoded PCM is ~10x the size of a compressed source).
 */
export function getDecoded(file: FileEntry): Promise<PcmAudio> {
  const hit = cache.get(file.id);
  if (hit) {
    cache.delete(file.id);
    cache.set(file.id, hit);
    return hit;
  }
  const promise = decodeEntry(file);
  promise.catch(() => cache.delete(file.id));
  cache.set(file.id, promise);
  while (cache.size > MAX_ENTRIES) {
    cache.delete(cache.keys().next().value!);
  }
  return promise;
}

/** Cached decode, if any, without touching LRU order or triggering a decode. */
export function peekDecoded(id: string): Promise<PcmAudio> | undefined {
  return cache.get(id);
}

export function evictDecoded(id: string): void {
  cache.delete(id);
}

/** Decodes a file entry on the main thread at its native sample rate (uncached). */
export async function decodeEntry(file: FileEntry): Promise<PcmAudio> {
  return decodeAudioFile(await file.file.arrayBuffer(), file.sourceSampleRate);
}
