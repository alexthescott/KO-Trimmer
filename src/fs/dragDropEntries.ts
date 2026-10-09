import { extensionOf } from '../app/fileNames';

/** Audio files picked up from drops and folder walks; everything else is ignored. */
export const SUPPORTED_EXTENSIONS = [
  'wav',
  'wave',
  'mp3',
  'flac',
  'aif',
  'aiff',
  'aifc',
  'm4a',
  'ogg',
  'opus',
] as const;

/** Suffix of the output folder; folders ending in it are skipped so a re-scan never reprocesses output. */
export const TRIMMED_SUFFIX = '_trimmed';

export interface DroppedEntry {
  name: string;
  relativePath: string;
  fileHandle?: FileSystemFileHandle;
  file?: File;
}

/** What a drop can hand over: a FS Access handle (Chrome), a legacy entry, or a bare File. */
type DropSource = FileSystemHandle | FileSystemEntry | File;

function hasSupportedExtension(name: string): boolean {
  return (SUPPORTED_EXTENSIONS as readonly string[]).includes(extensionOf(name));
}

function isOutputFolder(name: string): boolean {
  return name.endsWith(TRIMMED_SUFFIX);
}

export interface ResolvedDrop {
  entries: DroppedEntry[];
  /** Set only when exactly one top-level dropped item was a writable directory handle. */
  rootHandle?: FileSystemDirectoryHandle;
}

/**
 * Recursively resolves dropped files/folders. Prefers getAsFileSystemHandle
 * (Chrome; keeps write capability for Overwrite) and falls back
 * to webkitGetAsEntry (read-only File objects) elsewhere.
 */
export async function resolveDroppedItems(items: DataTransferItemList): Promise<ResolvedDrop> {
  // Chrome empties the DataTransferItemList at the first await, so every
  // item's handle/entry must be requested synchronously before awaiting any.
  const pending: Array<Promise<DropSource | null>> = [];

  for (const item of Array.from(items)) {
    if (item.kind !== 'file') continue;
    const anyItem = item as DataTransferItem & {
      getAsFileSystemHandle?: () => Promise<FileSystemHandle | null>;
      webkitGetAsEntry?: () => FileSystemEntry | null;
    };
    if (typeof anyItem.getAsFileSystemHandle === 'function') {
      pending.push(anyItem.getAsFileSystemHandle());
    } else if (typeof anyItem.webkitGetAsEntry === 'function') {
      pending.push(Promise.resolve(anyItem.webkitGetAsEntry()));
    } else {
      pending.push(Promise.resolve(item.getAsFile()));
    }
  }

  const topLevel = (await Promise.all(pending)).filter((source): source is DropSource => source !== null);
  const entries = await collect(topLevel);

  const directoryHandles = topLevel.filter(
    (item): item is FileSystemDirectoryHandle => 'kind' in item && item.kind === 'directory',
  );
  const rootHandle = topLevel.length === 1 && directoryHandles.length === 1 ? directoryHandles[0] : undefined;

  return { entries, rootHandle };
}

async function collect(sources: DropSource[]): Promise<DroppedEntry[]> {
  const entries: DroppedEntry[] = [];
  for (const source of sources) {
    for await (const entry of walk(source, '')) entries.push(entry);
  }
  return entries;
}

function walk(source: DropSource, parentPath: string): AsyncIterable<DroppedEntry> {
  if (source instanceof File) return walkFile(source, parentPath);
  if ('kind' in source) return walkHandle(source, parentPath);
  return walkEntry(source, parentPath);
}

async function* walkFile(file: File, parentPath: string): AsyncGenerator<DroppedEntry> {
  if (!hasSupportedExtension(file.name)) return;
  yield { name: file.name, relativePath: joinPath(parentPath, file.name), file };
}

/** File System Access handles: keeps each file's handle, so Overwrite can write back to it. */
async function* walkHandle(handle: FileSystemHandle, parentPath: string): AsyncGenerator<DroppedEntry> {
  const path = joinPath(parentPath, handle.name);
  if (handle.kind === 'file') {
    if (!hasSupportedExtension(handle.name)) return;
    yield { name: handle.name, relativePath: path, fileHandle: handle as FileSystemFileHandle };
    return;
  }
  if (isOutputFolder(handle.name)) return;
  for await (const child of (handle as FileSystemDirectoryHandle).values()) yield* walkHandle(child, path);
}

/** webkitGetAsEntry entries: read-only File objects. */
async function* walkEntry(entry: FileSystemEntry, parentPath: string): AsyncGenerator<DroppedEntry> {
  const path = joinPath(parentPath, entry.name);
  if (entry.isFile) {
    if (!hasSupportedExtension(entry.name)) return;
    const file = await new Promise<File>((resolve, reject) => (entry as FileSystemFileEntry).file(resolve, reject));
    yield { name: entry.name, relativePath: path, file };
    return;
  }
  if (!entry.isDirectory || isOutputFolder(entry.name)) return;
  const children = await readAllEntries((entry as FileSystemDirectoryEntry).createReader());
  for (const child of children) yield* walkEntry(child, path);
}

function readAllEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => {
    const all: FileSystemEntry[] = [];
    const readBatch = () => {
      reader.readEntries((entries) => {
        if (entries.length === 0) {
          resolve(all);
        } else {
          all.push(...entries);
          readBatch();
        }
      }, reject);
    };
    readBatch();
  });
}

function joinPath(parent: string, name: string): string {
  return parent ? `${parent}/${name}` : name;
}

/** Recursively walks a directory handle (from showDirectoryPicker) into DroppedEntry[]. */
export function walkDirectoryHandle(dirHandle: FileSystemDirectoryHandle): Promise<DroppedEntry[]> {
  return collect([dirHandle]);
}
