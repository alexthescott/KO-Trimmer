import { errorMessage } from '../app/errors';
import { SyncZipWriter } from '../fs/opfsZip';
import { postFromWorker, type ZipWriterRequest, type ZipWriterResponse } from './protocol';

let writer: SyncZipWriter | undefined;
/** Requests run strictly in order: an add must not race the open before it, or end the adds before it. */
let chain = Promise.resolve();

self.onmessage = (event: MessageEvent<ZipWriterRequest>) => {
  const msg = event.data;
  chain = chain.then(() => handle(msg));
};

async function handle(msg: ZipWriterRequest): Promise<void> {
  try {
    if (msg.type === 'open') {
      writer = await SyncZipWriter.open(await navigator.storage.getDirectory());
      postFromWorker<ZipWriterResponse>({ id: msg.id, fileName: writer.fileName });
    } else if (msg.type === 'add') {
      await writer!.add(msg.path, msg.bytes);
      postFromWorker<ZipWriterResponse>({ id: msg.id });
    } else {
      await writer?.end();
      postFromWorker<ZipWriterResponse>({ id: msg.id, fileName: writer?.fileName });
    }
  } catch (err) {
    postFromWorker<ZipWriterResponse>({ id: msg.id, error: errorMessage(err) });
  }
}
