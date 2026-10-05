import { ensureReadWrite } from './permissions';
import { ArchivePaths } from './archivePaths';
import { writeFile } from './writeFile';
import { ZipStream } from './zipStream';

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
 * outputs are never held together in RAM or a single buffer.
 */
export class DiskZipOutputSink implements OutputSink {
  private paths = new ArchivePaths();
  private zip: ZipStream;

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
    this.zip = new ZipStream(writable);
  }

  async write(relativePath: string, bytes: Uint8Array): Promise<void> {
    await this.zip.add(this.paths.claim(relativePath), bytes);
  }

  async finalize(): Promise<void> {
    await this.zip.end();
    if (this.paths.isEmpty) return;
    download(await this.handle.getFile(), this.downloadName);
  }
}

/**
 * ZipOutputSink starts a new part past this size: Firefox caps a single
 * Blob part at 2 GB, and each part downloads (freeing its memory) while the
 * batch is still running.
 */
const ZIP_PART_LIMIT_BYTES = 1024 ** 3;

/**
 * In-memory fallback for browsers with neither FS Access nor OPFS: streams
 * outputs into ZIPs as they complete, so there's no long main-thread block
 * at the end of a big batch. A batch over ZIP_PART_LIMIT_BYTES downloads as
 * "<name>-part1.zip", "-part2", …
 */
export interface ZipOutputSinkOptions {
  /** Hands a finished part to the user; a browser download by default. */
  save?: (zip: Blob, fileName: string) => void;
  partLimitBytes?: number;
}

export class ZipOutputSink implements OutputSink {
  private part?: MemoryZip;
  private partsSaved = 0;
  private paths = new ArchivePaths();
  private stem: string;
  private save: (zip: Blob, fileName: string) => void;
  private partLimitBytes: number;

  constructor(downloadName: string, options: ZipOutputSinkOptions = {}) {
    this.stem = downloadName.replace(/\.zip$/i, '');
    this.save = options.save ?? download;
    this.partLimitBytes = options.partLimitBytes ?? ZIP_PART_LIMIT_BYTES;
  }

  async write(relativePath: string, bytes: Uint8Array): Promise<void> {
    if (this.part && this.part.zip.bytes + bytes.length > this.partLimitBytes) {
      await this.savePart(this.part, this.numberedPartName());
    }
    this.part ??= new MemoryZip();
    await this.part.zip.add(this.paths.claim(relativePath), bytes);
  }

  /** A batch that never rolled over downloads as one unnumbered ZIP. */
  async finalize(): Promise<void> {
    if (!this.part) return;
    await this.savePart(this.part, this.partsSaved === 0 ? `${this.stem}.zip` : this.numberedPartName());
  }

  private numberedPartName(): string {
    return `${this.stem}-part${this.partsSaved + 1}.zip`;
  }

  /** Detaches the part before awaiting it, so writes that arrive meanwhile start the next one. */
  private async savePart(part: MemoryZip, fileName: string): Promise<void> {
    this.part = undefined;
    this.partsSaved++;
    this.save(await part.toBlob(), fileName);
  }
}

/** A ZipStream collected into memory chunks. */
class MemoryZip {
  private chunks: Uint8Array[] = [];
  readonly zip = new ZipStream(new WritableStream({ write: (chunk) => void this.chunks.push(chunk) }));

  async toBlob(): Promise<Blob> {
    await this.zip.end();
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
