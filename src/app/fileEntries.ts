import type { DroppedEntry } from '../fs/dragDropEntries';
import type { FileEntry } from './types';
import { extensionOf } from './fileNames';
import { forEachConcurrent } from './concurrency';
import { FORMAT_PROBE_BYTES, id3v2Length, parseSourceInfo, type SourceInfo } from '../audio/sourceHeader';

/** Header probes in flight at once: each is a small read, so a big drop is latency-bound, not memory-bound. */
const PROBE_CONCURRENCY = 16;

/** Resolves dropped entries to FileEntries (header probed), in the order given. */
export async function toFileEntries(entries: DroppedEntry[]): Promise<FileEntry[]> {
  const result: Array<FileEntry | undefined> = new Array(entries.length);
  await forEachConcurrent([...entries.keys()], PROBE_CONCURRENCY, async (i) => {
    const entry = entries[i];
    const file = entry.file ?? (entry.fileHandle ? await entry.fileHandle.getFile() : undefined);
    if (!file) return;
    result[i] = {
      id: crypto.randomUUID(),
      name: entry.name,
      relativePath: entry.relativePath,
      size: file.size,
      fileHandle: entry.fileHandle,
      file,
      status: 'queued',
      ...(await probeSource(file)),
    };
  });
  return result.filter((f): f is FileEntry => f !== undefined);
}

/** Root folder name for a batch, used to name the `<root>_trimmed.zip` download. */
export function deriveRootName(entries: DroppedEntry[]): string | undefined {
  const withSlash = entries.find((e) => e.relativePath.includes('/'));
  return withSlash?.relativePath.split('/')[0];
}

/**
 * Reads just the header bytes for bit depth + native sample rate. An MP3 whose
 * ID3 tag (e.g. embedded artwork) outgrows the probe gets a second small read
 * past the tag. A probe failure only means no header info.
 */
async function probeSource(file: File): Promise<{ sourceFormat?: SourceInfo['format']; sourceSampleRate?: number }> {
  try {
    let bytes = new Uint8Array(await file.slice(0, FORMAT_PROBE_BYTES).arrayBuffer());
    const tagLength = id3v2Length(bytes);
    if (tagLength > FORMAT_PROBE_BYTES - 4096) {
      bytes = new Uint8Array(await file.slice(tagLength, tagLength + 4096).arrayBuffer());
    }
    const info = parseSourceInfo(bytes, extensionOf(file.name));
    return { sourceFormat: info.format, sourceSampleRate: info.sampleRate };
  } catch {
    return {};
  }
}
