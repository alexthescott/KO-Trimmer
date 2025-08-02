# KO Trimmer - Context & Development Notes

## Project Context
KO Trimmer is a modern, user-friendly batch audio trimmer and silence detector for musicians and producers. It is designed for fast, reliable, and visually clear batch processing of audio files, with a focus on usability and maintainability.

## Key Features
- Batch trim and process audio files (WAV, MP3, FLAC, etc.)
- Silence detection and configurable trimming
- Favorites sidebar for quick access to directories
- Drag-and-drop file/folder support
- Audio preview with play/pause and duration comparison
- Dedicated processing window with real-time progress and results
- Output directory management and overwrite options
- Modern, responsive PyQt6 UI

## Codebase Structure (2024)

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
│   ├── user_flow_tests.py
│   ├── CONSOLIDATION_SUMMARY.md
│   ├── sample_audio/
│   ├── archive/ (legacy tests)
│   └── README.md
└── ...
```

## Recent Cleanups & Improvements
- Removed unused/duplicate files: `main_window_refactored.py`, `processing_manager.py`, `file_panel.py`, `settings_panel.py`
- Cleaned up `.DS_Store`, `__pycache__`, and `.pyc` files
- Removed empty/duplicate directories: `nonexistent`, `tests/tests`
- Legacy tests are archived in `tests/archive/` (safe to delete if not needed)
- All UI and processing logic is in use and up to date
- Tests are consolidated, fast, and easy to run
- Interactive user flow tests for manual QA

## Test Approach
- **Consolidated Test Suite**: Covers all core, UI, and edge case functionality in a single, maintainable file (`test_suite_consolidated.py`).
- **Interactive User Flow Tests**: For manual QA, with 30s timeouts for user actions (`user_flow_tests.py`).
- **Legacy Tests**: Archived in `tests/archive/` for reference only.

## How to Run
- **App**: `python3 src/main.py`
- **All tests**: `cd tests && python3 run_tests.py`
- **Interactive/manual tests**: `python3 user_flow_tests.py`

## Development Notes
- All UI and processing logic is now in use and up to date
- All tests are consolidated, fast, and easy to run
- Interactive user flow tests are available for manual QA
- Project is now much easier to maintain and extend

## Next Steps
- Remove `tests/archive/` if legacy tests are no longer needed
- Update documentation as new features are added
- Continue to add/maintain tests in `test_suite_consolidated.py` and `user_flow_tests.py`

---

**For more details, see:**
- [README.md](README.md) for project overview and usage
- [tests/README.md](tests/README.md) for test instructions
- [tests/CONSOLIDATION_SUMMARY.md](tests/CONSOLIDATION_SUMMARY.md) for test suite consolidation details 