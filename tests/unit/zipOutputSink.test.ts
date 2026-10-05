import { describe, it, expect } from 'vitest';
import { unzipSync } from 'fflate';
import { ZipOutputSink } from '../../src/fs/outputWriter';

async function contentsOf(zip: Blob): Promise<Record<string, number[]>> {
  const entries = unzipSync(new Uint8Array(await zip.arrayBuffer()));
  return Object.fromEntries(Object.entries(entries).map(([name, data]) => [name, Array.from(data)]));
}

function sink(partLimitBytes?: number) {
  const saved: Array<{ name: string; zip: Blob }> = [];
  const zipSink = new ZipOutputSink('kit_trimmed.zip', { save: (zip, name) => saved.push({ name, zip }), partLimitBytes });
  return { zipSink, saved };
}

describe('ZipOutputSink', () => {
  it('writes every output into one ZIP, de-duplicating repeated paths', async () => {
    const { zipSink, saved } = sink();
    await zipSink.write('kick.wav', new Uint8Array([1, 2]));
    await zipSink.write('snares/snare.wav', new Uint8Array([3]));
    await zipSink.write('kick.wav', new Uint8Array([4]));
    await zipSink.finalize();

    expect(saved.map((s) => s.name)).toEqual(['kit_trimmed.zip']);
    expect(await contentsOf(saved[0].zip)).toEqual({
      'kick.wav': [1, 2],
      'snares/snare.wav': [3],
      'kick (2).wav': [4],
    });
  });

  it('rolls over into numbered parts past the size limit', async () => {
    const { zipSink, saved } = sink(4);
    await zipSink.write('a.wav', new Uint8Array(3));
    await zipSink.write('b.wav', new Uint8Array(3)); // 6 > 4: part 1 is saved first
    await zipSink.write('c.wav', new Uint8Array(1));
    await zipSink.finalize();

    expect(saved.map((s) => s.name)).toEqual(['kit_trimmed-part1.zip', 'kit_trimmed-part2.zip']);
    expect(Object.keys(await contentsOf(saved[0].zip))).toEqual(['a.wav']);
    expect(Object.keys(await contentsOf(saved[1].zip))).toEqual(['b.wav', 'c.wav']);
  });

  it('accepts concurrent writes, as processBatch makes them', async () => {
    const { zipSink, saved } = sink(5);
    await Promise.all(['a', 'b', 'c', 'd'].map((n) => zipSink.write(`${n}.wav`, new Uint8Array(2))));
    await zipSink.finalize();
    const names = (await Promise.all(saved.map((s) => contentsOf(s.zip)))).flatMap(Object.keys);
    expect(names.sort()).toEqual(['a.wav', 'b.wav', 'c.wav', 'd.wav']);
    expect(saved.map((s) => s.name)).toEqual(saved.map((_, i) => `kit_trimmed-part${i + 1}.zip`));
  });

  it('saves nothing for an empty batch', async () => {
    const { zipSink, saved } = sink();
    await zipSink.finalize();
    expect(saved).toEqual([]);
  });
});
