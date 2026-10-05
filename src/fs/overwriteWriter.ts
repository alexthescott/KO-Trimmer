import type { FileEntry } from '../app/types';
import { extensionOf } from '../app/fileNames';
import { outputContainerFor } from '../audio/outputContainer';
import { ensureReadWrite } from './permissions';

/**
 * True "Overwrite" support: writes directly back to the exact source
 * FileSystemFileHandle, bypassing all derived-name/output-directory logic.
 */
export async function overwriteSourceFile(
  fileHandle: FileSystemFileHandle,
  bytes: Uint8Array,
): Promise<void> {
  if (!(await ensureReadWrite(fileHandle))) {
    throw new Error('Write permission to overwrite the original file was not granted.');
  }
  const writable = await fileHandle.createWritable();
  await writable.write(bytes as Uint8Array<ArrayBuffer>);
  await writable.close();
}

/**
 * Can this source be overwritten in place? Only handle-backed sources (not
 * plain <input> Files), and only when the output keeps the source's container
 * — a .flac re-encoded as WAV must not land in a file still named .flac.
 */
export function canOverwrite(file: FileEntry): file is FileEntry & { fileHandle: FileSystemFileHandle } {
  const extension = extensionOf(file.name);
  return file.fileHandle !== undefined && outputContainerFor(extension) === extension;
}
