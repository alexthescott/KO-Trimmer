import type { FileEntry } from './types';
import { decodeAudioFile, type DecodedAudio } from '../audio/decode';

const MAX_ENTRIES = 3;
const cache = new Map<string, Promise<DecodedAudio>>();

/**
 * Small LRU of decoded audio for the waveform editor, so flipping between
 * a few files doesn't re-decode each time while bounding memory for large
 * batches (decoded PCM is ~10x the size of a compressed source).
 */
export function getDecoded(file: FileEntry): Promise<DecodedAudio> {
  const hit = cache.get(file.id);
  if (hit) {
    cache.delete(file.id);
    cache.set(file.id, hit);
    return hit;
  }
  const promise = file.file.arrayBuffer().then((buffer) => decodeAudioFile(buffer, file.sourceSampleRate));
  promise.catch(() => cache.delete(file.id));
  cache.set(file.id, promise);
  while (cache.size > MAX_ENTRIES) {
    cache.delete(cache.keys().next().value!);
  }
  return promise;
}

/** Cached decode, if any, without touching LRU order or triggering a decode. */
export function peekDecoded(id: string): Promise<DecodedAudio> | undefined {
  return cache.get(id);
}

export function evictDecoded(id: string): void {
  cache.delete(id);
}
