import type { ProcessingSettings } from '../app/types';
import { DEFAULT_SETTINGS, FULL_MP3_BITRATE } from '../audio/settingsDefaults';

// Keys keep the app's old "KO Trimmer" name so saved settings survive the rename.
const SETTINGS_KEY = 'koTrimmer.settings';
const SHOW_WELCOME_KEY = 'koTrimmer.showWelcome';

/** Persists processing settings in localStorage. */
export function loadSettings(): ProcessingSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const stored = JSON.parse(raw);
    return migrateLegacyBitrate({ ...DEFAULT_SETTINGS, ...stored }, stored);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: ProcessingSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Storage unavailable (private mode, quota, etc.) — settings just won't persist.
  }
}

export function loadShowWelcome(): boolean {
  try {
    const raw = localStorage.getItem(SHOW_WELCOME_KEY);
    return raw === null ? true : raw === 'true';
  } catch {
    return true;
  }
}

export function saveShowWelcome(show: boolean): void {
  try {
    localStorage.setItem(SHOW_WELCOME_KEY, String(show));
  } catch {
    // ignore
  }
}

/** The WAV sample rate an old "bitrate" choice implied, highest threshold first. */
const LEGACY_RATE_BY_MIN_KBPS: ReadonlyArray<readonly [minKbps: number, rateHz: number]> = [
  [192, 44100],
  [128, 22050],
  [96, 16000],
  [0, 11025],
];

/**
 * Settings saved before WAV sample rate was split out of "bitrate" carried
 * the rate implicitly in bitrateKbps; carry that choice over once.
 */
export function migrateLegacyBitrate(settings: ProcessingSettings, stored: Record<string, unknown>): ProcessingSettings {
  if ('wavSampleRateHz' in stored || settings.bitrateKbps >= FULL_MP3_BITRATE) return settings;
  const [, legacyRate] = LEGACY_RATE_BY_MIN_KBPS.find(([minKbps]) => settings.bitrateKbps >= minKbps)!;
  return { ...settings, wavSampleRateHz: legacyRate };
}
