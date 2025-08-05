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

## macOS App Bundle
The application has been successfully packaged as a native macOS app bundle (`TrimVibe.app`) with the following features:

### **App Bundle Structure**
```
TrimVibe.app/
├── Contents/
│   ├── Info.plist          # App metadata and configuration
│   ├── MacOS/
│   │   └── TrimVibe        # Main executable (105MB)
│   └── Resources/
│       └── Knockout.icns   # App icon
```

### **Key Features**
- **Native macOS Integration**: Proper app bundle structure, Dock integration, Finder integration
- **Audio File Association**: Supports WAV, MP3, AIFF, FLAC, M4A with drag & drop
- **Self-Contained**: 105MB bundle with all dependencies included
- **Apple Silicon Optimized**: ARM64 architecture for M1/M2 Macs
- **FFmpeg Integration**: Uses system-installed FFmpeg for audio compression

### **Technical Specifications**
- **Size**: 105MB (self-contained)
- **Architecture**: ARM64 (Apple Silicon)
- **Dependencies**: All bundled (no external requirements)
- **Python**: 3.9.6 (bundled)
- **Qt**: PyQt6 (bundled)
- **Minimum macOS**: 10.15 (Catalina)

### **Build Process**
```bash
# Automatic build
./create_app_bundle.sh

# Manual build
python3 build_app.py
./create_app_bundle.sh
```

### **Usage**
- **Double-click**: `TrimVibe.app` in Finder
- **Command line**: `open TrimVibe.app`
- **Drag & Drop**: Drag audio files onto app icon

### **Testing**
```bash
# Run test suite
./tests/test_app_bundle.sh

# Manual testing
open TrimVibe.app
```

## Codebase Structure (2024)

```