import { Zip, ZipPassThrough } from 'fflate';
import { makeZip } from 'client-zip';
import { AsyncQueue } from './asyncQueue';
import { ensureReadWrite } from './permissions';

export interface OutputSink {
  write(relativePath: string, bytes: Uint8Array): Promise<void>;
  finalize(): Promise<void>;
}

/** Writes outputs into a directory tree via the File System Access API. */
export class FsAccessOutputSink implements OutputSink {
  private rootHandle: FileSystemDirectoryHandle;
  private permissionChecked = false;

  constructor(rootHandle: FileSystemDirectoryHandle) {
    this.rootHandle = rootHandle;
  }

  private async ensurePermission(): Promise<void> {
    if (this.permissionChecked) return;
    if (!(await ensureReadWrite(this.rootHandle))) {
      throw new Error('Write permission to the output directory was not granted.');
    }
    this.permissionChecked = true;
  }

  async write(relativePath: string, bytes: Uint8Array): Promise<void> {
    await this.ensurePermission();
    const parts = relativePath.split('/').filter(Boolean);
    const fileName = parts.pop()!;
    let dir = this.rootHandle;
    for (const part of parts) {
      dir = await dir.getDirectoryHandle(part, { create: true });
    }
    const fileHandle = await dir.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(bytes as Uint8Array<ArrayBuffer>);
    await writable.close();
  }

  async finalize(): Promise<void> {
    // no-op: files are written as they complete
  }
}

/** OPFS file names for disk-backed ZIPs; stale ones from earlier batches are deleted at the next batch. */
const DISK_ZIP_PREFIX = 'batch-output-';

/**
 * One ZIP of the whole batch, streamed to the Origin Private File System as
 * each output completes and downloaded from disk at the end — for browsers
 * without FS Access but with OPFS (Firefox, Safari). Any size, flat memory:
 * outputs are written as they arrive (store-only, ZIP64 past 4 GB via
 * client-zip) and never held together in RAM or a single buffer.
 */
export class DiskZipOutputSink implements OutputSink {
  private queue = new AsyncQueue<{ name: string; input: Uint8Array; lastModified: Date }>();
  private paths = new Set<string>();
  private written: Promise<void>;

  /** Undefined when OPFS isn't available (e.g. Firefox private windows) — use ZipOutputSink instead. */
  static async create(downloadName: string): Promise<DiskZipOutputSink | undefined> {
    try {
      const dir = await navigator.storage.getDirectory();
      for await (const name of dir.keys()) {
        if (name.startsWith(DISK_ZIP_PREFIX)) await dir.removeEntry(name).catch(() => {});
      }
      const handle = await dir.getFileHandle(`${DISK_ZIP_PREFIX}${Date.now()}.zip`, { create: true });
      return new DiskZipOutputSink(handle, await handle.createWritable(), downloadName);
    } catch {
      return undefined;
    }
  }

  private constructor(
    private handle: FileSystemFileHandle,
    writable: FileSystemWritableFileStream,
    private downloadName: string,
  ) {
    this.written = makeZip(this.queue).pipeTo(writable);
    // A failed disk write (quota, I/O) must fail pending write() calls rather than hang them.
    this.written.catch((err) => this.queue.fail(err));
  }

  async write(relativePath: string, bytes: Uint8Array): Promise<void> {
    await this.queue.push({ name: uniquePath(relativePath, this.paths), input: bytes, lastModified: new Date() });
  }

  async finalize(): Promise<void> {
    this.queue.close();
    await this.written;
    if (this.paths.size === 0) return;
    download(await this.handle.getFile(), this.downloadName);
  }
}

/**
 * Fallback when OPFS is unavailable. ZIP parts roll over at this size. Keeps every archive well under fflate's
 * non-ZIP64 4 GB limit and Firefox's 2 GB-per-buffer limits, and lets each
 * part download (and its memory go) while the batch is still running.
 */
const ZIP_PART_LIMIT_BYTES = 1024 ** 3;

/**
 * In-memory fallback for browsers with neither FS Access nor OPFS: streams
 * outputs into ZIPs as they complete.
 * Entries are stored uncompressed — audio barely deflates — and appended at
 * write time, so there's no long main-thread block at the end of a big batch.
 * A batch over ZIP_PART_LIMIT_BYTES downloads as "<name>-part1.zip", "-part2", …
 */
export class ZipOutputSink implements OutputSink {
  private part?: ZipPart;
  private partsDownloaded = 0;
  private paths = new Set<string>();
  private downloadName: string;

  constructor(downloadName: string) {
    this.downloadName = downloadName;
  }

  async write(relativePath: string, bytes: Uint8Array): Promise<void> {
    if (this.part && this.part.bytes + bytes.length > ZIP_PART_LIMIT_BYTES) this.downloadPart(false);
    this.part ??= new ZipPart();
    this.part.add(uniquePath(relativePath, this.paths), bytes);
  }

  async finalize(): Promise<void> {
    this.downloadPart(true);
  }

  private downloadPart(isLast: boolean): void {
    if (!this.part) return;
    const blob = this.part.end();
    this.part = undefined;
    const stem = this.downloadName.replace(/\.zip$/i, '');
    const single = isLast && this.partsDownloaded === 0;
    download(blob, single ? `${stem}.zip` : `${stem}-part${++this.partsDownloaded}.zip`);
  }
}

/** One store-only ZIP being streamed into memory chunks. */
class ZipPart {
  bytes = 0;
  private chunks: Uint8Array[] = [];
  private error?: Error;
  private zip = new Zip((err, chunk) => {
    if (err) this.error ??= err;
    else this.chunks.push(chunk);
  });

  add(path: string, data: Uint8Array): void {
    const entry = new ZipPassThrough(path);
    this.zip.add(entry);
    entry.push(data, true);
    this.bytes += data.length;
    if (this.error) throw this.error;
  }

  end(): Blob {
    this.zip.end();
    if (this.error) throw this.error;
    return new Blob(this.chunks as Uint8Array<ArrayBuffer>[], { type: 'application/zip' });
  }
}

function download(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  // Revoking straight away can cancel a large download before it starts (Firefox).
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** A path not yet in `taken` (and records it): "a.wav", then "a (2).wav", … — entries can't be replaced once streamed. */
function uniquePath(path: string, taken: Set<string>): string {
  let candidate = path;
  const dot = path.lastIndexOf('.');
  const [stem, ext] = dot > path.lastIndexOf('/') ? [path.slice(0, dot), path.slice(dot)] : [path, ''];
  for (let n = 2; taken.has(candidate); n++) candidate = `${stem} (${n})${ext}`;
  taken.add(candidate);
  return candidate;
}
