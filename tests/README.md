# TrimVibe Tests

This directory contains test files for the TrimVibe application.

## Test Files

### Core Functionality Tests
- **`test_app.py`** - Tests application startup, imports, and basic functionality
- **`test_single_file.py`** - Tests single file processing with the audio pipeline
- **`test_gui.py`** - Tests GUI components and basic UI functionality

### Feature Tests
- **`test_cymbal.py`** - Tests cymbal crash processing with new forgiving settings
- **`test_cymbal_compare.py`** - Compares old vs new settings for cymbal processing
- **`test_completion_dialog.py`** - Tests the completion dialog with summary statistics
- **`test_output_directory.py`** - Tests output directory path generation
- **`test_output_path.py`** - Tests the new folder structure logic

## Running Tests

All tests can be run from the project root directory:

```bash
# Test application startup
python3 tests/test_app.py

# Test single file processing
python3 tests/test_single_file.py

# Test GUI functionality
python3 tests/test_gui.py

# Test cymbal processing
python3 tests/test_cymbal.py

# Test completion dialog
python3 tests/test_completion_dialog.py
```

## Test Purposes

- **Debugging**: Use these tests to isolate and debug specific functionality
- **Feature Validation**: Verify new features work correctly before integration
- **Regression Testing**: Ensure changes don't break existing functionality
- **Development**: Use as examples for understanding how components work

## Notes

- All tests include proper Python path setup to import from the `src` directory
- Tests are designed to be run independently
- Some tests require specific audio files to be present (update paths as needed)
- Tests provide detailed output for debugging purposes 