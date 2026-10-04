# KO Trimmer

Batch silence-trimmer for beatmakers with limited sample storage on hardware devices
(Teenage Engineering OP-1/OP-Z/EP series, Pocket Operators, MPC). Trims silence from the
start and end of every sample in a folder, with optional mono downmix, bitrate/sample-rate
reduction, and tape-style speed-up to squeeze samples into tight device memory.

## Web App

**Use it at [alexthescott.github.io/KO-Trimmer](https://alexthescott.github.io/KO-Trimmer/)** —
installable from Chrome, works offline, no download or FFmpeg required. All audio
processing and file reading/writing happens locally in your browser.

![KO Trimmer web app — file list and waveform editor](docs/screenshots/main.png)

### How to use

1. **Add samples.** Drop audio files or a folder onto the app, or click to choose a folder.
   Every supported sample in it (including subfolders) is queued. Favorite folders can be
   saved in the sidebar for quick access.
2. **Adjust settings.** Silence threshold, minimum silence duration, padding, speed-up,
   bitrate, and preserve-stereo (off = mono downmix).
3. **Check the trim.** Selecting a file opens the waveform editor: the green and red handles
   show where leading and trailing silence will be cut. Drag them to override the automatic
   trim for that file (double-click a handle to revert to auto). Press Space to preview, and
   the editor shows the estimated output size.

   ![Waveform editor with trim handles and before/after preview](docs/screenshots/editor.png)

4. **Process.** Click **Process Files** to run the batch. In Chrome, trimmed files are written
   into a `<folder>_trimmed/` subfolder (or use **Choose output folder…** to pick another
   location); in other browsers they download as a ZIP. Enable **Overwrite original** (Chrome only) to
   replace the original files in place.

   ![Processing results](docs/screenshots/results.png)

MP3 inputs stay MP3; everything else is written as WAV. Files longer than 20 seconds after
processing get an underscore (`_`) prefix for KO II compatibility.

See [`web/README.md`](web/README.md) for development and deployment instructions.

## Legacy Desktop App

The original PyQt6 desktop app in `src/` still works but is no longer actively developed —
the web app replaces it. It requires a system FFmpeg install (`brew install ffmpeg` on macOS,
`sudo apt install ffmpeg` on Linux, or [ffmpeg.org](https://ffmpeg.org/) on Windows) for MP3
output.

```bash
pip install -r requirements.txt
python3 src/main.py
```

Drag audio files or folders onto the window, adjust threshold (-60 to 0 dB), minimum silence
duration (100–10000 ms), padding (0–1000 ms), bitrate, and stereo, then click
**Process Files**. Note the desktop app only trims trailing silence; the web app trims both
ends.

Desktop tests:

```bash
cd tests
python3 run_tests.py                       # all
python3 run_tests.py --category processing # or ui / layout
```

## Contributing

New feature work goes in `web/`. Run `npm test` in `web/` before changing anything under
`web/src/audio/`.

## License

MIT
