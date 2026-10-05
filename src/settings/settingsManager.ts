import type { ProcessingSettings } from '../app/types';
import { DEFAULT_SETTINGS } from '../audio/settingsDefaults';

const SETTINGS_KEY = 'koTrimmer.settings';
const SHOW_WELCOME_KEY = 'koTrimmer.showWelcome';

/** Persists processing settings in localStorage. */
export function loadSettings(): ProcessingSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const stored = JSON.parse(raw);
    return migrate({ ...DEFAULT_SETTINGS, ...stored }, stored);
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

/**
 * Settings saved before WAV sample rate was split out of "bitrate" carried
 * the rate implicitly in bitrateKbps; carry that choice over once.
 */
function migrate(settings: ProcessingSettings, stored: Record<string, unknown>): ProcessingSettings {
  if ('wavSampleRateHz' in stored || settings.bitrateKbps >= 320) return settings;
  const legacyRate =
    settings.bitrateKbps >= 192 ? 44100 : settings.bitrateKbps >= 128 ? 22050 : settings.bitrateKbps >= 96 ? 16000 : 11025;
  return { ...settings, wavSampleRateHz: legacyRate };
}
