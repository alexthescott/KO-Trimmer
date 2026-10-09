import { h } from '../dom';
import { appState } from '../../app/state';
import { appEvents } from '../../app/events';
import { BITRATE_OPTIONS, WAV_SAMPLE_RATE_OPTIONS } from '../../audio/formats';
import { SETTINGS_RANGES } from '../../settings/defaults';
import { canOverwrite } from '../../fs/overwriteWriter';
import { isFileSystemAccessSupported } from '../../fs/capabilities';
import type { BitrateKbps } from '../../app/types';
import { NORMALIZE_PEAK_DB } from '../../audio/gain';
import { matchingPreset, PRESETS, type Preset } from '../../settings/presets';

export class SettingsPanel {
  element: HTMLElement;
  private overwriteRow: HTMLElement;
  private presetSelect?: HTMLSelectElement;
  private unsubscribe: () => void;

  constructor() {
    this.element = h('div', { class: 'panel' });
    this.overwriteRow = renderOverwriteRow();
    this.render();
    // Any individual change can make the settings match a preset, or stop matching one.
    this.unsubscribe = appEvents.on('settings-changed', ({ settings }) => {
      if (this.presetSelect) this.presetSelect.value = matchingPreset(settings)?.id ?? '';
    });
  }

  destroy(): void {
    this.unsubscribe();
  }

  /** The file list changed: only the overwrite row depends on it. */
  refresh(): void {
    const row = renderOverwriteRow();
    this.overwriteRow.replaceWith(row);
    this.overwriteRow = row;
  }

  private render(): void {
    const s = appState.settings;

    const el = h('div', { class: 'settings-grid' }, [
      field(
        'Silence Threshold',
        sliderInput(
          'threshold',
          s.thresholdDb,
          SETTINGS_RANGES.thresholdDb,
          (v) => `${v} dB`,
          (v) => appState.updateSettings({ thresholdDb: v }),
        ),
      ),
      field(
        'Min Silence Duration (ms)',
        numberInput('minDuration', s.minDurationMs, SETTINGS_RANGES.minDurationMs, (v) =>
          appState.updateSettings({ minDurationMs: v }),
        ),
      ),
      field(
        'Padding (ms)',
        numberInput('padding', s.paddingMs, SETTINGS_RANGES.paddingMs, (v) =>
          appState.updateSettings({ paddingMs: v }),
        ),
      ),
      field(
        'Speed-up (tape-style — raises pitch)',
        sliderInput(
          'speed',
          s.speedMultiplier,
          SETTINGS_RANGES.speedMultiplier,
          (v) => `${v.toFixed(2)}x`,
          (v) => appState.updateSettings({ speedMultiplier: v }),
        ),
      ),
      field(
        'Fade at Cuts (ms)',
        numberInput('fade', s.fadeMs, SETTINGS_RANGES.fadeMs, (v) => appState.updateSettings({ fadeMs: v })),
        'Short fade wherever audio was trimmed away, so a cut mid-waveform doesn’t click. 0 = off.',
      ),
      field(
        'Sample Rate (WAV/AIFF)',
        sampleRateSelect(s.wavSampleRateHz, (v) => appState.updateSettings({ wavSampleRateHz: v })),
        'Lower = smaller and duller: removes everything above half the rate. Never raises the rate.',
      ),
      field(
        'MP3 Bitrate',
        bitrateSelect(s.bitrateKbps, (v) => appState.updateSettings({ bitrateKbps: v })),
        'MP3 files only (they stay MP3). Lower = smaller, more compression artifacts.',
      ),
    ]);

    const checkboxes = h('div', { class: 'settings-grid', style: 'margin-top:12px' }, [
      checkboxRow('Preserve Stereo', s.preserveStereo, 'Unchecked converts to mono.', (checked) =>
        appState.updateSettings({ preserveStereo: checked }),
      ),
      checkboxRow(
        'Preserve Bit Depth',
        s.preserveBitDepth,
        'Unchecked writes 16-bit WAV/AIFF (smallest), except files that would clip, which stay 32-bit float. Checked keeps the source format, e.g. 32-bit float — check your device supports it.',
        (checked) => appState.updateSettings({ preserveBitDepth: checked }),
      ),
      checkboxRow(
        'Normalize',
        s.normalize,
        `Scales each file so its loudest peak sits at ${NORMALIZE_PEAK_DB} dBFS — louder quiet samples, and float sources that peak over full scale come back down.`,
        (checked) => appState.updateSettings({ normalize: checked }),
      ),
      this.overwriteRow,
    ]);

    this.presetSelect = presetSelect(matchingPreset(s)?.id, (preset) => {
      appState.updateSettings(preset.settings);
      this.render(); // the controls below show the preset's values
    });
    const preset = field(
      'Preset',
      this.presetSelect,
      'Sets channels, bit depth, WAV rate and MP3 bitrate; trim and speed stay as they are.',
    );

    preset.classList.add('preset-field');
    this.element.replaceChildren(h('h3', {}, ['Settings']), preset, el, checkboxes);
  }
}

function field(labelText: string, input: HTMLElement, helpText?: string): HTMLElement {
  return h('div', { class: 'field' }, [
    h('label', {}, [labelText]),
    input,
    helpText ? h('small', { class: 'muted' }, [helpText]) : null,
  ]);
}

function numberInput(
  id: string,
  value: number,
  range: { min: number; max: number; step: number },
  onChange: (value: number) => void,
): HTMLElement {
  const input = h('input', {
    type: 'number',
    id,
    min: range.min,
    max: range.max,
    step: range.step,
    value: String(value),
  });
  input.addEventListener('change', () => {
    const v = Math.min(range.max, Math.max(range.min, Number(input.value)));
    onChange(v);
  });
  return input;
}

/** Range slider with a monospace readout; fires on every input tick so trim handles track it live. */
function sliderInput(
  id: string,
  value: number,
  range: { min: number; max: number; step: number },
  format: (value: number) => string,
  onChange: (value: number) => void,
): HTMLElement {
  const input = h('input', {
    type: 'range',
    id,
    min: range.min,
    max: range.max,
    step: range.step,
    value: String(value),
  });
  const readout = h('span', { class: 'readout' }, [format(value)]);
  input.addEventListener('input', () => {
    const v = Number(input.value);
    readout.textContent = format(v);
    onChange(v);
  });
  return h('div', { class: 'slider-row' }, [input, readout]);
}

function presetSelect(currentId: string | undefined, onChange: (preset: Preset) => void): HTMLSelectElement {
  const select = h('select', { id: 'preset' }, [
    h('option', { value: '', selected: currentId === undefined, disabled: true }, ['Custom']),
    ...PRESETS.map((preset) => h('option', { value: preset.id, selected: preset.id === currentId }, [preset.label])),
  ]);
  select.value = currentId ?? '';
  select.addEventListener('change', () => {
    const preset = PRESETS.find((p) => p.id === select.value);
    if (preset) onChange(preset);
  });
  return select;
}

function bitrateSelect(value: BitrateKbps, onChange: (v: BitrateKbps) => void): HTMLElement {
  const select = h(
    'select',
    {},
    BITRATE_OPTIONS.map((kbps) => h('option', { value: String(kbps), selected: kbps === value }, [`${kbps} kbps`])),
  );
  select.addEventListener('change', () => onChange(Number(select.value) as BitrateKbps));
  return select;
}

function sampleRateSelect(value: number | null, onChange: (v: number | null) => void): HTMLElement {
  const select = h('select', {}, [
    h('option', { value: '', selected: value === null }, ['Original']),
    ...WAV_SAMPLE_RATE_OPTIONS.map((hz) =>
      h('option', { value: String(hz), selected: hz === value }, [`${hz / 1000} kHz`]),
    ),
  ]);
  select.addEventListener('change', () => onChange(select.value === '' ? null : Number(select.value)));
  return select;
}

function checkboxRow(
  labelText: string,
  checked: boolean,
  helpText: string,
  onChange: (checked: boolean) => void,
): HTMLElement {
  const checkbox = h('input', { type: 'checkbox', checked });
  checkbox.addEventListener('change', () => onChange(checkbox.checked));
  return h('div', { class: 'checkbox-row' }, [checkbox, h('label', {}, [labelText]), h('small', {}, [helpText])]);
}

/** Disables a checkbox row, with `reason` as a tooltip so hovering explains why. */
function disableRow(row: HTMLElement, reason: string): HTMLElement {
  row.querySelector('input')!.disabled = true;
  row.title = reason;
  return row;
}

function renderOverwriteRow(): HTMLElement {
  const anyOverwritable = appState.files.some(canOverwrite);
  const helpText = anyOverwritable
    ? 'Replaces WAV, AIFF and MP3 sources in place. Other formats are re-encoded as WAV, so they are written as new files.'
    : isFileSystemAccessSupported()
      ? 'Only WAV, AIFF and MP3 sources can be overwritten; other formats are re-encoded as WAV and written as new files.'
      : 'Not available in this browser, which can’t write to files in place — use Chrome or Edge.';
  const row = checkboxRow('Overwrite original', appState.settings.overwrite, helpText, (checked) =>
    appState.updateSettings({ overwrite: checked }),
  );
  return anyOverwritable ? row : disableRow(row, helpText);
}
