import type { FileEntry, ProcessingSettings, SampleRange } from '../../../app/types';
import { formatBytes, formatDuration, formatSizeChange } from '../../format';
import { estimateOutputBytes } from '../../../audio/estimate';
import { resolveWavSampleRate } from '../../../audio/sampleRateResample';
import { formatLabel, sameFormat } from '../../../audio/sampleFormat';
import { chooseOutputFormat, type OutputContainer, type OutputFormat } from '../../../audio/outputContainer';

export interface ReadoutInput {
  file: FileEntry;
  container: OutputContainer;
  sampleRate: number;
  channelCount: number;
  totalFrames: number;
  trim: SampleRange;
  isManual: boolean;
  /** Auto-detection's "not trimmed" warning, if any. */
  autoWarning?: string;
  /** Peak of the rendered preview, once there is one. */
  processedPeak?: number;
  settings: ProcessingSettings;
}

/** "AUTO · START 0.12s · END 3.40s · LENGTH 3.28s of 4.00s · <warnings>". */
export function trimInfoText(input: ReadoutInput): string {
  const { trim, sampleRate: sr } = input;
  const { clipNote } = outputFormatFor(input);
  const warnings = [input.isManual ? undefined : input.autoWarning, clipNote].filter(Boolean).map((w) => ` · ${w}`);
  return (
    `${input.isManual ? 'MANUAL' : 'AUTO'} · START ${formatDuration(trim.start / sr)} · END ${formatDuration(trim.end / sr)} · ` +
    `LENGTH ${formatDuration((trim.end - trim.start) / sr)} of ${formatDuration(input.totalFrames / sr)}${warnings.join('')}`
  );
}

/** "1.2 MB → ~400 KB (−67%) · 32-bit float → 16-bit · 48 → 22.05 kHz". */
export function sizeSummaryText(input: ReadoutInput): string {
  const { file, settings, sampleRate: sr } = input;
  const estimate = estimateOutputBytes({
    trimmedFrames: input.trim.end - input.trim.start,
    sourceChannels: input.channelCount,
    sourceSampleRate: sr,
    extension: input.container,
    sourceFormat: file.sourceFormat,
    peak: input.processedPeak,
    settings,
  });
  return (
    `${formatBytes(file.size)} → ~${formatBytes(estimate)} (${formatSizeChange(file.size, estimate)})` +
    bitDepthNote(input) +
    sampleRateNote(input) +
    (input.container === 'mp3' ? ` · ${settings.bitrateKbps} kbps MP3` : '')
  );
}

/** Output format given the rendered preview's peak, once known. */
function outputFormatFor({ file, container, settings, processedPeak }: ReadoutInput): OutputFormat {
  return chooseOutputFormat(container, file.sourceFormat, settings.preserveBitDepth, processedPeak);
}

function bitDepthNote(input: ReadoutInput): string {
  const source = input.file.sourceFormat;
  const { format: output, clipNote } = outputFormatFor(input);
  if (clipNote) {
    return source?.float
      ? ` · ${formatLabel(source)} (kept to avoid clipping)`
      : ` · ${source ? `${formatLabel(source)} → ` : ''}32-bit float (avoids clipping)`;
  }
  if (!source || !output) return '';
  const { settings } = input;
  if (!sameFormat(source, output)) return ` · ${formatLabel(source)} → ${formatLabel(output)}`;
  return ` · ${formatLabel(source)}${settings.preserveBitDepth ? ' (kept)' : ''}`;
}

function sampleRateNote({ container, sampleRate, settings }: ReadoutInput): string {
  if (container !== 'wav') return '';
  const target = resolveWavSampleRate(sampleRate, settings.wavSampleRateHz);
  return target === undefined ? '' : ` · ${sampleRate / 1000} → ${target / 1000} kHz`;
}
