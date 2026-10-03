# KO Trimmer

Batch audio silence-trimmer for beatmakers with limited sample storage on hardware
devices (Teenage Engineering OP-1/OP-Z/EP series, Pocket Operators, MPC). Detects and
trims silence from the start/end of samples, with optional mono downmix, bitrate/
sample-rate reduction, and tape-style speed-up — all aimed at shrinking sample size to
fit tight device memory limits.

## Status: web-first

**`web/` is the primary, actively-developed app.** It's a Progressive Web App —
installable from Chrome, works offline, and does all audio decode/trim/resample/encode
and all file reading/writing locally in the browser. No server, no install, no FFmpeg
dependency.

**`src/` (the original PyQt6 desktop app) is legacy.** It still works and its source is
the reference implementation the web app was ported from, but it is not where new
feature work happens. See "Legacy desktop app" below before touching it.

## Web app (`web/`)

Vanilla TypeScript + Vite, no UI framework runtime. Lives entirely under `web/` —
self-contained `package.json`, own `node_modules`, own `.gitignore`.

```bash
cd web
npm install
npm run dev        # local dev server
npm test           # unit tests (Vitest) — run before any audio/DSP change
npm run build      # tsc --noEmit && vite build -> web/dist
npm run preview    # serve the production build locally
npm run icons      # regenerate PWA icons from ../src/ui/images/Knockout.svg
```

Deploys automatically: pushing changes under `web/` to `main` triggers
`.github/workflows/deploy-pwa.yml`, which runs `npm test` + `npm run build` and deploys
`web/dist` to GitHub Pages. One-time repo setting required: Settings → Pages → source =
"GitHub Actions". Production base path is `/KO-Trimmer/` (`web/vite.config.ts`),
matching this repo's Pages project-page URL.

### Architecture

```
web/src/
  app/        state.ts (single source of truth for files/settings/favorites),
              events.ts (typed pub/sub), processBatch.ts (orchestrates a batch run),
              decodedCache.ts (3-entry LRU of decoded audio for the editor),
              batchEstimate.ts (sampled whole-batch size estimate), fileEntries.ts, types.ts
  audio/      pure DSP: energyEnvelope, silenceDetector, trim, mono, speedResample,
              sampleRateResample, wavEncoder, mp3Encoder, naming, estimate.ts
              (output-size prediction), pipeline.ts (orchestrates the fixed stage
              order below; also exports computeAutoTrimBounds + renderPreview, the
              shared code paths the editor and estimator use), player.ts (preview
              playback, main thread only)
  fs/         File System Access API: capabilities, directoryPicker, dragDropEntries,
              favoritesStore (IndexedDB via idb-keyval), outputWriter (FS Access sink +
              ZIP/fflate fallback sink), overwriteWriter (true in-place overwrite)
  workers/    processing.worker.ts (runs pipeline.ts off-thread) + workerPool.ts
              (pooled, AbortController-based cancellation)
  ui/         views/ (Welcome, Main, Processing) + components/ (DropZone, FileTable,
              WaveformEditor, SettingsPanel, FavoritesSidebar, ResultsSummary)
  settings/   settingsManager.ts — localStorage, mirrors desktop's old QSettings defaults
  pwa/        registerSW.ts (vite-plugin-pwa)
web/tests/unit/   Vitest specs for every pure audio/ module — run these first when
                  touching DSP logic; they encode the exact algorithms below.
```

**Processing pipeline (fixed order, `audio/pipeline.ts`):**
decode (main thread, `AudioContext.decodeAudioData`) → trim → mono/stereo → speed-up →
sample-rate/bitrate reduction → encode (worker thread). Decode is isolated per-file
(try/catch) so one bad file never aborts the batch.

**Output container:** always `.wav` or `.mp3`, matching input when the input is mp3,
else `.wav` — there's no browser encoder for flac/aiff/m4a/ogg, so anything else decodes
fine but re-encodes as lossless WAV.

**File-system capability tiers** (`fs/capabilities.ts`): **Full** (Chrome, File System
Access API) — true overwrite, directory-handle output writing, persisted favorites.
**Degraded** (other browsers) — `<input webkitdirectory>` + ZIP download, overwrite
checkbox disabled with an explanatory tooltip rather than silently no-opping.

**Default output location:** the File System Access API gives a directory handle no way
to reach its own parent, so a true sibling `<root>_trimmed/` folder (like desktop made)
isn't reachable. Default is a `<root>_trimmed` subfolder created *inside* the picked
root instead (`fs/directoryPicker.ts: resolveDefaultOutputRoot`); an explicit "Choose
output folder…" button lets the user pick a true sibling manually. The recursive folder
walk skips any directory named `*_trimmed` to avoid reprocessing its own output.

### Deliberate behavior changes vs. the desktop app

These were explicit decisions, not oversights — see `git log` on the initial PWA
commit(s) for the full plan this was built from:

1. **Trim both leading AND trailing silence.** Desktop's `processor.py::_trim_audio`
   only ever trimmed trailing silence from the first detected silence block onward —
   leading silence was never touched. `web/src/audio/trim.ts::computeTrimBounds` fixes
   this: it anchors leading trim to a region starting at sample 0, trailing trim to a
   region ending at the last sample, and leaves every internal region untouched.
2. **"Overwrite" actually overwrites.** Desktop's Overwrite checkbox
   (`processor.py::is_already_processed`) only ever forced reprocessing of
   already-processed outputs — it never touched the original source file, despite the
   label. `web/src/fs/overwriteWriter.ts` writes directly back to the source file's
   `FileSystemFileHandle` when enabled and the source supports it (disabled with a
   tooltip otherwise).
3. **KO-II >20s check uses final processed duration**, not the original input duration.
   Desktop checked the untrimmed input file's length; the web port checks the duration
   *after* trim + speed-up, since that's what actually ends up on the hardware
   (`audio/pipeline.ts` → `audio/naming.ts`).
4. **New feature, not in desktop at all: speed-up.** A simple tape-style
   resample (`audio/speedResample.ts`, 1.0x–3.0x, default off) that shortens duration
   and raises pitch, as an additional size-reduction lever alongside bitrate/sample-rate
   reduction. At ≥1.5x it averages `round(speed)` centred taps per output sample (box
   anti-alias, as in the JUCE port's average-then-decimate, but linear-phase).
5. **MP3 bitrate encoding is pure-JS** (`@breezystack/lamejs`, runs in the worker)
   instead of shelling out to a system FFmpeg binary — this is what makes the whole app
   installable with zero native dependencies.

### Features ported from the JUCE "KOTrimmer" rewrite

A native JUCE/C++ rewrite targeting the KO II existed outside this repo; its UX was
folded into the web app rather than maintained separately:

- **Waveform editor** (`ui/components/WaveformEditor.ts`): before/after canvases,
  draggable green/red trim handles, wheel zoom around cursor, shift/horizontal-wheel
  pan, double-click a handle to revert to auto, double-click the waveform to reset zoom.
- **Per-file manual trim overrides**: `FileEntry.manualTrim` (source samples, end
  exclusive) is passed through the worker to `runPipeline`, which uses it in place of
  auto-detection. Settings changes only move handles on files without an override.
- **Live preview playback before processing** (`audio/player.ts`), with playhead;
  Space plays/stops, Delete/Backspace removes the selected file (with confirm).
- **Size estimates**: per-file in the editor, whole-batch next to Process (decodes up to
  20 files, extrapolates by bytes for the rest).
- **Overwrite confirmation** dialog before any in-place overwrite.
- **KO II visual theme** (cream `#F5F0E8` / orange `#FF6B2B`, flat hairline chrome,
  uppercase labels, monospace readouts) — tokens in `ui/styles/app.css` `:root`.

The JUCE app's detector (first/last sample above a peak threshold) was deliberately
*not* ported — the web energy-envelope detector is kept.

### Settings defaults

Canonical source: `web/src/audio/settingsDefaults.ts`. These intentionally mirror the
desktop app's actual shipped widget defaults (`src/ui/main_window.py`), **not**
`settings_manager.py`'s own default dict (`threshold: -40`), which was dead/unused in
practice — the real default users saw was -50 dB.

| Setting | Range | Default |
|---|---|---|
| Silence threshold | -60 to 0 dB | -50 dB |
| Min silence duration | 100–10000 ms | 1000 ms |
| Padding | 0–1000 ms | 20 ms |
| Speed-up | 1.0x–3.0x | 1.0x (off) |
| Bitrate | 320/192/160/128/96/64 kbps | 320 (no reduction) |
| Preserve stereo | — | on |
| Overwrite | — | off |

## Legacy desktop app (`src/`)

PyQt6 app, still functional, kept as reference and for anyone not on Chrome/a modern
browser. Build tooling (`build_app.py`, `package_app.py`, `KO Trimmer.spec`) is
no longer the primary distribution path — the web app replaced the need for a packaged
desktop binary. Don't invest further in desktop packaging/build scripts; if you're
fixing a bug here, check whether it's a bug the web port already fixed (see list above)
before porting the old behavior back.

The desktop app's naming is inconsistent across files (old "TrimVibe" name lingers in
`build_app.py`, `package_app.py`, `README.md`, `.gitignore`; only `KO Trimmer.spec` and
the app bundle identifier `com.kotrimmer.app` use the current name) — this is known,
pre-existing, and not worth cleaning up given the app is legacy.

## Working in this repo

- Changes under `web/**` trigger the Pages deploy workflow on push to `main` — be
  deliberate about what lands on `main` vs. a branch.
- When touching any `web/src/audio/*` module, run `npm test` in `web/` first — the unit
  suite encodes the exact algorithms (including the three behavior fixes above) and is
  fast (<1s).
- `web/src/fs/`, service worker behavior, and actual playback are **not** covered by the
  unit suite (they need a real browser / File System Access API). No browser automation
  tool has been available in this environment to date — manual Chrome QA is still owed
  before trusting changes there blind. Checklist: install flow, offline reload,
  drag-drop folder recursion, large-batch Stop behavior, preview playback, waveform
  editor handles/zoom and manual-trim reaching batch output, output
  byte-correctness (`ffprobe` for actual sample rate / MP3 bitrate), overwrite
  correctness, ZIP fallback, favorites permission persistence across a relaunch.
