import { ensureReadWrite } from './permissions';
import { ArchivePaths } from './archivePaths';
import { writeFile } from './writeFile';
import { ZipStream } from './zipStream';
import { createBatchZipFile } from './opfsZip';
import type { ZipWriterRequest, ZipWriterResponse } from '../workers/protocol';

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

/**
 * One ZIP of the whole batch, streamed to the Origin Private File System as
 * each output completes and downloaded from disk at the end — for browsers
 * without FS Access but with OPFS writable streams (Firefox, recent Safari).
 * Any size, flat memory: outputs are never held together in RAM or a
 * single buffer.
 */
export class DiskZipOutputSink implements OutputSink {
  private paths = new ArchivePaths();
  private zip: ZipStream;

  /** Undefined when OPFS writable streams aren't available — try WorkerZipOutputSink next. */
  static async create(downloadName: string): Promise<DiskZipOutputSink | undefined> {
    try {
      const handle = await createBatchZipFile(await navigator.storage.getDirectory());
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
 * The same disk-backed batch ZIP, written from a worker through a
 * synchronous access handle — for browsers with OPFS but no writable
 * streams on it (Safari before createWritable).
 */
export class WorkerZipOutputSink implements OutputSink {
  private paths = new ArchivePaths();
  private nextId = 0;
  private pending = new Map<number, { resolve: (fileName?: string) => void; reject: (err: Error) => void }>();

  /** Undefined when the worker can't open a sync access handle (no OPFS, e.g. Firefox private windows). */
  static async create(downloadName: string): Promise<WorkerZipOutputSink | undefined> {
    if (typeof navigator === 'undefined' || !navigator.storage?.getDirectory) return undefined;
    const worker = new Worker(new URL('../workers/zipWriter.worker.ts', import.meta.url), { type: 'module' });
    const sink = new WorkerZipOutputSink(worker, downloadName);
    try {
      await sink.request({ type: 'open' });
      return sink;
    } catch {
      worker.terminate();
      return undefined;
    }
  }

  private constructor(
    private worker: Worker,
    private downloadName: string,
  ) {
    worker.onmessage = (event: MessageEvent<ZipWriterResponse>) => {
      const entry = this.pending.get(event.data.id);
      this.pending.delete(event.data.id);
      if ('error' in event.data) entry?.reject(new Error(event.data.error));
      else entry?.resolve(event.data.fileName);
    };
    // A worker that fails to load or crashes must fail pending requests, not hang them.
    worker.onerror = (event) => {
      for (const { reject } of this.pending.values()) reject(new Error(event.message || 'ZIP worker failed'));
      this.pending.clear();
    };
  }

  private request(msg: DistributiveOmit<ZipWriterRequest, 'id'>): Promise<string | undefined> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({ ...msg, id } as ZipWriterRequest);
    });
  }

  async write(relativePath: string, bytes: Uint8Array): Promise<void> {
    await this.request({ type: 'add', path: this.paths.claim(relativePath), bytes });
  }

  async finalize(): Promise<void> {
    try {
      const fileName = await this.request({ type: 'end' });
      if (this.paths.isEmpty || !fileName) return;
      const dir = await navigator.storage.getDirectory();
      download(await (await dir.getFileHandle(fileName)).getFile(), this.downloadName);
    } finally {
      this.worker.terminate();
    }
  }
}

type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;

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
