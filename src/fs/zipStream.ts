import { makeZip } from 'client-zip';
import { AsyncQueue } from './asyncQueue';

/**
 * One ZIP archive written as entries arrive: store-only (audio barely
 * deflates), ZIP64 past 4 GB, streamed into `destination` so entries are
 * never all held at once. `add` resolves once the archive has taken the
 * entry, so a slow destination holds producers back.
 */
export class ZipStream {
  /** Entry bytes added so far (excluding ZIP headers). */
  bytes = 0;
  private queue = new AsyncQueue<{ name: string; input: Uint8Array; lastModified: Date }>();
  private written: Promise<void>;

  constructor(destination: WritableStream<Uint8Array>) {
    this.written = makeZip(this.queue).pipeTo(destination);
    // A failed write (quota, I/O) must fail pending add() calls rather than hang them.
    this.written.catch((err) => this.queue.fail(err));
  }

  add(name: string, bytes: Uint8Array): Promise<void> {
    this.bytes += bytes.length;
    return this.queue.push({ name, input: bytes, lastModified: new Date() });
  }

  /** Writes the central directory and resolves once the destination has everything. */
  async end(): Promise<void> {
    this.queue.close();
    await this.written;
  }
}
