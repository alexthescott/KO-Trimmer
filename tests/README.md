# KO Trimmer Tests

This directory contains a consolidated test suite for the KO Trimmer application.

## Test Structure

The test suite has been consolidated from 35+ individual test files into organized categories:

### 🔧 Core Application Tests
- **Module Imports** - Tests all required dependencies
- **Application Startup** - Tests application initialization
- **FFmpeg Availability** - Checks audio processing dependencies

### 🎵 Audio Processing Tests
- **Single File Processing** - Tests audio pipeline functionality
- **Stereo Preservation** - Tests stereo audio handling
- **Cymbal Processing** - Tests cymbal crash processing

### 🖥️ UI Component Tests
- **Main Window Creation** - Tests main UI setup
- **Drag Drop Widget** - Tests file drag and drop functionality
- **Audio Preview** - Tests audio preview component
- **Progress Widget** - Tests progress tracking

### ⭐ Favorites System Tests
- **Favorites Sidebar** - Tests favorites UI component
- **Favorites Add/Remove** - Tests adding/removing favorites
- **Favorites Persistence** - Tests favorites storage across sessions

### 📁 Output Directory Tests
- **Output Directory Field** - Tests output directory UI
- **Output Directory Buttons** - Tests directory selection buttons

### ⚙️ Settings and Utilities Tests
- **Settings Manager** - Tests application settings
- **Icon Manager** - Tests icon management utilities

### 🎵 Sample Audio Tests
- **Sample Audio Availability** - Tests that sample audio files are available for testing

### 🔄 Auto-Update Preview Tests
- **Auto-Update Preview Functionality** - Tests the auto-update preview feature

### ⏱️ Audio Duration Tests
- **Audio Duration Calculation** - Tests that audio duration is calculated and displayed correctly
- **Content Duration Display** - Tests that actual audio content duration is shown (excluding silence)
- **Duration Comparison Display** - Tests that original shows total duration and trimmed shows content duration
- **No Trimming Duration Display** - Tests that both files show same duration type when no trimming occurs

### 🔍 Edge Case Tests
- **Large File Handling** - Tests handling of large audio files (100MB+)
- **Corrupted Audio File** - Tests handling of corrupted or invalid audio files
- **Concurrent Processing** - Tests that multiple processing operations don't interfere
- **Memory Cleanup** - Tests that memory is properly cleaned up after processing
- **File Permissions** - Tests handling of files with permission issues
- **Network Path Handling** - Tests handling of network paths and UNC paths
- **Unicode Filename Handling** - Tests handling of files with Unicode characters in names
- **Thread Safety** - Tests thread safety of UI components

## Running Tests

### Run All Tests
```bash
# From project root
python3 tests/test_suite.py

# Or use the test runner
python3 tests/run_tests.py
```

### Run Specific Test Categories
```bash
# Core application tests
python3 tests/run_tests.py --category core

# Audio processing tests
python3 tests/run_tests.py --category audio

# UI component tests
python3 tests/run_tests.py --category ui

# Favorites system tests
python3 tests/run_tests.py --category favorites

# Output directory tests
python3 tests/run_tests.py --category output

# Settings and utilities tests
python3 tests/run_tests.py --category settings

# Sample audio tests
python3 tests/run_tests.py --category sample

# Auto-update preview tests
python3 tests/run_tests.py --category autoupdate

# Audio duration tests
python3 tests/run_tests.py --category duration

# Edge case tests
python3 tests/run_tests.py --category edgecases
```

### Available Categories
- `core` - Core application functionality
- `audio` - Audio processing features
- `ui` - User interface components
- `favorites` - Favorites system
- `output` - Output directory functionality
- `settings` - Settings and utilities
- `sample` - Sample audio file availability
- `autoupdate` - Auto-update preview functionality
- `duration` - Audio duration calculation
- `edgecases` - Edge case and error handling tests
- `all` - All tests (default)

## Test Results

The test suite provides detailed results including:
- ✅ Pass/Fail status for each test
- ⏱️ Test execution time
- 📊 Success rate percentage
- ❌ Detailed error messages for failed tests

## Test Files

### Current Test Files
- **`test_suite.py`** - Comprehensive test suite with all test categories
- **`run_tests.py`** - Command-line test runner with category selection
- **`README.md`** - This documentation

### Archived Files
- **`archive/`** - Directory containing all old individual test files
- **`archive_old_tests.py`** - Script to archive old test files

## Migration from Old Tests

The old individual test files have been archived to `tests/archive/` for reference. The new consolidated test suite covers all the functionality from the original tests but in a more organized and maintainable structure.

## Test Purposes

- **Debugging**: Use specific test categories to isolate issues
- **Feature Validation**: Verify new features work correctly
- **Regression Testing**: Ensure changes don't break existing functionality
- **Development**: Use as examples for understanding component interactions

## Notes

- All tests include proper Python path setup to import from the `src` directory
- Tests are designed to be run independently or as a suite
- Sample audio files are included in `tests/sample_audio/` for realistic testing
- Audio files are excluded from Git via `.gitignore` to prevent large file uploads
- Tests provide detailed output for debugging purposes
- The test suite automatically handles Qt application setup and teardown 