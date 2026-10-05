import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const SOURCE_SVG = resolve(import.meta.dirname, '../assets/Knockout.svg');
const OUT_DIR = resolve(import.meta.dirname, '../public/icons');
const BACKGROUND = '#1b1b1b';

/** Renders the logo centered on an exact `size`x`size` canvas, logo occupying `innerRatio` of it. */
async function renderIcon(size: number, innerRatio: number, flatten: boolean): Promise<Buffer> {
  const inner = Math.round(size * innerRatio);
  const pad = size - inner;
  const padStart = Math.floor(pad / 2);
  const padEnd = pad - padStart;

  let pipeline = sharp(SOURCE_SVG)
    .resize(inner, inner, { fit: 'contain' })
    .extend({ top: padStart, bottom: padEnd, left: padStart, right: padEnd, background: BACKGROUND });
  if (flatten) pipeline = pipeline.flatten({ background: BACKGROUND });
  return pipeline.png().toBuffer();
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  for (const size of [192, 512]) {
    const buffer = await renderIcon(size, 0.82, false);
    await sharp(buffer).toFile(resolve(OUT_DIR, `icon-${size}.png`));
  }

  // Maskable icon: logo kept within the ~80% safe-zone circle on a solid background.
  const maskable = await renderIcon(512, 0.6, false);
  await sharp(maskable).toFile(resolve(OUT_DIR, 'icon-512-maskable.png'));

  // Apple touch icon (no transparency).
  const appleTouch = await renderIcon(180, 0.82, true);
  await sharp(appleTouch).toFile(resolve(OUT_DIR, 'apple-touch-icon-180.png'));

  console.log('Generated icons in', OUT_DIR);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
