/**
 * Read/write permission for a handle, prompting if not already granted.
 * Prompting needs a user gesture, per File System Access API rules.
 */
export async function ensureReadWrite(handle: FileSystemHandle): Promise<boolean> {
  if ((await handle.queryPermission({ mode: 'readwrite' })) === 'granted') return true;
  return (await handle.requestPermission({ mode: 'readwrite' })) === 'granted';
}
