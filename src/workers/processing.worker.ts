import { runPipeline } from '../audio/pipeline';
import { decodeWav } from '../audio/wavDecoder';
import type { PcmAudio } from '../audio/channels';
import type { ProcessingStage } from '../app/types';
import { errorMessage } from '../app/errors';
import {
  postFromWorker,
  UnsupportedWavError,
  type JobSource,
  type WorkerInMessage,
  type WorkerOutMessage,
} from './protocol';

const cancelledJobIds = new Set<string>();

self.onmessage = async (event: MessageEvent<WorkerInMessage>) => {
  const msg = event.data;

  if (msg.type === 'cancel') {
    cancelledJobIds.add(msg.jobId);
    return;
  }

  const { type: _type, jobId, fileId, source, ...request } = msg;
  const onStage = (stage: ProcessingStage) =>
    postFromWorker<WorkerOutMessage>({ type: 'progress', jobId, fileId, stage });
  try {
    if (source.kind === 'wav') onStage('decode');
    const audio = await resolveSource(source);
    const result = await runPipeline({
      ...request,
      ...audio,
      isCancelled: () => cancelledJobIds.has(jobId),
      onStage,
    });
    postFromWorker<WorkerOutMessage>({ type: 'done', jobId, fileId, ...result }, [result.bytes.buffer]);
  } catch (err) {
    postFromWorker<WorkerOutMessage>({
      type: 'error',
      jobId,
      fileId,
      message: errorMessage(err),
      unsupportedWav: err instanceof UnsupportedWavError,
    });
  } finally {
    cancelledJobIds.delete(jobId);
  }
};

async function resolveSource(source: JobSource): Promise<PcmAudio> {
  if (source.kind === 'pcm') return source;
  const decoded = decodeWav(new Uint8Array(await source.file.arrayBuffer()));
  if (!decoded) throw new UnsupportedWavError();
  return decoded;
}
