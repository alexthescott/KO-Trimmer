import { analyseAudio } from '../audio/analysis';
import { errorMessage } from '../app/errors';
import { postFromWorker, UnsupportedFileError, type AnalysisRequest, type AnalysisResponse } from './protocol';
import { resolveSource } from './resolveSource';

/** Decodes (WAV/AIFF) and auto-trims one file for the size estimate, off the main thread. */
self.onmessage = async (event: MessageEvent<AnalysisRequest>) => {
  const { id, source, detection } = event.data;
  try {
    const analysis = analyseAudio(await resolveSource(source), detection);
    postFromWorker<AnalysisResponse>({ id, analysis });
  } catch (err) {
    postFromWorker<AnalysisResponse>({
      id,
      error: errorMessage(err),
      unsupportedFile: err instanceof UnsupportedFileError,
    });
  }
};
