import { TRIMMED_SUFFIX, walkDirectoryHandle, type DroppedEntry } from './dragDropEntries';
import { isFileSystemAccessSupported } from './capabilities';

export interface PickedDirectory {
  handle: FileSystemDirectoryHandle;
  entries: DroppedEntry[];
}

/**
 * Native read/write directory picker (Chrome/File System Access API).
 * Null when unsupported or the user cancels.
 */
export async function pickWritableDirectory(): Promise<FileSystemDirectoryHandle | null> {
  if (!isFileSystemAccessSupported()) return null;
  try {
    return await window.showDirectoryPicker({ mode: 'readwrite' });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return null;
    throw err;
  }
}

/** Picks a directory and recursively walks it. */
export async function pickDirectory(): Promise<PickedDirectory | null> {
  const handle = await pickWritableDirectory();
  if (!handle) return null;
  return { handle, entries: await walkDirectoryHandle(handle) };
}

/**
 * The File System Access API gives directory handles no way to reach their
 * own parent, so a true sibling `<root>_trimmed` folder isn't reachable
 * programmatically. The closest available default is a `<root>_trimmed`
 * subfolder created inside the picked root itself; a user who wants a true
 * sibling can use the explicit "choose output folder" override instead.
 */
export async function resolveDefaultOutputRoot(sourceRootHandle: FileSystemDirectoryHandle): Promise<FileSystemDirectoryHandle> {
  return sourceRootHandle.getDirectoryHandle(`${sourceRootHandle.name}${TRIMMED_SUFFIX}`, { create: true });
}
