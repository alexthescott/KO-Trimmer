import type { PcmAudio } from '../audio/channels';
import { decodePcmFile } from '../audio/pcmFileDecoder';
import { UnsupportedFileError, type JobSource } from './protocol';

/** Worker-side: a job's PCM, decoding a `file` source here (throws UnsupportedFileError if it can't). */
export async function resolveSource(source: JobSource): Promise<PcmAudio> {
  if (source.kind === 'pcm') return source;
  const decoded = decodePcmFile(new Uint8Array(await source.file.arrayBuffer()));
  if (!decoded) throw new UnsupportedFileError();
  return decoded;
}
