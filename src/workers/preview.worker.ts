import { errorMessage } from '../app/errors';
import { renderPreviewJob } from '../audio/previewJob';
import { postFromWorker, type PreviewRequest, type PreviewResponse } from './protocol';

/** Renders the editor's processed preview off the main thread (resampling and MP3 encode are heavy). */
self.onmessage = async (event: MessageEvent<PreviewRequest>) => {
  const { id, input } = event.data;
  try {
    const result = await renderPreviewJob(input);
    const transfer = result.kind === 'mp3' ? [result.bytes.buffer] : result.audio.channels.map((c) => c.buffer);
    postFromWorker<PreviewResponse>({ id, result }, transfer);
  } catch (err) {
    postFromWorker<PreviewResponse>({ id, error: errorMessage(err) });
  }
};
