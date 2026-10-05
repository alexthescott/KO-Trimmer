import { SUPPORTED_EXTENSIONS } from '../audio/settingsDefaults';
import { extensionOf } from '../app/fileNames';

/** Suffix of the output folder; folders ending in it are skipped so a re-scan never reprocesses output. */
export const TRIMMED_SUFFIX = '_trimmed';

export interface DroppedEntry {
  name: string;
  relativePath: string;
  fileHandle?: FileSystemFileHandle;
  file?: File;
}

function hasSupportedExtension(name: string): boolean {
  return (SUPPORTED_EXTENSIONS as readonly string[]).includes(extensionOf(name));
}

export interface ResolvedDrop {
  entries: DroppedEntry[];
  /** Set only when exactly one top-level dropped item was a writable directory handle. */
  rootHandle?: FileSystemDirectoryHandle;
}

/**
 * Recursively resolves dropped files/folders. Prefers getAsFileSystemHandle
 * (Chrome; keeps write capability for Overwrite/favorites) and falls back
 * to webkitGetAsEntry (read-only File objects) elsewhere.
 */
export async function resolveDroppedItems(items: DataTransferItemList): Promise<ResolvedDrop> {
  const results: DroppedEntry[] = [];
  const topLevel: Array<FileSystemHandle | FileSystemEntry | File> = [];

  for (const item of Array.from(items)) {
    if (item.kind !== 'file') continue;
    const anyItem = item as DataTransferItem & {
      getAsFileSystemHandle?: () => Promise<FileSystemHandle | null>;
      webkitGetAsEntry?: () => FileSystemEntry | null;
    };
    if (typeof anyItem.getAsFileSystemHandle === 'function') {
      const handle = await anyItem.getAsFileSystemHandle();
      if (handle) topLevel.push(handle);
    } else if (typeof anyItem.webkitGetAsEntry === 'function') {
      const entry = anyItem.webkitGetAsEntry();
      if (entry) topLevel.push(entry);
    } else {
      const file = item.getAsFile();
      if (file) topLevel.push(file);
    }
  }

  for (const entryLike of topLevel) {
    await walk(entryLike, '', results);
  }

  const directoryHandles = topLevel.filter(
    (item): item is FileSystemDirectoryHandle => 'kind' in item && item.kind === 'directory',
  );
  const rootHandle =
    topLevel.length === 1 && directoryHandles.length === 1 ? directoryHandles[0] : undefined;

  return { entries: results, rootHandle };
}

async function walk(
  entryLike: FileSystemHandle | FileSystemEntry | File,
  parentPath: string,
  out: DroppedEntry[],
): Promise<void> {
  if (entryLike instanceof File) {
    if (hasSupportedExtension(entryLike.name)) {
      out.push({ name: entryLike.name, relativePath: joinPath(parentPath, entryLike.name), file: entryLike });
    }
    return;
  }

  if ('kind' in entryLike) {
    const handle = entryLike as FileSystemHandle;
    const path = joinPath(parentPath, handle.name);
    if (handle.kind === 'file') {
      if (hasSupportedExtension(handle.name)) {
        out.push({ name: handle.name, relativePath: path, fileHandle: handle as FileSystemFileHandle });
      }
      return;
    }
    if (handle.name.endsWith(TRIMMED_SUFFIX)) return;
    const dirHandle = handle as FileSystemDirectoryHandle;
    for await (const child of dirHandle.values()) {
      await walk(child, path, out);
    }
    return;
  }

  // FileSystemEntry (webkitGetAsEntry) path — read-only.
  const entry = entryLike as FileSystemEntry;
  const path = joinPath(parentPath, entry.name);
  if (entry.isFile) {
    if (!hasSupportedExtension(entry.name)) return;
    const file = await new Promise<File>((resolve, reject) =>
      (entry as FileSystemFileEntry).file(resolve, reject),
    );
    out.push({ name: entry.name, relativePath: path, file });
  } else if (entry.isDirectory) {
    if (entry.name.endsWith(TRIMMED_SUFFIX)) return;
    const dirEntry = entry as FileSystemDirectoryEntry;
    const reader = dirEntry.createReader();
    const children = await readAllEntries(reader);
    for (const child of children) {
      await walk(child, path, out);
    }
  }
}

function readAllEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => {
    const all: FileSystemEntry[] = [];
    const readBatch = () => {
      reader.readEntries(
        (entries) => {
          if (entries.length === 0) {
            resolve(all);
          } else {
            all.push(...entries);
            readBatch();
          }
        },
        reject,
      );
    };
    readBatch();
  });
}

function joinPath(parent: string, name: string): string {
  return parent ? `${parent}/${name}` : name;
}

/** Recursively walks a directory handle (from showDirectoryPicker or a favorite) into DroppedEntry[]. */
export async function walkDirectoryHandle(dirHandle: FileSystemDirectoryHandle): Promise<DroppedEntry[]> {
  const results: DroppedEntry[] = [];
  await walk(dirHandle, '', results);
  return results;
}
