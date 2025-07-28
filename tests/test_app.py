#!/usr/bin/env python3
"""
Simple test script to verify KO Trimmer application startup
"""

import sys
import os
from pathlib import Path

# Add the src directory to the Python path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

def test_imports():
    """Test that all required modules can be imported"""
    try:
        print("Testing imports...")
        
        # Test Qt imports
        from PyQt6.QtWidgets import QApplication
        from PyQt6.QtCore import Qt
        print("✅ PyQt6 imports successful")
        
        # Test audio processing imports
        import librosa
        import soundfile as sf
        import numpy as np
        print("✅ Audio processing imports successful")
        
        # Test pydub (with FFmpeg warning handling)
        try:
            from pydub import AudioSegment
            print("✅ Pydub import successful")
        except Exception as e:
            print(f"⚠️  Pydub import warning: {e}")
            
        # Test our custom modules
        from ui.main_window import MainWindow
        from audio.processor import AudioProcessor
        from audio.silence_detector import SilenceDetector
        from audio.file_handler import AudioFileHandler
        print("✅ Custom modules import successful")
        
        return True
        
    except ImportError as e:
        print(f"❌ Import error: {e}")
        return False
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return False

def test_app_startup():
    """Test that the application can start"""
    try:
        print("\nTesting application startup...")
        
        from PyQt6.QtWidgets import QApplication
        from ui.main_window import MainWindow
        
        # Create application (without showing window)
        app = QApplication(sys.argv)
        app.setApplicationName("KO Trimmer Test")
        
        # Create main window
        window = MainWindow()
        print("✅ Application startup successful")
        
        return True
        
    except Exception as e:
        print(f"❌ Application startup failed: {e}")
        return False

def check_ffmpeg():
    """Check if FFmpeg is available"""
    import subprocess
    
    try:
        result = subprocess.run(['ffmpeg', '-version'], 
                              capture_output=True, text=True, timeout=5)
        if result.returncode == 0:
            print("✅ FFmpeg is available")
            return True
        else:
            print("⚠️  FFmpeg not found or not working")
            return False
    except (subprocess.TimeoutExpired, FileNotFoundError):
        print("⚠️  FFmpeg not found - some audio formats may not work")
        print("   Install FFmpeg for full audio format support:")
        print("   macOS: brew install ffmpeg")
        print("   Ubuntu: sudo apt install ffmpeg")
        print("   Windows: Download from https://ffmpeg.org/download.html")
        return False

if __name__ == "__main__":
    print("KO Trimmer Application Test")
    print("=" * 40)
    
    # Test imports
    imports_ok = test_imports()
    
    # Check FFmpeg
    ffmpeg_ok = check_ffmpeg()
    
    # Test app startup
    startup_ok = test_app_startup()
    
    print("\n" + "=" * 40)
    if imports_ok and startup_ok:
        print("✅ All tests passed! Application should work correctly.")
        if not ffmpeg_ok:
            print("⚠️  Install FFmpeg for better audio format support.")
    else:
        print("❌ Some tests failed. Check the errors above.")
    
    print("\nTo run the full application:")
    print("python src/main.py") 