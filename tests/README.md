# KO Trimmer Test Suite

## Overview
This directory contains all tests for KO Trimmer, including:
- A consolidated, modern test suite for core, UI, and edge case coverage
- Interactive user flow tests for manual QA
- macOS app bundle tests for the packaged application
- Archived legacy tests (in `archive/`)

## Test Structure

```
tests/
├── test_suite_consolidated.py      # Main consolidated test suite
├── run_tests.py                    # Test runner (category support)
├── user_flow_tests.py              # Interactive/manual user flow tests
├── test_app_bundle.sh              # macOS app bundle validation tests
├── CONSOLIDATION_SUMMARY.md        # Test consolidation summary
├── sample_audio/                   # Sample audio files for tests
├── archive/                        # Legacy tests (not maintained)
└── README.md                       # This file
```

## Running Tests

### 1. Consolidated Test Suite
Run all core, UI, and edge case tests:
```bash
python3 run_tests.py
```

Run a specific category:
```bash
python3 run_tests.py --category ui
python3 run_tests.py --category processing
python3 run_tests.py --category layout
```

### 2. Interactive User Flow Tests
For manual/interactive UI validation (with 30s timeouts for user actions):
```bash
python3 user_flow_tests.py
```
- Follow the printed instructions for each step
- Interact with the UI as prompted (e.g., click preview, process files, etc.)

### 3. macOS App Bundle Tests
Test the packaged macOS application:
```bash
./test_app_bundle.sh
```
- Validates app bundle structure and permissions
- Tests app launch capability
- Checks for required files (executable, Info.plist, icon)

## Cleaned Up & Removed Files
- Removed unused/duplicate files: `main_window_refactored.py`, `processing_manager.py`, `file_panel.py`, `settings_panel.py`
- Cleaned up `.DS_Store`, `__pycache__`, and `.pyc` files
- Removed empty/duplicate directories: `nonexistent`, `tests/tests`
- Legacy tests are archived in `archive/` (safe to delete if not needed)

## Key Improvements
- Modern, maintainable test suite
- All UI and processing logic is in use and up to date
- Tests are consolidated, fast, and easy to run
- Interactive user flow tests for manual QA
- macOS app bundle validation tests

## Legacy Tests
- All old, granular test files are in `archive/` for reference only
- These are not maintained and can be deleted if not needed

## Contributing to Tests
- Add new tests to `test_suite_consolidated.py` or `user_flow_tests.py`
- Run all tests before submitting changes
- Test the app bundle after making changes to the application

## See Also
- [../README.md](../README.md) for project overview and usage
- [CONSOLIDATION_SUMMARY.md](CONSOLIDATION_SUMMARY.md) for details on test suite consolidation 