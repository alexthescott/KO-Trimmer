import type { DroppedEntry } from '../fs/dragDropEntries';
import type { FileEntry } from './types';

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
    });
  }
  return result;
}

/** Root folder name for a batch, used to name the sibling `<root>_trimmed` output directory. */
export function deriveRootName(entries: DroppedEntry[]): string | undefined {
  const withSlash = entries.find((e) => e.relativePath.includes('/'));
  return withSlash?.relativePath.split('/')[0];
}
