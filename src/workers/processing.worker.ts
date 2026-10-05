import { runPipeline } from '../audio/pipeline';
import { errorMessage, postFromWorker, type WorkerInMessage, type WorkerOutMessage } from './protocol';

const cancelledJobIds = new Set<string>();

self.onmessage = async (event: MessageEvent<WorkerInMessage>) => {
  const msg = event.data;

  if (msg.type === 'cancel') {
    cancelledJobIds.add(msg.jobId);
    return;
  }

  const { type: _type, jobId, fileId, ...request } = msg;
  try {
    const result = await runPipeline({
      ...request,
      isCancelled: () => cancelledJobIds.has(jobId),
      onStage: (stage) => postFromWorker<WorkerOutMessage>({ type: 'progress', jobId, fileId, stage }),
    });
    postFromWorker<WorkerOutMessage>({ type: 'done', jobId, fileId, ...result }, [result.bytes.buffer]);
  } catch (err) {
    postFromWorker<WorkerOutMessage>({ type: 'error', jobId, fileId, message: errorMessage(err) });
  } finally {
    cancelledJobIds.delete(jobId);
  }
};
