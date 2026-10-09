// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { SettingsPanel } from '../../src/ui/components/SettingsPanel';
import { appState } from '../../src/app/state';
import { DEFAULT_SETTINGS } from '../../src/settings/defaults';

describe('SettingsPanel preset select', () => {
  it('applies a preset and tracks whether later edits still match one', () => {
    appState.updateSettings(DEFAULT_SETTINGS);
    const panel = new SettingsPanel();
    const select = () => panel.element.querySelector<HTMLSelectElement>('#preset')!;
    expect(select().value).toBe('standard');

    select().value = 'tiny';
    select().dispatchEvent(new Event('change'));
    expect(appState.settings).toMatchObject({ preserveStereo: false, wavSampleRateHz: 11025, bitrateKbps: 64 });
    expect(select().value).toBe('tiny');

    appState.updateSettings({ wavSampleRateHz: 8000 });
    expect(select().value).toBe(''); // Custom
    appState.updateSettings({ wavSampleRateHz: 11025 });
    expect(select().value).toBe('tiny');
    panel.destroy();
  });
});
