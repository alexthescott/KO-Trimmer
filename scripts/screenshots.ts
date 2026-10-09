/**
 * Regenerates the README screenshots in docs/screenshots/ from the production
 * build (run via `npm run screenshots`, which builds first). Drives Chromium
 * through a small synthetic "Drums" kit, with showDirectoryPicker stubbed to
 * an OPFS folder so the shots show real folder output.
 */
import { chromium, type Page } from '@playwright/test';
import { preview } from 'vite';
import { encodeWav } from '../src/audio/wavEncoder';

const SAMPLE_RATE = 44100;
const OUT_DIR = 'docs/screenshots';

let seed = 1;
const noise = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;

/** `before` s of silence, then `length` s of `sample(t)`, then `after` s of silence. */
function padded(before: number, length: number, after: number, sample: (t: number) => number): Float32Array {
  const out = new Float32Array(Math.round((before + length + after) * SAMPLE_RATE));
  const start = Math.round(before * SAMPLE_RATE);
  for (let i = 0; i < length * SAMPLE_RATE; i++) out[start + i] = sample(i / SAMPLE_RATE);
  return out;
}

function kit(): Array<{ path: string; bytes: Uint8Array }> {
  const chord = [261.63, 329.63, 392.0, 493.88]; // Cmaj7
  const pad = (detune: number) =>
    padded(1.25, 2.45, 2.2, (t) => {
      const swell = Math.sin((Math.PI * t) / 2.45) ** 1.5;
      const tone = chord.reduce((sum, hz) => sum + Math.sin(2 * Math.PI * hz * detune * t), 0) / chord.length;
      return 0.6 * swell * (tone + 0.15 * noise());
    });
  let kickPhase = 0;
  const kick = padded(0.3, 1.4, 1.5, (t) => {
    kickPhase += (2 * Math.PI * (50 + 100 * Math.exp(-t * 25))) / SAMPLE_RATE;
    return 0.9 * Math.exp(-t * 3) * Math.sin(kickPhase);
  });
  const snare = padded(
    0.2,
    0.4,
    1.5,
    (t) => Math.exp(-t * 14) * (0.6 * noise() + 0.4 * Math.sin(2 * Math.PI * 185 * t)),
  );
  let last = 0;
  const hat = padded(0.15, 0.25, 1.5, (t) => {
    const n = noise();
    const high = n - last; // crude high-pass
    last = n;
    return 0.5 * Math.exp(-t * 30) * high;
  });
  return [
    { path: 'Drums/pad_Cmaj7.wav', bytes: encodeWav([pad(1), pad(1.003)], SAMPLE_RATE) },
    { path: 'Drums/Kit/kick_808.wav', bytes: encodeWav([kick], SAMPLE_RATE) },
    { path: 'Drums/Kit/snare_tight.wav', bytes: encodeWav([snare], SAMPLE_RATE) },
    { path: 'Drums/Kit/hat_closed.wav', bytes: encodeWav([hat], SAMPLE_RATE) },
  ];
}

/** Writes the kit into OPFS and makes the folder picker return it. */
async function useOpfsKit(page: Page): Promise<void> {
  const files = kit().map(({ path, bytes }) => ({ path, bytes: Array.from(bytes) }));
  await page.evaluate(async (files) => {
    const root = await navigator.storage.getDirectory();
    await root.removeEntry('Drums', { recursive: true }).catch(() => {});
    for (const { path, bytes } of files) {
      const parts = path.split('/');
      const name = parts.pop()!;
      let dir = root;
      for (const part of parts) dir = await dir.getDirectoryHandle(part, { create: true });
      const writable = await (await dir.getFileHandle(name, { create: true })).createWritable();
      await writable.write(new Uint8Array(bytes));
      await writable.close();
    }
    window.showDirectoryPicker = async () => root.getDirectoryHandle('Drums');
  }, files);
}

async function main(): Promise<void> {
  const server = await preview({ preview: { port: 4175, strictPort: true }, logLevel: 'warn' });
  const url = server.resolvedUrls!.local[0];
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: 1000, height: 1000 },
      deviceScaleFactor: 1.6, // 1600 px wide images
      colorScheme: 'light',
    });
    await page.goto(url);
    await page.getByRole('button', { name: 'Skip for now' }).click();
    await page.addStyleTag({ content: '.about-button { display: none; }' }); // fixed overlay, not part of the shot
    await useOpfsKit(page);

    await page.getByText('Drop audio files or folders here').click();
    await page.locator('.file-table tbody tr', { hasText: 'pad_Cmaj7' }).click();
    await page.locator('.action-row .readout', { hasText: '→ ~' }).waitFor();
    await page.waitForFunction(
      () => !document.querySelector('.action-row .readout')?.textContent?.includes('analysed'),
    );
    await page.waitForTimeout(500); // processed-preview render
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `${OUT_DIR}/main.png` });

    const panel = (await page.locator('.waveform-editor').boundingBox())!;
    const processed = (await page.locator('.wave-processed').boundingBox())!;
    await page.screenshot({
      path: `${OUT_DIR}/editor.png`,
      fullPage: true, // the editor sits below the fold
      clip: { x: panel.x, y: panel.y, width: panel.width, height: processed.y + processed.height + 1 - panel.y },
    });

    // A manual trim on the pad (end handle pulled in from the keyboard), so the results show the tag.
    await page.locator('.wave-original').focus();
    await page.keyboard.press(']');
    for (let i = 0; i < 4; i++) await page.keyboard.press('Shift+ArrowLeft');
    await page.locator('.wave-original').blur();

    await page.getByRole('button', { name: 'Process Files' }).click();
    await page.getByText('Processing complete!').waitFor();
    await page.waitForFunction(() => {
      const fill = document.querySelector<HTMLElement>('.progress-bar-fill')!; // width animates
      return fill.getBoundingClientRect().width >= fill.parentElement!.getBoundingClientRect().width - 2;
    });
    await page.evaluate(() => window.scrollTo(0, 0));
    const results = (await page.locator('.panel').last().boundingBox())!;
    await page.screenshot({
      path: `${OUT_DIR}/results.png`,
      clip: { x: 0, y: 0, width: 1000, height: results.y + results.height + 24 },
    });
  } finally {
    await browser.close();
    await new Promise<void>((resolve) => server.httpServer.close(() => resolve()));
  }
}

await main();
