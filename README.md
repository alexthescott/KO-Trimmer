# KO Trimmer - Audio Silence Trimmer for KO II Sampler

A cross-platform desktop application designed to help users optimize audio files for the Teenage Engineering KO II sampler by automatically trimming silence from audio samples. This maximizes the limited 64MB memory capacity of the KO II by removing unnecessary silent portions.

## Features

- **Cross-platform**: Works on Windows, macOS, and Linux
- **Drag & Drop Interface**: Intuitive file/folder import system
- **Silence Detection**: Advanced algorithms using librosa and numpy
- **Batch Processing**: Handle multiple files simultaneously
- **Export Options**: Overwrite original files or save to new directory
- **Audio Format Support**: WAV, MP3, FLAC, AIFF, M4A, OGG, and more
- **Customizable Settings**: Adjust silence detection thresholds and parameters
- **Stereo Preservation**: Choose to preserve stereo channels or convert to mono
- **Smart Directory Naming**: Output directories include stereo/mono information
- **Audio Preview**: Compare original and trimmed audio files side-by-side
- **Preview Controls**: Play, pause, stop, and progress tracking for both versions

## Installation

### Prerequisites

- Python 3.8 or higher
- FFmpeg (for additional audio format support)

### Install FFmpeg

**macOS:**
```bash
brew install ffmpeg
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install ffmpeg
```

**Windows:**
Download from [FFmpeg website](https://ffmpeg.org/download.html) or install via Chocolatey:
```bash
choco install ffmpeg
```

### Install KO Trimmer

1. Clone the repository:
```bash
git clone https://github.com/yourusername/ko-trimmer.git
cd ko-trimmer
```

2. Create a virtual environment (recommended):
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

## Usage

### Running the Application

```bash
python src/main.py
```

### Basic Workflow

1. **Add Files**: Drag and drop audio files or folders onto the application, or use the "Add Files" / "Add Folder" buttons
2. **Configure Settings**: Adjust silence detection parameters:
   - **Silence Threshold**: dB level below which audio is considered silence (-60 to 0 dB)
   - **Min Silence Duration**: Minimum duration of silence to detect (100-10000 ms)
   - **Padding**: Additional padding around detected audio (0-1000 ms)
3. **Process Files**: Click "Process Files" to start trimming
4. **Preview Results**: Select a processed file and click "Preview Selected" to compare original vs trimmed audio
5. **Export Options**: Choose to overwrite original files or save to a new "trimmed" directory
6. **Output Files**: All processed files are saved with "_trimmed" suffix (e.g., "kick01.wav_trimmed")
7. **Directory Naming**: Output directories include stereo/mono information (e.g., "drumkit_trimmed_stereo" or "drumkit_trimmed_mono")

### Settings Explained

- **Silence Threshold**: Lower values (-50 to -60 dB) are more sensitive to quiet sounds
- **Min Silence Duration**: Longer durations (1000+ ms) only detect longer silence periods
- **Padding**: Adds extra time around detected audio to preserve natural sound
- **Preserve Stereo Channels**: When checked, maintains original stereo/mono configuration; when unchecked, converts stereo to mono

### Audio Preview

The audio preview feature allows you to compare original and trimmed audio files:

- **Side-by-Side Comparison**: Play both original and trimmed versions simultaneously
- **Progress Tracking**: Real-time progress bars show playback position
- **Duration Display**: Shows current time and total duration for both files
- **File Information**: Displays file sizes and reduction statistics
- **Auto-Replay**: Automatically resets to beginning when playback ends
- **Restart Buttons**: Dedicated "🔄 Restart" buttons for instant replay
- **Context Menu**: Right-click on files in the list for quick preview access

## Audio Processing

KO Trimmer uses advanced audio processing techniques:

- **librosa**: For audio analysis and feature extraction (preserves stereo channels)
- **pydub**: For high-level audio manipulation (preserves stereo channels)
- **soundfile**: For efficient audio file I/O
- **numpy/scipy**: For numerical computing and signal processing
- **Stereo Preservation**: Maintains original stereo channels throughout processing (stereo stays stereo, mono stays mono)

### Supported Formats

- **Input**: WAV, MP3, FLAC, AIFF, M4A, OGG, WMA, AAC
- **Output**: WAV, MP3, FLAC, AIFF, M4A, OGG

## Development

### Project Structure

```
KO Trimmer/
├── src/
│   ├── main.py              # Application entry point
│   ├── ui/                  # Qt UI components
│   │   ├── main_window.py   # Main application window
│   │   ├── drag_drop.py     # Drag & drop functionality
│   │   ├── progress.py      # Progress indicators
│   │   └── images/          # Application assets
│   │       ├── Knockout.png # Application icon
│   │       └── Knockout.svg # Vector icon source
│   ├── audio/               # Audio processing modules
│   │   ├── processor.py     # Main audio processing logic
│   │   ├── silence_detector.py  # Silence detection algorithms
│   │   └── file_handler.py  # File I/O operations
│   └── utils/               # Utility functions
├── tests/                   # Test files
├── requirements.txt          # Python dependencies
└── README.md                # This file
```

### Running Tests

```bash
pytest tests/
```

### Building Distribution

```bash
# Install PyInstaller
pip install pyinstaller

# Build macOS app (recommended for proper app name and icon)
python3 -m PyInstaller --onefile --windowed --name="KO Trimmer" --icon=src/ui/images/Knockout.png --add-data=src/ui/images:ui/images --hidden-import=src.ui.main_window --hidden-import=src.ui.drag_drop --hidden-import=src.ui.progress --hidden-import=src.ui.dialogs --hidden-import=src.audio.processor --hidden-import=src.audio.silence_detector --hidden-import=src.audio.file_handler --collect-all=src src/main.py

# Or use the build script
python3 build_app.py
```

## Technology Stack

- **Frontend**: PyQt6 for cross-platform GUI
- **Audio Processing**: librosa, pydub, soundfile, numpy, scipy
- **Language**: Python 3.8+
- **Platform**: Windows, macOS, Linux

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Commit your changes: `git commit -am 'Add feature'`
4. Push to the branch: `git push origin feature-name`
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Teenage Engineering for the KO II sampler
- The Python audio processing community
- Qt for the excellent cross-platform GUI framework

## Support

For issues and feature requests, please create an issue on GitHub.

## Roadmap

- [ ] Audio preview functionality
- [ ] Waveform visualization
- [ ] Advanced silence detection algorithms
- [ ] Batch processing queue management
- [ ] Export format selection
- [ ] Metadata preservation
- [ ] KO II specific optimization settings 