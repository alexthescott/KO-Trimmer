# Sample Trimmer

Batch silence-trimmer for beatmakers with limited sample storage on hardware devices
(Teenage Engineering OP-1/OP-Z/EP series, Pocket Operators, MPC). Trims silence from the
start and end of every sample in a folder, with optional mono downmix, bitrate/sample-rate
reduction, and tape-style speed-up to squeeze samples into tight device memory.

**Use it at [alexthescott.github.io/KO-Trimmer](https://alexthescott.github.io/KO-Trimmer/)** —
installable from Chrome, works offline, no download or FFmpeg required. All audio
processing and file reading/writing happens locally in your browser.

![Sample Trimmer web app — file list and waveform editor](docs/screenshots/main.png)

## How to use

1. **Add samples.** Drop audio files or a folder onto the app, click to choose a folder, or
   use **Choose files…** (the only option on iPhone/iPad). Every supported sample in it
   (WAV, AIFF, MP3, FLAC, M4A, OGG/Opus — including subfolders) is queued.
2. **Adjust settings.** Pick a size/quality **preset**, or set each control: silence
   threshold, minimum silence duration, padding, fade at cuts, speed-up, WAV/AIFF sample
   rate, MP3 bitrate (MP3 files only), preserve stereo (off = mono downmix), preserve bit
   depth (off = 16-bit), and normalize (peaks to −0.3 dBFS).
3. **Check the trim.** Selecting a file opens the waveform editor: the green and red handles
   show where leading and trailing silence will be cut. Drag them to override the automatic
   trim for that file (double-click a handle to revert to auto), or focus the waveform and
   use `[` `]` and the arrow keys. Press Space to preview, and the editor shows the
   estimated output size.

   ![Waveform editor with trim handles and before/after preview](docs/screenshots/editor.png)

4. **Process.** Click **Process Files** to run the batch. In Chrome, trimmed files are written
   into a `<folder>_trimmed/` subfolder (or use **Choose output folder…** to pick another
   location); in other browsers they download as a ZIP. Enable **Overwrite original** (Chrome/Edge only) to
   replace the original WAV, AIFF and MP3 files in place.

   ![Processing results](docs/screenshots/results.png)

MP3 inputs stay MP3 and AIFF stays AIFF; everything else is written as WAV — 16-bit by default, or the
source's own bit depth (e.g. 32-bit float) with **Preserve bit depth** on. Files longer
than 20 seconds after processing get an underscore (`_`) prefix for KO II compatibility.

## Development

Vanilla TypeScript + Vite, no UI framework.

```bash
npm install
npm run dev        # local dev server
npm test           # unit tests (Vitest)
npm run check      # typecheck + lint + format check + unit tests (what CI runs)
npm run test:e2e   # Playwright end-to-end tests in Chromium, Firefox and WebKit
npm run build      # typecheck + production build to dist/
npm run preview    # serve dist/ locally at the /KO-Trimmer/ base path
npm run icons      # regenerate PWA icons from assets/Knockout.svg
npm run screenshots # regenerate docs/screenshots/ from the production build
```

Unit tests cover the DSP (energy envelope, silence detection, leading+trailing trim,
resampling, WAV/AIFF codecs, naming rules, size estimates) and the orchestration and UI
logic against fakes. The Playwright suite runs the production build in all three browser
engines: folder → ZIP for WAV/AIFF/MP3 with outputs checked, every ZIP fallback, the
estimate and preview workers, and (Chromium) folder output and in-place overwrite.
Run `npm test` before changing anything under `src/audio/`.

### Deploy

Pushing to `main` triggers `.github/workflows/deploy-pwa.yml`, which tests, builds, and
deploys `dist/` to GitHub Pages. One-time setup: Settings → Pages → source = "GitHub
Actions". The production base path is `/KO-Trimmer/` (`vite.config.ts`); change `base` to
`/` if moving to a custom domain.

### Browser support

Full functionality (true in-place overwrite, writing output directly into a folder)
requires the File System Access API (Chrome, Edge). Firefox and Safari get a
degraded-but-functional tier: a folder or file picker and a ZIP download, streamed to
disk (OPFS) so batch size isn't limited by memory. iPhone/iPad can add individual files.
AIFF decodes in every browser (pure-JS decoder); other compressed formats depend on the
browser's own codecs.

## License

MIT
