import { SUPPORTED_EXTENSIONS, TRIMMED_SUFFIX, walkDirectoryHandle, type DroppedEntry } from './dragDropEntries';
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
 * Native multi-file picker (Chrome): keeps each file's handle, so Overwrite
 * still works for files picked one by one. Null when unsupported or cancelled.
 */
export async function pickFiles(): Promise<DroppedEntry[] | null> {
  if (!('showOpenFilePicker' in window)) return null;
  try {
    const handles = await window.showOpenFilePicker({
      multiple: true,
      types: [{ description: 'Audio', accept: { 'audio/*': SUPPORTED_EXTENSIONS.map((ext) => `.${ext}` as const) } }],
    });
    return handles.map((handle) => ({ name: handle.name, relativePath: handle.name, fileHandle: handle }));
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return null;
    throw err;
  }
}

/**
 * The File System Access API gives directory handles no way to reach their
 * own parent, so a true sibling `<root>_trimmed` folder isn't reachable
 * programmatically. The closest available default is a `<root>_trimmed`
 * subfolder created inside the picked root itself; a user who wants a true
 * sibling can use the explicit "choose output folder" override instead.
 */
export function defaultOutputFolderName(sourceRootHandle: FileSystemDirectoryHandle): string {
  return `${sourceRootHandle.name}${TRIMMED_SUFFIX}`;
}

/** Creates the default output folder; needs readwrite permission on the source root. */
export async function resolveDefaultOutputRoot(
  sourceRootHandle: FileSystemDirectoryHandle,
): Promise<FileSystemDirectoryHandle> {
  return sourceRootHandle.getDirectoryHandle(defaultOutputFolderName(sourceRootHandle), { create: true });
}
