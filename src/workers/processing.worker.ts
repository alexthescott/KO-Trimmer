import { runPipeline } from '../audio/pipeline';
import type { WorkerInMessage, WorkerOutMessage } from './protocol';

let cancelledJobIds = new Set<string>();

self.onmessage = async (event: MessageEvent<WorkerInMessage | { type: 'cancel'; jobId: string }>) => {
  const msg = event.data;

  if (msg.type === 'cancel') {
    cancelledJobIds.add(msg.jobId);
    return;
  }

  const { jobId, fileId } = msg;
  try {
    const result = await runPipeline({
      channels: msg.channels,
      sampleRate: msg.sampleRate,
      extension: msg.extension,
      baseName: msg.baseName,
      settings: msg.settings,
      originalBytes: msg.originalBytes,
      sourceFormat: msg.sourceFormat,
      manualTrim: msg.manualTrim,
      isCancelled: () => cancelledJobIds.has(jobId),
      onStage: (stage) => {
        const progress: WorkerOutMessage = { type: 'progress', jobId, fileId, stage };
        (self as unknown as Worker).postMessage(progress);
      },
    });

    const done: WorkerOutMessage = {
      type: 'done',
      jobId,
      fileId,
      bytes: result.bytes,
      outputName: result.outputName,
      outputExtension: result.outputExtension,
      stats: result.stats,
      warning: result.warning,
    };
    (self as unknown as Worker).postMessage(done, { transfer: [result.bytes.buffer] });
  } catch (err) {
    const error: WorkerOutMessage = {
      type: 'error',
      jobId,
      fileId,
      message: err instanceof Error ? err.message : String(err),
    };
    (self as unknown as Worker).postMessage(error);
  } finally {
    cancelledJobIds.delete(jobId);
  }
};
