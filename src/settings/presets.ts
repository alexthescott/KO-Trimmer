import type { ProcessingSettings } from '../app/types';

/** The output-format settings a preset sets; trim detection, speed, fades etc. are left as they are. */
export type PresetSettings = Pick<
  ProcessingSettings,
  'preserveStereo' | 'preserveBitDepth' | 'wavSampleRateHz' | 'bitrateKbps'
>;

export interface Preset {
  id: string;
  label: string;
  settings: PresetSettings;
}

/**
 * Size/quality trade-offs, by goal rather than by device: sampler import
 * formats vary by model and firmware, so naming a device would promise more
 * than a fixed setting can. Ordered biggest to smallest output.
 */
export const PRESETS: readonly Preset[] = [
  {
    id: 'full',
    label: 'Full quality (keep bit depth)',
    settings: { preserveStereo: true, preserveBitDepth: true, wavSampleRateHz: null, bitrateKbps: 320 },
  },
  {
    id: 'standard',
    label: 'Standard (16-bit stereo)',
    settings: { preserveStereo: true, preserveBitDepth: false, wavSampleRateHz: null, bitrateKbps: 320 },
  },
  {
    id: 'mono',
    label: 'Mono 16-bit (half the size)',
    settings: { preserveStereo: false, preserveBitDepth: false, wavSampleRateHz: null, bitrateKbps: 192 },
  },
  {
    id: 'lofi',
    label: 'Lo-fi saver (mono, 22 kHz)',
    settings: { preserveStereo: false, preserveBitDepth: false, wavSampleRateHz: 22050, bitrateKbps: 128 },
  },
  {
    id: 'tiny',
    label: 'Tiny (mono, 11 kHz)',
    settings: { preserveStereo: false, preserveBitDepth: false, wavSampleRateHz: 11025, bitrateKbps: 64 },
  },
];

/** The preset the current settings exactly match, if any — otherwise the UI shows "Custom". */
export function matchingPreset(settings: ProcessingSettings): Preset | undefined {
  return PRESETS.find((preset) =>
    (Object.keys(preset.settings) as Array<keyof PresetSettings>).every(
      (key) => settings[key] === preset.settings[key],
    ),
  );
}
