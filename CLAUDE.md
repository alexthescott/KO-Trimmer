# Sample Trimmer

Batch audio silence-trimmer for beatmakers with limited sample storage on hardware
devices (Teenage Engineering OP-1/OP-Z/EP series, Pocket Operators, MPC). Detects and
trims silence from the start/end of samples, with optional mono downmix, bitrate/
sample-rate reduction, and tape-style speed-up — all aimed at shrinking sample size to
fit tight device memory limits.

## Overview

Progressive Web App (formerly "KO Trimmer") — installable from Chrome, works offline,
and does all audio decode/trim/resample/encode and all file reading/writing locally in
the browser. No server, no install, no FFmpeg dependency. Vanilla TypeScript + Vite, no
UI framework runtime; lives at the repo root.

```bash
npm install
npm run dev        # local dev server
npm test           # unit tests (Vitest) — run before any audio/DSP change
npm run check      # typecheck + lint + format check + unit tests (what CI runs)
npm run lint       # ESLint (typescript-eslint, type-aware no-floating-promises)
npm run format     # Prettier
npm run build      # typecheck && vite build -> dist/
npm run preview    # serve the production build locally
npm run icons      # regenerate PWA icons from assets/Knockout.svg
```

Deploys automatically: pushing to `main` triggers `.github/workflows/deploy-pwa.yml`,
which runs typecheck + lint + `npm test` + `npm run build` and deploys `dist/` to GitHub
Pages. PRs and other branches run `.github/workflows/ci.yml` (same checks, no deploy).
`npm run typecheck` also checks `src/workers/*.worker.ts` against the WebWorker lib
alone (`tsconfig.worker.json`), so main-thread-only APIs (Web Audio, DOM) can't creep
into worker code — keep such helpers in modules the workers don't import
(e.g. `audio/audioBuffer.ts`). One-time
repo setting required: Settings → Pages → source = "GitHub Actions". Production base
path is `/KO-Trimmer/` (`vite.config.ts`), matching this repo's Pages project-page URL.

### Architecture

```
src/
  app/        state.ts (single source of truth for files/settings/output
              root), events.ts (typed pub/sub), processBatch.ts (orchestrates a batch
              run: processFile -> outcomePatch -> tally; takes an onFileUpdate callback
              + injectable pool, never touches appState), decodedCache.ts (3-entry LRU
              of decoded audio for the editor; decodeEntry), batchEstimate.ts
              (progressive per-file + whole-batch size estimate; injectable Analyser),
              analysisClient.ts (runs each estimate analysis in analysis.worker.ts),
              estimateScheduler.ts
              (debounces/cancels estimate runs for MainView), fileNames.ts (the one
              name/extension splitter), errors.ts (errorMessage), fileEntries.ts,
              types.ts (incl. SampleRange)
  audio/      pure DSP: energyEnvelope, silenceDetector, trim, mono, speedResample,
              sampleRateResample, wavEncoder, mp3Encoder, naming (filename + KO II
              length rule), channels.ts (PcmAudio type, frameCount/sampleAt/floatToInt),
              audioBuffer.ts (AudioBuffer copies; main thread only), iffChunks.ts (RIFF/AIFF chunk walk + WAV format
              tags, shared by sourceHeader/wav+aiff decoders/wavEncoder),
              outputContainer.ts (the one "mp3 stays mp3, else wav" rule + output
              sample format), formats.ts (MP3 bitrate / WAV rate options),
              sourceHeader.ts (header parsing: bit depth + native
              sample rate), sampleFormat.ts (SampleFormat, output bit-depth policy,
              labels, clip warning), estimate.ts (output-size prediction; reuses
              speedUpFrames/resampledFrames so it can't drift from the pipeline),
              pipeline.ts (renderAudible = trim/mono/speed/resample, shared by
              runPipeline and the editor preview), autoTrim.ts (computeAutoTrimBounds
              — shared by pipeline, editor and estimator; kept apart from pipeline.ts
              so the analysis worker doesn't bundle the MP3 encoder), analysis.ts
              (estimate's per-file numbers), audioContext.ts + player.ts (preview playback, main
              thread only), wavDecoder.ts + aiffDecoder.ts (pure-JS PCM decode;
              pcmFileDecoder.ts sniffs which), decode.ts (main-thread
              decodeAudioData)
  fs/         File System Access API: capabilities, directoryPicker
              (pickWritableDirectory), dragDropEntries (TRIMMED_SUFFIX), permissions
              (ensureReadWrite),
              outputWriter (FS Access sink; OPFS-backed ZIP sink; worker-written
              OPFS ZIP sink; in-memory split-ZIP fallback), opfsZip
              (SyncZipWriter for zipWriter.worker.ts; stale-ZIP cleanup), zipStream (client-zip over asyncQueue, shared
              by both ZIP sinks), asyncQueue (backpressured producer→stream),
              archivePaths (de-duplicated ZIP entry names), writeFile,
              overwriteWriter (true in-place overwrite; canOverwrite)
  workers/    protocol.ts (message types built on PipelineRequest/PipelineOutput),
              processing.worker.ts (runs pipeline.ts off-thread) + workerPool.ts
              (pooled, AbortController-based cancellation), analysis.worker.ts
              (estimate decode + auto-trim), preview.worker.ts (editor preview
              render), zipWriter.worker.ts, resolveSource.ts (worker-side decode
              of a `file` job source)
  ui/         views/ (Welcome, Main, Processing) + components/ (DropZone, FileTable,
              WaveformEditor + waveform/ [Viewport, TrimState (trim rules, no DOM),
              PreviewPlayback, PreviewRenderer, readouts, draw],
              SettingsPanel, ResultsSummary, AboutDialog — fixed
              bottom-left About button + modal); dom.ts (h() element helper),
              format.ts (bytes/percent/plural/duration formatting)
  settings/   defaults.ts (DEFAULT_SETTINGS, SETTINGS_RANGES), settingsManager.ts —
              localStorage persistence
  pwa/        registerSW.ts (vite-plugin-pwa)
tests/unit/       Vitest specs for every pure audio/ module plus the pure logic pulled
                  out of the UI (Viewport, readouts, fileNames, settings migration),
                  plus orchestration/UI-state units (processBatch, BatchEstimator,
                  WorkerPool, EstimateScheduler, TrimState, PreviewPlayback, drop walk,
                  ZipOutputSink) against fakes —
                  run these first when touching DSP logic; they encode the exact
                  algorithms below.
scripts/          generate-icons.ts (renders public/icons/ from assets/Knockout.svg)
```

**Processing pipeline (fixed order, `audio/pipeline.ts`):**
decode → trim → mono/stereo → speed-up → WAV sample-rate reduction → encode at bit
depth / MP3 bitrate (worker thread). WAV and AIFF are decoded in the worker by the
pure-JS `audio/wavDecoder.ts` / `audio/aiffDecoder.ts` (PCM 8–32-bit int / 32–64-bit
float; scaling matches `decodeAudioData`). AIFF (the OP-1's format) must stay pure-JS:
only Safari's `decodeAudioData` reads it, so the editor/estimate decode it that way
too (`decodedCache.ts::decodeEntry`). Other formats, and WAV/AIFF the worker can't
read (ADPCM, ulaw etc. — the worker replies `unsupportedFile` and the file is
retried), decode on the main thread via `decodeAudioData` at the file's native rate
(see below). WAV sample-rate reduction is a pure-JS Kaiser-windowed sinc
(`sampleRateResample.ts`) — `OfflineAudioContext` isn't exposed to workers, and one
filter keeps preview and output identical. Decode is isolated per-file
(try/catch) so one bad file never aborts the batch. `processBatch` keeps at most
pool size + 2 files in flight (`app/concurrency.ts`) so memory stays flat on
thousand-file batches; the pool is `min(8, cores − 1)` workers. Per-file status changes
emit `file-updated` (not `files-changed`), and tables patch that one row in place.

**Output container:** always `.wav` or `.mp3`, matching input when the input is mp3,
else `.wav` — there's no browser encoder for flac/aiff/m4a/ogg, so anything else decodes
fine but re-encodes as lossless WAV.

**Native-rate decode** (non-WAV, and the editor/estimate): `decodeAudioData` resamples to its context's rate, and a live
`AudioContext` runs at the output device's rate (often 48 kHz) — so decoding through it
made "Original" output depend on the user's audio interface. `audio/decode.ts` instead
decodes through an `OfflineAudioContext` at `FileEntry.sourceSampleRate` (read from the
header: WAV/AIFF/FLAC/MP3/Ogg; Opus = 48 kHz). M4A is deliberately left unparsed (HE-AAC
under-reports its rate) and falls back to the device rate.

**WAV sample rate vs. MP3 bitrate** are separate settings (they used to be one
"bitrate" control that silently meant sample-rate reduction for WAV).
`settingsManager.ts::migrate` maps an old saved `bitrateKbps` onto `wavSampleRateHz`
once.

**Bit depth:** `decodeAudioData` always yields float32, so the source bit depth is read
from the file header (`audio/sampleFormat.ts`: WAV incl. EXTENSIBLE/RF64, AIFF/AIFC,
FLAC; first 64 KB, probed once in `app/fileEntries.ts` → `FileEntry.sourceFormat`, with
a second small read past oversized MP3 ID3 tags). WAV output is 16-bit PCM by default;
"Preserve Bit Depth" keeps the source format (8/16/24/32-bit int or 32-bit float).
Conversions are surfaced in the editor size line, a `32f→16` tag in the file table, and
the results summary. Integer output that would clip (a float source peaking above
0 dBFS) is written as 32-bit float instead, with a "Kept 32-bit float — peaks +N dB…"
note (`outputContainer.ts::chooseOutputFormat`); the editor and size estimates use the
preview/source peak to predict it, the table tags it `32f · avoids clip`.

**File-system capability tiers** (`fs/capabilities.ts`): **Full** (Chrome, File System
Access API) — true overwrite, directory-handle output writing.
**Degraded** (other browsers) — `<input webkitdirectory>` + ZIP download, overwrite
checkbox disabled with an explanatory tooltip rather than silently no-opping. The ZIP
is one archive of the whole batch, streamed store-only to the Origin Private File
System as outputs complete (`DiskZipOutputSink`, client-zip, ZIP64 past 4 GB) and
downloaded from disk — so batch size isn't bounded by RAM or Firefox's 2 GB Blob-part
limit. Where OPFS has no `createWritable` (older Safari), `WorkerZipOutputSink` writes
the same ZIP from `workers/zipWriter.worker.ts` through `createSyncAccessHandle`
(worker-only, Safari 15.2+). Without OPFS (e.g. Firefox private windows) it falls back to in-memory ZIPs
split into ~1 GB parts (`ZipOutputSink`). Both use the same client-zip `ZipStream`;
fflate is a devDependency only, for unzipping in tests.

**Default output location:** the File System Access API gives a directory handle no way
to reach its own parent, so a true sibling `<root>_trimmed/` folder isn't reachable.
Default is a `<root>_trimmed` subfolder created *inside* the picked root instead
(`fs/directoryPicker.ts: resolveDefaultOutputRoot`); an explicit "Choose output folder…"
button lets the user pick a true sibling manually. The recursive folder
walk skips any directory named `*_trimmed` to avoid reprocessing its own output.

### Key behaviors (encoded in unit tests — don't regress)

1. **Trim both leading AND trailing silence.** `audio/trim.ts::computeTrimBounds`
   anchors leading trim to a region starting at sample 0, trailing trim to a region
   ending at the last sample, and leaves every internal region untouched.
2. **"Overwrite" actually overwrites** the source file: `fs/overwriteWriter.ts` writes
   directly back to the source `FileSystemFileHandle` when enabled and supported
   (disabled with a tooltip otherwise). Only when the output keeps the source's
   container (WAV/MP3) — a FLAC/AIFF/M4A/OGG source is re-encoded as WAV, so it's
   written as a new file with a warning rather than putting WAV bytes in a `.flac`.
3. **KO-II >20s check uses final processed duration** (after trim + speed-up), since
   that's what ends up on the hardware (`audio/pipeline.ts` → `audio/naming.ts`).
4. **Speed-up**: tape-style resample (`audio/speedResample.ts`, 1.0x–3.0x, default off)
   that shortens duration and raises pitch. It reads the source at `speed` samples per
   output sample through the same Kaiser-windowed sinc as WAV rate reduction
   (`sampleRateResample.ts::resampleByStep`), cutoff at 1/speed of Nyquist, so nothing
   aliases at any speed; length is `speedUpFrames` (shared with the estimate).
5. **MP3 encoding is pure-JS** (`@breezystack/lamejs`, runs in the worker) — zero
   native dependencies.

### Features ported from the JUCE "KOTrimmer" rewrite

A native JUCE/C++ rewrite targeting the KO II existed outside this repo; its UX was
folded into the web app rather than maintained separately:

- **Waveform editor** (`ui/components/WaveformEditor.ts`): before/after canvases,
  draggable green/red trim handles, wheel zoom around cursor, shift/horizontal-wheel
  pan, double-click a handle to revert to auto, double-click the waveform to reset zoom.
- **Per-file manual trim overrides**: `FileEntry.manualTrim` (source samples, end
  exclusive) is passed through the worker to `runPipeline`, which uses it in place of
  auto-detection. Settings changes only move handles on files without an override.
- **Live preview playback before processing** (`audio/player.ts`), with a playhead on
  whichever waveform is playing; for MP3 inputs below 320 kbps the processed preview is
  round-tripped through the real encoder so artifacts are audible. The whole preview
  render (`renderAudible` + that encode) runs in `workers/preview.worker.ts`
  (`audio/previewJob.ts`, client `audio/preview.ts`) since resampling is pure JS now;
  Space plays/stops, Up/Down moves the file selection, Delete/Backspace removes the
  selected file (with confirm).
- **Size estimates**: per-file in the editor and in the file table's Size column
  (`old → ~new`, actual size once processed), whole-batch next to Process.
  `app/batchEstimate.ts` analyses every file one at a time in `analysis.worker.ts` (WAV/
  AIFF decoded there; other formats decoded on the main thread and the PCM transferred),
  streaming each row's estimate and a running total (extrapolated by bytes over files
  not yet analysed); results are cached so only detection-setting changes re-analyse.
- **Overwrite confirmation** dialog before any in-place overwrite.
- **KO II visual theme** (cream `#F5F0E8` / orange `#FF6B2B`, flat hairline chrome,
  uppercase labels, monospace readouts) — tokens in `ui/styles/app.css` `:root`.

The JUCE app's detector (first/last sample above a peak threshold) was deliberately
*not* ported — the web energy-envelope detector is kept.

### Settings defaults

Canonical source: `src/settings/defaults.ts` (MP3 bitrate / WAV rate option lists:
`src/audio/formats.ts`).

| Setting | Range | Default |
|---|---|---|
| Silence threshold | -60 to 0 dB | -50 dB |
| Min silence duration | 10–10000 ms | 10 ms |
| Padding | 0–1000 ms | 20 ms |
| Speed-up | 1.0x–3.0x | 1.0x (off) |
| WAV sample rate (max; never upsamples) | Original/44.1/22.05/16/11.025/8 kHz | Original |
| MP3 bitrate (MP3 inputs only) | 320/192/160/128/96/64 kbps | 320 |
| Preserve stereo | — | on |
| Preserve bit depth | — | off (16-bit WAV) |
| Overwrite | — | off |

## Working in this repo

- Every push to `main` triggers the Pages deploy workflow — be deliberate about what
  lands on `main` vs. a branch.
- When touching any `src/audio/*` module, run `npm test` first — the unit suite encodes
  the exact algorithms (including the key behaviors above) and is fast (<1s).
- `src/fs/`, service worker behavior, and actual playback are **not** covered by the
  unit suite (they need a real browser / File System Access API). No browser automation
  tool has been available in this environment to date — manual Chrome QA is still owed
  before trusting changes there blind. Checklist: install flow, offline reload,
  drag-drop folder recursion, large-batch Stop behavior, preview playback, waveform
  editor handles/zoom and manual-trim reaching batch output, output
  byte-correctness (`ffprobe` for actual sample rate / MP3 bitrate), overwrite
  correctness, ZIP fallback.
