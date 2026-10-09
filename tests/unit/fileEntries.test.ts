import { describe, it, expect } from 'vitest';
import { toFileEntries } from '../../src/app/fileEntries';
import type { DroppedEntry } from '../../src/fs/dragDropEntries';
import { encodeWav } from '../../src/audio/wavEncoder';

const wavFile = (name: string, sampleRate: number) =>
  new File([encodeWav([new Float32Array(16)], sampleRate) as Uint8Array<ArrayBuffer>], name);

/** A handle-backed entry whose getFile() settles after `delayMs`. */
function slowHandle(name: string, sampleRate: number, delayMs: number): DroppedEntry {
  const file = wavFile(name, sampleRate);
  const fileHandle = {
    getFile: () => new Promise<File>((resolve) => setTimeout(() => resolve(file), delayMs)),
  } as unknown as FileSystemFileHandle;
  return { name, relativePath: `kit/${name}`, fileHandle };
}

describe('toFileEntries', () => {
  it('keeps the dropped order even when probes finish out of order', async () => {
    const entries = [slowHandle('a.wav', 44100, 30), slowHandle('b.wav', 22050, 0), slowHandle('c.wav', 48000, 10)];
    const files = await toFileEntries(entries);
    expect(files.map((f) => f.name)).toEqual(['a.wav', 'b.wav', 'c.wav']);
    expect(files.map((f) => f.sourceSampleRate)).toEqual([44100, 22050, 48000]);
    expect(files[0]).toMatchObject({ relativePath: 'kit/a.wav', status: 'queued', sourceFormat: { bits: 16 } });
  });

  it('probes concurrently rather than one at a time', async () => {
    const entries = Array.from({ length: 10 }, (_, i) => slowHandle(`${i}.wav`, 44100, 40));
    const start = performance.now();
    await toFileEntries(entries);
    expect(performance.now() - start).toBeLessThan(200); // sequential would be >= 400 ms
  });

  it('skips entries with neither a file nor a handle', async () => {
    const files = await toFileEntries([
      { name: 'x.wav', relativePath: 'x.wav' },
      { name: 'y.wav', relativePath: 'y.wav', file: wavFile('y.wav', 8000) },
    ]);
    expect(files.map((f) => f.name)).toEqual(['y.wav']);
  });
});
