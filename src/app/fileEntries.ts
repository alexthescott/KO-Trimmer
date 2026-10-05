import type { DroppedEntry } from '../fs/dragDropEntries';
import type { FileEntry } from './types';
import { FORMAT_PROBE_BYTES, id3v2Length, parseSourceInfo, type SourceInfo } from '../audio/sampleFormat';

export async function toFileEntries(entries: DroppedEntry[]): Promise<FileEntry[]> {
  const result: FileEntry[] = [];
  for (const entry of entries) {
    const file = entry.file ?? (entry.fileHandle ? await entry.fileHandle.getFile() : undefined);
    if (!file) continue;
    result.push({
      id: crypto.randomUUID(),
      name: entry.name,
      relativePath: entry.relativePath,
      size: file.size,
      sourceKind: entry.fileHandle ? 'handle' : 'file',
      fileHandle: entry.fileHandle,
      file,
      status: 'queued',
      ...(await probeSource(file)),
    });
  }
  return result;
}

/** Root folder name for a batch, used to name the sibling `<root>_trimmed` output directory. */
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
    const extension = file.name.slice(file.name.lastIndexOf('.') + 1).toLowerCase();
    let bytes = new Uint8Array(await file.slice(0, FORMAT_PROBE_BYTES).arrayBuffer());
    const tagLength = id3v2Length(bytes);
    if (tagLength > FORMAT_PROBE_BYTES - 4096) {
      bytes = new Uint8Array(await file.slice(tagLength, tagLength + 4096).arrayBuffer());
    }
    const info = parseSourceInfo(bytes, extension);
    return { sourceFormat: info.format, sourceSampleRate: info.sampleRate };
  } catch {
    return {};
  }
}
