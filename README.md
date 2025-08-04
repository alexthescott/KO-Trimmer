# KO Trimmer

## Overview
KO Trimmer is a modern, user-friendly audio file batch trimmer and silence detector. It features a clean UI, favorites sidebar, drag-and-drop, audio preview, and a dedicated processing window for batch operations.

## Features
- Batch trim and process audio files (WAV, MP3, FLAC, etc.)
- Silence detection and configurable trimming
- Favorites sidebar for quick access to directories
- Drag-and-drop file/folder support
- Audio preview with play/pause and duration comparison
- Dedicated processing window with real-time progress and results
- Output directory management and overwrite options
- Modern, responsive PyQt6 UI
- Uses ffmpeg-python for audio compression (requires system ffmpeg installation)

## Project Structure

```
TrimVibe/
├── build_app.py
├── package_app.py
├── requirements.txt
├── README.md
├── Context.md
├── src/
│   ├── main.py
│   ├── __init__.py
│   ├── audio/
│   │   ├── audio_utils.py
│   │   ├── file_handler.py
│   │   ├── processor.py
│   │   ├── silence_detector.py
│   │   └── __init__.py
│   ├── ui/
│   │   ├── __init__.py
│   │   ├── audio_player.py
│   │   ├── audio_preview.py
│   │   ├── audio_preview_simple.py
│   │   ├── combined_file_widget.py
│   │   ├── drag_drop.py
│   │   ├── favorites_sidebar.py
│   │   ├── main_window.py
│   │   ├── processing_window.py
│   │   ├── progress.py
│   │   ├── ui_utils.py
│   │   ├── welcome_dialog.py
│   │   └── images/
│   └── utils/
│       ├── icon_manager.py
│       └── settings_manager.py
├── tests/
│   ├── test_suite_consolidated.py
│   ├── run_tests.py
│   ├── CONSOLIDATION_SUMMARY.md
│   ├── sample_audio/
│   ├── archive/ (legacy tests)
│   └── README.md
└── ...
```

## Requirements

### FFmpeg Installation
For MP3 compression functionality, FFmpeg must be installed on your system:

**macOS:**
```bash
brew install ffmpeg
```

**Windows:**
Download from [https://ffmpeg.org/](https://ffmpeg.org/)

**Linux:**
```bash
sudo apt install ffmpeg
```

## Running the Application

```bash
python3 src/main.py
```

## Running Tests

### Consolidated Test Suite
Run all core, UI, and edge case tests:
```bash
cd tests
python3 run_tests.py
```

Run a specific category:
```bash
python3 run_tests.py --category ui
python3 run_tests.py --category processing
python3 run_tests.py --category layout
```

### Interactive User Flow Tests
For manual/interactive UI validation (with 30s timeouts for user actions):
```bash
python3 user_flow_tests.py
```
- Follow the printed instructions for each step
- Interact with the UI as prompted (e.g., click preview, process files, etc.)

## Cleaned Up & Removed Files
- Removed unused/duplicate files: `main_window_refactored.py`, `processing_manager.py`, `file_panel.py`, `settings_panel.py`
- Cleaned up `.DS_Store`, `__pycache__`, and `.pyc` files
- Removed empty/duplicate directories: `nonexistent`, `tests/tests`
- Legacy tests are archived in `tests/archive/` (safe to delete if not needed)

## Key Improvements
- Modern, maintainable codebase
- All UI and processing logic is in use and up to date
- Tests are consolidated, fast, and easy to run
- Interactive user flow tests for manual QA

## Contributing
- Add new features to `src/`
- Add or update tests in `tests/`
- Run `python3 run_tests.py` and `python3 user_flow_tests.py` before submitting changes

## License
MIT 