import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { unzipSync } from 'fflate';
import { decodeWav } from '../../src/audio/wavDecoder';
import { decodeAiff } from '../../src/audio/aiffDecoder';
import { parseSourceInfo } from '../../src/audio/sourceHeader';
import { kitFixtures, writeKit } from './fixtures';

/** Tone length in the fixtures, and the most auto-trim may keep around it (20 ms padding + envelope smoothing). */
const TONE_SEC = 0.5;
const MAX_KEPT_SEC = TONE_SEC + 0.2;

/** Duration of the app's MP3 output, which is CBR at the default 320 kbps (plus encoder padding). */
const mp3OutputSec = (bytes: Uint8Array | number) => ((typeof bytes === 'number' ? bytes : bytes.length) * 8) / 320_000;

/** Fails the test on any uncaught page error (including in workers that surface to the page). */
function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  return errors;
}

async function openApp(page: Page): Promise<void> {
  await page.goto('');
  await page.getByRole('button', { name: 'Skip for now' }).click();
}

/** Adds the kit through the folder input — the path every browser without File System Access uses. */
async function addKit(page: Page, tmpDir: string): Promise<void> {
  await page.locator('input[type=file][webkitdirectory]').setInputFiles(writeKit(tmpDir));
  await expect(page.locator('.file-table tbody tr')).toHaveCount(3);
}

async function processToZip(page: Page): Promise<Record<string, Uint8Array>> {
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Process Files' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('kit_trimmed.zip');
  await expect(page.getByText('Processing complete!')).toBeVisible();
  return unzipSync(new Uint8Array(readFileSync((await file.path())!)));
}

/** The trimmed kit: every format keeps its container (AIFF at its own rate); silence is gone from all. */
function expectTrimmedKit(entries: Record<string, Uint8Array>): void {
  expect(Object.keys(entries).sort()).toEqual([
    'kick_trimmed_stereo.wav',
    'loop_trimmed_stereo.mp3',
    'sub/snare_trimmed_stereo.aif',
  ]);

  const kick = decodeWav(entries['kick_trimmed_stereo.wav'])!;
  expect(kick.sampleRate).toBe(44100);
  expect(kick.channels).toHaveLength(2);
  expect(kick.channels[0].length / 44100).toBeGreaterThan(TONE_SEC);
  expect(kick.channels[0].length / 44100).toBeLessThan(MAX_KEPT_SEC);

  const snare = decodeAiff(entries['sub/snare_trimmed_stereo.aif'])!; // AIFF stays AIFF
  expect(snare.sampleRate).toBe(48000); // native rate kept, not the device's
  expect(snare.channels).toHaveLength(1);
  expect(snare.channels[0].length / 48000).toBeLessThan(MAX_KEPT_SEC);

  // The 128 kbps source is re-encoded at 320 kbps, so judge the trim by duration, not bytes.
  const loop = entries['loop_trimmed_stereo.mp3'];
  expect(parseSourceInfo(loop, 'mp3').sampleRate).toBe(44100);
  expect(mp3OutputSec(loop)).toBeLessThan(MAX_KEPT_SEC + 0.1);
}

test('trims a dropped folder (WAV, AIFF, MP3) into a ZIP download', async ({ page }, testInfo) => {
  const errors = watchErrors(page);
  await openApp(page);
  await addKit(page, testInfo.outputPath('in'));
  expectTrimmedKit(await processToZip(page));
  expect(errors).toEqual([]);
});

test('writes the ZIP from a worker when OPFS has no createWritable (older Safari)', async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    delete (FileSystemFileHandle.prototype as Partial<FileSystemFileHandle>).createWritable;
  });
  const errors = watchErrors(page);
  await openApp(page);
  await addKit(page, testInfo.outputPath('in'));
  expectTrimmedKit(await processToZip(page));
  expect(errors).toEqual([]);
});

test('falls back to an in-memory ZIP without OPFS (Firefox private windows)', async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    Object.defineProperty(StorageManager.prototype, 'getDirectory', { value: undefined });
  });
  const errors = watchErrors(page);
  await openApp(page);
  await addKit(page, testInfo.outputPath('in'));
  expectTrimmedKit(await processToZip(page));
  expect(errors).toEqual([]);
});

test('estimates sizes and renders the editor preview for every format', async ({ page }, testInfo) => {
  const errors = watchErrors(page);
  await openApp(page);
  await addKit(page, testInfo.outputPath('in'));

  await expect(page.locator('.action-row .readout')).toContainText('3 files');
  await expect(page.locator('.action-row .readout')).not.toContainText('analysed');
  await expect(page.locator('.size-cell', { hasText: '~' })).toHaveCount(3);

  for (const name of ['kick.wav', 'snare.aif', 'loop.mp3']) {
    await page.locator('.file-table tbody tr', { hasText: name }).click();
    await expect(page.locator('.wave-body')).toBeVisible();
    await expect(page.getByText('Couldn’t decode')).toHaveCount(0);
    // The processed waveform comes from the preview worker; Play Processed waits for it.
    await page.getByRole('button', { name: 'Play Processed' }).click();
    await expect(page.getByRole('button', { name: 'Stop' })).toBeVisible();
    await page.getByRole('button', { name: 'Stop' }).click();
  }
  expect(errors).toEqual([]);
});

test.describe('File System Access (Chromium)', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'File System Access is Chromium-only');

  /** Puts the kit in OPFS and makes showDirectoryPicker return it, standing in for the native folder picker. */
  async function useOpfsKit(page: Page): Promise<void> {
    const files = kitFixtures().map(({ path, bytes }) => ({ path, bytes: Array.from(bytes) }));
    await page.evaluate(async (files) => {
      const root = await navigator.storage.getDirectory();
      await root.removeEntry('kit', { recursive: true }).catch(() => {});
      for (const { path, bytes } of files) {
        const parts = path.split('/');
        const name = parts.pop()!;
        let dir = root;
        for (const part of parts) dir = await dir.getDirectoryHandle(part, { create: true });
        const writable = await (await dir.getFileHandle(name, { create: true })).createWritable();
        await writable.write(new Uint8Array(bytes));
        await writable.close();
      }
      window.showDirectoryPicker = async () => root.getDirectoryHandle('kit');
    }, files);
  }

  /** File sizes under an OPFS directory path, e.g. "kit/kit_trimmed". */
  function listOpfs(page: Page, path: string): Promise<Record<string, number>> {
    return page.evaluate(async (path) => {
      let dir = await navigator.storage.getDirectory();
      for (const part of path.split('/')) dir = await dir.getDirectoryHandle(part);
      const sizes: Record<string, number> = {};
      const walk = async (d: FileSystemDirectoryHandle, prefix: string) => {
        for await (const [name, handle] of d.entries()) {
          if (handle.kind === 'file') sizes[prefix + name] = (await (handle as FileSystemFileHandle).getFile()).size;
          else await walk(handle as FileSystemDirectoryHandle, `${prefix}${name}/`);
        }
      };
      await walk(dir, '');
      return sizes;
    }, path);
  }

  test('writes outputs into <root>_trimmed inside the picked folder', async ({ page }) => {
    const errors = watchErrors(page);
    await openApp(page);
    await useOpfsKit(page);
    await page.getByText('Drop audio files or folders here').click();
    await expect(page.locator('.file-table tbody tr')).toHaveCount(3);
    await expect(page.getByText('Output: kit_trimmed/')).toBeVisible();

    await page.getByRole('button', { name: 'Process Files' }).click();
    await expect(page.getByText('Processing complete!')).toBeVisible();
    expect(Object.keys(await listOpfs(page, 'kit/kit_trimmed')).sort()).toEqual([
      'kick_trimmed_stereo.wav',
      'loop_trimmed_stereo.mp3',
      'sub/snare_trimmed_stereo.aif',
    ]);
    expect(errors).toEqual([]);
  });

  test('Overwrite replaces WAV, AIFF and MP3 sources in place', async ({ page }) => {
    const errors = watchErrors(page);
    await openApp(page);
    await useOpfsKit(page);
    await page.getByText('Drop audio files or folders here').click();
    await expect(page.locator('.file-table tbody tr')).toHaveCount(3);
    const before = await listOpfs(page, 'kit');

    await page.locator('.checkbox-row', { hasText: 'Overwrite original' }).locator('input').check();
    page.once('dialog', (dialog) => void dialog.accept());
    await page.getByRole('button', { name: 'Process Files' }).click();
    await expect(page.getByText('Processing complete!')).toBeVisible();

    const after = await listOpfs(page, 'kit');
    expect(after['kick.wav']).toBeLessThan(before['kick.wav']);
    expect(after['loop.mp3']).not.toBe(before['loop.mp3']);
    expect(mp3OutputSec(after['loop.mp3'])).toBeLessThan(MAX_KEPT_SEC + 0.1); // the source is 1.5 s
    expect(after['sub/snare.aif']).toBeLessThan(before['sub/snare.aif']);
    expect(Object.keys(after).filter((name) => name.startsWith('kit_trimmed/'))).toEqual([]); // nothing written beside
    expect(errors).toEqual([]);
  });
});
