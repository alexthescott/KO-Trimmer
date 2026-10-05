import { walkDirectoryHandle, type DroppedEntry } from './dragDropEntries';

export interface PickedDirectory {
  handle: FileSystemDirectoryHandle;
  entries: DroppedEntry[];
}

/** Opens the native directory picker (Chrome/File System Access API) and recursively walks it. */
export async function pickDirectory(): Promise<PickedDirectory | null> {
  if (!('showDirectoryPicker' in window)) return null;
  try {
    const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
    const entries = await walkDirectoryHandle(handle);
    return { handle, entries };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return null;
    throw err;
  }
}

/**
 * The File System Access API gives directory handles no way to reach their
 * own parent, so a true sibling `<root>_trimmed` folder isn't reachable
 * programmatically. The closest available
 * default is a `<root>_trimmed` subfolder created inside the picked root
 * itself; a user who wants a true sibling can use the explicit "choose
 * output folder" override instead.
 */
export async function resolveDefaultOutputRoot(
  sourceRootHandle: FileSystemDirectoryHandle,
  rootName: string,
): Promise<FileSystemDirectoryHandle> {
  return sourceRootHandle.getDirectoryHandle(`${rootName}_trimmed`, { create: true });
}

/** Explicit override: let the user pick any writable directory (including a true sibling) directly. */
export async function pickOutputDirectory(): Promise<FileSystemDirectoryHandle | null> {
  if (!('showDirectoryPicker' in window)) return null;
  try {
    return await window.showDirectoryPicker({ mode: 'readwrite' });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return null;
    throw err;
  }
}
