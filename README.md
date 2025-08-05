# KO Trimmer

## Overview
KO Trimmer is a modern, user-friendly audio file batch trimmer and silence detector. It features a clean UI, favorites sidebar, drag-and-drop, audio preview, and a dedicated processing window for batch operations.

## Quick Start

### **Option 1: macOS App Bundle (Recommended)**
```bash
# Double-click in Finder
open TrimVibe.app

# Or from terminal
open TrimVibe.app
```

### **Option 2: Python Application**
```bash
# Install dependencies
pip install -r requirements.txt

# Run the application
python3 src/main.py
```

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

## How to Use

### **1. Launch the Application**
- **macOS**: Double-click `TrimVibe.app` or run `open TrimVibe.app`
- **Python**: Run `python3 src/main.py`

### **2. Add Audio Files**
- **Drag & Drop**: Drag audio files or folders onto the application
- **Browse**: Click "Add Files" to select audio files manually
- **Favorites**: Use the sidebar to quickly access frequently used directories

### **3. Configure Settings**
- **Threshold**: Set silence detection sensitivity (-60dB to -10dB)
- **Min Duration**: Minimum silence duration to trigger trimming (0.1s to 5.0s)
- **Padding**: Add padding around detected silence (0.0s to 2.0s)
- **Bitrate**: Choose output quality (64kb/s to 320kb/s)
- **Stereo**: Preserve stereo channels or convert to mono

### **4. Process Files**
- Click "Process Files" to start batch processing
- Monitor progress in the dedicated processing window
- View real-time results and timing statistics
- Files longer than 20 seconds get an underscore prefix (_) for KO II compatibility

### **5. Preview Results**
- Select any processed file to preview
- Compare original vs. processed audio
- Use play/pause controls and seek through audio

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

## macOS App Bundle

The application is available as a native macOS app bundle (`TrimVibe.app`) with these features:

### **Key Benefits**
- **Self-Contained**: 105MB bundle with all dependencies included
- **Native Integration**: Proper Dock and Finder integration
- **Drag & Drop**: Drop audio files directly onto the app icon
- **Apple Silicon Optimized**: ARM64 architecture for M1/M2 Macs
- **No Installation**: Just double-click to run

### **App Bundle Features**
- **Size**: 105MB (self-contained)
- **Architecture**: ARM64 (Apple Silicon)
- **Dependencies**: All bundled (no external requirements)
- **Minimum macOS**: 10.15 (Catalina)
- **Audio Formats**: WAV, MP3, AIFF, FLAC, M4A

### **Build Process**
```bash
# Automatic build
./create_app_bundle.sh

# Test the app bundle
./tests/test_app_bundle.sh
```

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
│   ├── test_app_bundle.sh
│   ├── CONSOLIDATION_SUMMARY.md
│   ├── sample_audio/
│   ├── archive/ (legacy tests)
│   └── README.md
└── ...
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

### App Bundle Tests
Test the macOS app bundle:
```bash
./tests/test_app_bundle.sh
```

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
- Native macOS app bundle for easy distribution

## Contributing
- Add new features to `src/`
- Add or update tests in `tests/`
- Run `python3 run_tests.py` and `python3 user_flow_tests.py` before submitting changes

## License
MIT 