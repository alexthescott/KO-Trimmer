import { Zip, ZipPassThrough } from 'fflate';
import { makeZip } from 'client-zip';
import { AsyncQueue } from './asyncQueue';
import { ensureReadWrite } from './permissions';
import { ArchivePaths } from './archivePaths';
import { writeFile } from './writeFile';

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
    await writeFile(await dir.getFileHandle(fileName, { create: true }), bytes);
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
  private paths = new ArchivePaths();
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
    await this.queue.push({ name: this.paths.claim(relativePath), input: bytes, lastModified: new Date() });
  }

  async finalize(): Promise<void> {
    this.queue.close();
    await this.written;
    if (this.paths.isEmpty) return;
    download(await this.handle.getFile(), this.downloadName);
  }
}

/**
 * ZipOutputSink starts a new part past this size: well under fflate's
 * non-ZIP64 4 GB limit and Firefox's 2 GB-per-buffer limit, and each part
 * downloads (freeing its memory) while the batch is still running.
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
  private paths = new ArchivePaths();
  private stem: string;

  constructor(downloadName: string) {
    this.stem = downloadName.replace(/\.zip$/i, '');
  }

  async write(relativePath: string, bytes: Uint8Array): Promise<void> {
    if (this.part && this.part.bytes + bytes.length > ZIP_PART_LIMIT_BYTES) {
      this.downloadPart(this.part, this.numberedPartName());
    }
    this.part ??= new ZipPart();
    this.part.add(this.paths.claim(relativePath), bytes);
  }

  /** A batch that never rolled over downloads as one unnumbered ZIP. */
  async finalize(): Promise<void> {
    if (!this.part) return;
    this.downloadPart(this.part, this.partsDownloaded === 0 ? `${this.stem}.zip` : this.numberedPartName());
  }

  private numberedPartName(): string {
    return `${this.stem}-part${this.partsDownloaded + 1}.zip`;
  }

  private downloadPart(part: ZipPart, fileName: string): void {
    const blob = part.end();
    this.part = undefined;
    this.partsDownloaded++;
    download(blob, fileName);
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
