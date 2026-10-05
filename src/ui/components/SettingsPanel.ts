import { h } from '../dom';
import { appState } from '../../app/state';
import { BITRATE_OPTIONS, SETTINGS_RANGES, WAV_SAMPLE_RATE_OPTIONS } from '../../audio/settingsDefaults';
import { canOverwrite } from '../../fs/overwriteWriter';

export class SettingsPanel {
  element: HTMLElement;
  private overwriteRow: HTMLElement;

  constructor() {
    this.element = h('div', { class: 'panel' });
    this.overwriteRow = renderOverwriteRow();
    this.render();
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
      field('Silence Threshold', sliderInput('threshold', s.thresholdDb, SETTINGS_RANGES.thresholdDb, (v) => `${v} dB`, (v) =>
        appState.updateSettings({ thresholdDb: v }),
      )),
      field('Min Silence Duration (ms)', numberInput('minDuration', s.minDurationMs, SETTINGS_RANGES.minDurationMs, (v) =>
        appState.updateSettings({ minDurationMs: v }),
      )),
      field('Padding (ms)', numberInput('padding', s.paddingMs, SETTINGS_RANGES.paddingMs, (v) =>
        appState.updateSettings({ paddingMs: v }),
      )),
      field(
        'Speed-up (tape-style — raises pitch)',
        sliderInput('speed', s.speedMultiplier, SETTINGS_RANGES.speedMultiplier, (v) => `${v.toFixed(2)}x`, (v) =>
          appState.updateSettings({ speedMultiplier: v }),
        ),
      ),
      field(
        'WAV Sample Rate',
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
      checkboxRow(
        'Preserve Stereo',
        s.preserveStereo,
        'Unchecked converts to mono.',
        (checked) => appState.updateSettings({ preserveStereo: checked }),
      ),
      checkboxRow(
        'Preserve Bit Depth',
        s.preserveBitDepth,
        'Unchecked writes 16-bit WAV (smallest), except files that would clip, which stay 32-bit float. Checked keeps the source format, e.g. 32-bit float — check your device supports it.',
        (checked) => appState.updateSettings({ preserveBitDepth: checked }),
      ),
      this.overwriteRow,
    ]);

    this.element.replaceChildren(h('h3', {}, ['Settings']), el, checkboxes);
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
  }) as HTMLInputElement;
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
  }) as HTMLInputElement;
  const readout = h('span', { class: 'readout' }, [format(value)]);
  input.addEventListener('input', () => {
    const v = Number(input.value);
    readout.textContent = format(v);
    onChange(v);
  });
  return h('div', { class: 'slider-row' }, [input, readout]);
}

function bitrateSelect(value: number, onChange: (v: (typeof BITRATE_OPTIONS)[number]) => void): HTMLElement {
  const select = h(
    'select',
    {},
    BITRATE_OPTIONS.map((kbps) =>
      h('option', { value: String(kbps), selected: kbps === value }, [`${kbps} kbps`]),
    ),
  ) as HTMLSelectElement;
  select.addEventListener('change', () => onChange(Number(select.value) as (typeof BITRATE_OPTIONS)[number]));
  return select;
}

function sampleRateSelect(value: number | null, onChange: (v: number | null) => void): HTMLElement {
  const select = h('select', {}, [
    h('option', { value: '', selected: value === null }, ['Original']),
    ...WAV_SAMPLE_RATE_OPTIONS.map((hz) =>
      h('option', { value: String(hz), selected: hz === value }, [`${hz / 1000} kHz`]),
    ),
  ]) as HTMLSelectElement;
  select.addEventListener('change', () => onChange(select.value === '' ? null : Number(select.value)));
  return select;
}

function checkboxRow(
  labelText: string,
  checked: boolean,
  helpText: string,
  onChange: (checked: boolean) => void,
): HTMLElement {
  const checkbox = h('input', { type: 'checkbox', checked }) as HTMLInputElement;
  checkbox.addEventListener('change', () => onChange(checkbox.checked));
  return h('div', { class: 'checkbox-row' }, [checkbox, h('label', {}, [labelText]), h('small', {}, [helpText])]);
}

function renderOverwriteRow(): HTMLElement {
  const anyOverwritable = appState.files.some(canOverwrite);
  const checkbox = h('input', {
    type: 'checkbox',
    checked: appState.settings.overwrite,
    disabled: !anyOverwritable,
  }) as HTMLInputElement;
  checkbox.addEventListener('change', () => appState.updateSettings({ overwrite: checkbox.checked }));

  const helpText = anyOverwritable
    ? 'Replaces WAV/MP3 sources in place. Other formats are re-encoded as WAV, so they are written as new files.'
    : 'Requires WAV or MP3 files added via a folder picker or drag-drop, not individual file picking.';

  const row = h('div', { class: 'checkbox-row' }, [checkbox, h('label', {}, ['Overwrite original']), h('small', {}, [helpText])]);
  if (!anyOverwritable) row.setAttribute('title', helpText);
  return row;
}
