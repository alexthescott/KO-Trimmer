# KO Trimmer — Web App

A Progressive Web App port of KO Trimmer: batch silence-trimming for sample-limited hardware (OP-1/OP-Z, Pocket Operators, MPC), installable from Chrome, with zero network calls in the processing path — decoding, trimming, resampling, and encoding all happen locally in the browser (Web Audio API + Web Workers + a pure-JS MP3 encoder).

This is a separate, additive app from the Python desktop app in the repo root (`../src`); it does not replace it.

## Develop

```bash
npm install
npm run dev
```

## Test

```bash
npm test          # run the unit suite once
npm run test:watch
```

Unit tests cover the pure DSP logic (energy envelope, silence detection, the corrected leading+trailing trim, naming rules, speed-up resampling, and an MP3 encoder smoke test). Browser-only behavior (File System Access API, drag-drop, service worker, actual playback) isn't covered by these tests — see the manual QA checklist in the project plan.

## Build & preview

```bash
npm run icons   # regenerate PWA icons from ../src/ui/images/Knockout.svg
npm run build   # typecheck + production build to dist/
npm run preview # serve dist/ locally at the /KO-Trimmer/ base path
```

## Deploy

Pushing changes under `web/` to `main` triggers `.github/workflows/deploy-pwa.yml`, which builds and deploys `web/dist` to GitHub Pages. One-time setup: in the repo's Settings → Pages, set the source to "GitHub Actions".

The production base path is `/KO-Trimmer/` (set in `vite.config.ts`), matching this repo's GitHub Pages project-page URL. If you ever move to a custom domain, change `base` to `/`.

## Browser support

Full functionality (true in-place overwrite, writing output directly into a folder, persisted favorite directories) requires Chrome's File System Access API. Other browsers get a degraded-but-functional tier: a `<input webkitdirectory>` folder picker and a ZIP download for output instead.
