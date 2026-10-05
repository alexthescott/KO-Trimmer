/**
 * True "Overwrite" support: writes directly back to the exact source
 * FileSystemFileHandle, bypassing all derived-name/output-directory logic.
 */
export async function overwriteSourceFile(
  fileHandle: FileSystemFileHandle,
  bytes: Uint8Array,
): Promise<void> {
  const granted = await fileHandle.queryPermission({ mode: 'readwrite' });
  if (granted !== 'granted') {
    const result = await fileHandle.requestPermission({ mode: 'readwrite' });
    if (result !== 'granted') {
      throw new Error('Write permission to overwrite the original file was not granted.');
    }
  }
  const writable = await fileHandle.createWritable();
  await writable.write(bytes as Uint8Array<ArrayBuffer>);
  await writable.close();
}

/** Can this source be overwritten in place? Only handle-backed sources (not plain <input> Files). */
export function canOverwrite(fileHandle: FileSystemFileHandle | undefined): boolean {
  return !!fileHandle;
}
