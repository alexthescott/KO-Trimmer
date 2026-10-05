import { h } from '../dom';
import { appState } from '../../app/state';
import { BITRATE_OPTIONS, SETTINGS_RANGES } from '../../audio/settingsDefaults';
import { canOverwrite } from '../../fs/overwriteWriter';
import type { FileEntry } from '../../app/types';

export class SettingsPanel {
  element: HTMLElement;

  constructor() {
    this.element = h('div', { class: 'panel' });
    this.render();
  }

  private render(): void {
    const s = appState.settings;
    const anyHandleBacked = appState.files.some((f: FileEntry) => canOverwrite(f.fileHandle));

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
      field('Bitrate (kbps)', bitrateSelect(s.bitrateKbps, (v) => appState.updateSettings({ bitrateKbps: v }))),
    ]);

    const checkboxes = h('div', { class: 'settings-grid', style: 'margin-top:12px' }, [
      checkboxRow(
        'Preserve Stereo',
        s.preserveStereo,
        'Unchecked converts to mono.',
        (checked) => appState.updateSettings({ preserveStereo: checked }),
      ),
      overwriteCheckboxRow(s.overwrite, anyHandleBacked),
    ]);

    this.element.replaceChildren(h('h3', {}, ['Settings']), el, checkboxes);
  }

  refresh(): void {
    this.render();
  }
}

function field(labelText: string, input: HTMLElement): HTMLElement {
  return h('div', { class: 'field' }, [h('label', {}, [labelText]), input]);
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

function overwriteCheckboxRow(checked: boolean, anyHandleBacked: boolean): HTMLElement {
  const checkbox = h('input', {
    type: 'checkbox',
    checked,
    disabled: !anyHandleBacked,
  }) as HTMLInputElement;
  checkbox.addEventListener('change', () => appState.updateSettings({ overwrite: checkbox.checked }));

  const helpText = anyHandleBacked
    ? 'Replaces the original source file in place instead of writing a new file.'
    : 'Requires selecting files via a folder picker or drag-drop, not individual file picking.';

  const row = h('div', { class: 'checkbox-row' }, [checkbox, h('label', {}, ['Overwrite original']), h('small', {}, [helpText])]);
  if (!anyHandleBacked) row.setAttribute('title', helpText);
  return row;
}
