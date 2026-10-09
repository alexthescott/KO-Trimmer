import type { FileEntry } from './types';
import type { AudioAnalysis } from '../audio/analysis';
import type { DetectionSettings } from '../audio/autoTrim';
import { PCM_FILE_EXTENSIONS } from '../audio/pcmFileDecoder';
import { UnsupportedFileError, type AnalysisRequest, type AnalysisResponse, type JobSource } from '../workers/protocol';
import { decodeEntry, peekDecoded } from './decodedCache';
import { extensionOf } from './fileNames';

let worker: Worker | null = null;
let nextId = 0;
const pending = new Map<number, { resolve: (analysis: AudioAnalysis) => void; reject: (err: Error) => void }>();

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL('../workers/analysis.worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (event: MessageEvent<AnalysisResponse>) => {
    const entry = pending.get(event.data.id);
    if (!entry) return;
    pending.delete(event.data.id);
    if ('analysis' in event.data) entry.resolve(event.data.analysis);
    else entry.reject(event.data.unsupportedFile ? new UnsupportedFileError() : new Error(event.data.error));
  };
  return worker;
}

function post(source: JobSource, detection: DetectionSettings): Promise<AudioAnalysis> {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ id, source, detection } satisfies AnalysisRequest, {
      transfer: source.kind === 'pcm' ? source.channels.map((c) => c.buffer) : [],
    });
  });
}

/**
 * Size-estimate analysis of one file, with the decode and auto-trim off the
 * main thread: WAV/AIFF are read and decoded in the analysis worker; other
 * formats need decodeAudioData (main thread only) and their PCM is then
 * transferred — copied first when it's the editor's cached decode, which a
 * transfer would detach.
 */
export async function analyseEntry(file: FileEntry, detection: DetectionSettings): Promise<AudioAnalysis> {
  if (PCM_FILE_EXTENSIONS.has(extensionOf(file.name))) {
    try {
      return await post({ kind: 'file', file: file.file }, detection);
    } catch (err) {
      if (!(err instanceof UnsupportedFileError)) throw err;
    }
  }
  const cached = await peekDecoded(file.id);
  const audio = cached ? { ...cached, channels: cached.channels.map((c) => c.slice()) } : await decodeEntry(file);
  return post({ kind: 'pcm', ...audio }, detection);
}
