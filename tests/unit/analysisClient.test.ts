import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FileEntry } from '../../src/app/types';
import type { AnalysisRequest, AnalysisResponse } from '../../src/workers/protocol';
import type { PcmAudio } from '../../src/audio/channels';

const decodeEntry = vi.fn<(file: FileEntry) => Promise<PcmAudio>>();
const peekDecoded = vi.fn<(id: string) => Promise<PcmAudio> | undefined>();
vi.mock('../../src/app/decodedCache', () => ({
  decodeEntry: (file: FileEntry) => decodeEntry(file),
  peekDecoded: (id: string) => peekDecoded(id),
}));

/** Records what the client posts; answers `unsupportedFile` for files named unsupported.* */
const posted: Array<{ message: AnalysisRequest; transfer: Transferable[] }> = [];
class FakeWorker {
  onmessage?: (event: MessageEvent<AnalysisResponse>) => void;
  postMessage(message: AnalysisRequest, options: { transfer: Transferable[] }) {
    posted.push({ message, transfer: options.transfer });
    const unsupported = message.source.kind === 'file' && message.source.file.name.startsWith('unsupported');
    const reply: AnalysisResponse = unsupported
      ? { id: message.id, error: 'nope', unsupportedFile: true }
      : { id: message.id, analysis: { channels: 1, sampleRate: 8000, frames: 4, peak: 1, autoFrames: 2 } };
    queueMicrotask(() => this.onmessage?.({ data: reply } as MessageEvent<AnalysisResponse>));
  }
}
vi.stubGlobal('Worker', FakeWorker);

const { analyseEntry } = await import('../../src/app/analysisClient');

const detection = { thresholdDb: -50, minDurationMs: 10, paddingMs: 20 };
const pcm = (): PcmAudio => ({ channels: [new Float32Array([0, 1, 0, 0])], sampleRate: 8000 });
const entry = (name: string): FileEntry => ({
  id: name,
  name,
  relativePath: name,
  size: 4,
  file: new File([], name),
  status: 'queued',
});

describe('analyseEntry', () => {
  beforeEach(() => {
    posted.length = 0;
    decodeEntry.mockReset().mockImplementation(async () => pcm());
    peekDecoded.mockReset().mockReturnValue(undefined);
  });

  it('hands WAV/AIFF to the worker as a file, with no main-thread decode', async () => {
    expect(await analyseEntry(entry('kick.aif'), detection)).toMatchObject({ autoFrames: 2 });
    expect(posted.map((p) => p.message.source.kind)).toEqual(['file']);
    expect(decodeEntry).not.toHaveBeenCalled();
  });

  it('decodes other formats on the main thread and transfers the PCM', async () => {
    await analyseEntry(entry('loop.flac'), detection);
    const [{ message, transfer }] = posted;
    expect(message.source.kind).toBe('pcm');
    expect(transfer).toHaveLength(1);
    expect(message.detection).toEqual(detection);
  });

  it('retries a file the worker cannot decode with main-thread PCM', async () => {
    await analyseEntry(entry('unsupported.wav'), detection);
    expect(posted.map((p) => p.message.source.kind)).toEqual(['file', 'pcm']);
    expect(decodeEntry).toHaveBeenCalledTimes(1);
  });

  it('sends a copy of the editor’s cached decode, never the cached arrays themselves', async () => {
    const cached = pcm();
    peekDecoded.mockReturnValue(Promise.resolve(cached));
    await analyseEntry(entry('loop.mp3'), detection);
    const source = posted[0].message.source;
    expect(source.kind === 'pcm' && source.channels[0]).not.toBe(cached.channels[0]);
    expect(posted[0].transfer).not.toContain(cached.channels[0].buffer);
    expect(decodeEntry).not.toHaveBeenCalled();
  });
});
