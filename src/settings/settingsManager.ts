import type { ProcessingSettings } from '../app/types';
import { FULL_MP3_BITRATE } from '../audio/formats';
import { speedToSemitones } from '../audio/speedResample';
import { DEFAULT_SETTINGS, SETTINGS_RANGES } from './defaults';

// Keys keep the app's old "KO Trimmer" name so saved settings survive the rename.
const SETTINGS_KEY = 'koTrimmer.settings';
const SHOW_WELCOME_KEY = 'koTrimmer.showWelcomeOnStartup';
// The welcome screen used to default to showing every time, saving 'true' on any dismissal, so a
// stored 'true' there isn't an opt-in — any value under it just means the screen was already seen.
const LEGACY_SHOW_WELCOME_KEY = 'koTrimmer.showWelcome';

/** Persists processing settings in localStorage. */
export function loadSettings(): ProcessingSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const stored = JSON.parse(raw);
    return migrateLegacySpeed(migrateLegacyBitrate({ ...DEFAULT_SETTINGS, ...stored }, stored), stored);
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

function readShowWelcome(): string | null {
  try {
    const raw = localStorage.getItem(SHOW_WELCOME_KEY);
    if (raw !== null) return raw;
    return localStorage.getItem(LEGACY_SHOW_WELCOME_KEY) === null ? null : 'false';
  } catch {
    return null;
  }
}

/** Whether to show the welcome screen on startup: on first run, then only if the user opted in. */
export function loadShowWelcome(): boolean {
  const raw = readShowWelcome();
  return raw === null || raw === 'true';
}

/** Whether the user explicitly asked for the welcome screen on every startup (off by default). */
export function loadWelcomeOptIn(): boolean {
  return readShowWelcome() === 'true';
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
];
/** Implied by any legacy bitrate below the table. */
const LEGACY_LOWEST_RATE = 11025;

/**
 * Settings saved before WAV sample rate was split out of "bitrate" carried
 * the rate implicitly in bitrateKbps; carry that choice over once.
 */
export function migrateLegacyBitrate(
  settings: ProcessingSettings,
  stored: Record<string, unknown>,
): ProcessingSettings {
  if ('wavSampleRateHz' in stored || settings.bitrateKbps >= FULL_MP3_BITRATE) return settings;
  const legacyRate =
    LEGACY_RATE_BY_MIN_KBPS.find(([minKbps]) => settings.bitrateKbps >= minKbps)?.[1] ?? LEGACY_LOWEST_RATE;
  return { ...settings, wavSampleRateHz: legacyRate };
}

/** Speed-up used to be saved as a multiplier; carry it over as the nearest semitone shift once. */
export function migrateLegacySpeed(settings: ProcessingSettings, stored: Record<string, unknown>): ProcessingSettings {
  const { speedMultiplier, ...rest } = settings as ProcessingSettings & { speedMultiplier?: unknown };
  if ('speedSemitones' in stored || typeof speedMultiplier !== 'number') return rest;
  const semitones = Math.min(SETTINGS_RANGES.speedSemitones.max, speedToSemitones(speedMultiplier));
  return { ...rest, speedSemitones: semitones };
}
