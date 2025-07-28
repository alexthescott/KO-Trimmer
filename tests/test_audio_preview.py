#!/usr/bin/env python3
"""
Test audio preview functionality
"""

import sys
from pathlib import Path

# Add the src directory to the Python path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

def test_audio_preview_import():
    """Test that audio preview can be imported"""
    try:
        from ui.audio_preview import AudioPreviewDialog
        print("✅ AudioPreviewDialog import successful")
        return True
    except ImportError as e:
        print(f"❌ AudioPreviewDialog import failed: {e}")
        return False

def test_qt_multimedia_import():
    """Test that Qt Multimedia can be imported"""
    try:
        from PyQt6.QtMultimedia import QMediaPlayer, QAudioOutput
        print("✅ Qt Multimedia import successful")
        return True
    except ImportError as e:
        print(f"❌ Qt Multimedia import failed: {e}")
        return False

def test_audio_preview_creation():
    """Test creating an audio preview dialog"""
    try:
        from PyQt6.QtWidgets import QApplication
        from ui.audio_preview import AudioPreviewDialog
        
        # Create a minimal QApplication if one doesn't exist
        app = QApplication.instance()
        if app is None:
            app = QApplication(sys.argv)
        
        # Test file paths (these won't exist, but we're testing the dialog creation)
        original_file = "/path/to/original.wav"
        trimmed_file = "/path/to/trimmed.wav"
        
        # Create the dialog
        dialog = AudioPreviewDialog(original_file, trimmed_file)
        print("✅ AudioPreviewDialog creation successful")
        
        # Clean up
        dialog.close()
        return True
        
    except Exception as e:
        print(f"❌ AudioPreviewDialog creation failed: {e}")
        return False

def test_main_window_preview_integration():
    """Test that preview functionality is integrated into main window"""
    try:
        from ui.main_window import MainWindow
        from PyQt6.QtWidgets import QApplication
        
        # Create a minimal QApplication if one doesn't exist
        app = QApplication.instance()
        if app is None:
            app = QApplication(sys.argv)
        
        # Create main window
        window = MainWindow()
        
        # Check if preview method exists
        if hasattr(window, 'preview_selected'):
            print("✅ MainWindow preview_selected method exists")
        else:
            print("❌ MainWindow preview_selected method missing")
            return False
            
        # Check if preview button exists
        if hasattr(window, 'preview_btn'):
            print("✅ MainWindow preview button exists")
        else:
            print("❌ MainWindow preview button missing")
            return False
            
        # Clean up
        window.close()
        return True
        
    except Exception as e:
        print(f"❌ MainWindow preview integration test failed: {e}")
        return False

def main():
    """Run all audio preview tests"""
    print("Testing Audio Preview Functionality")
    print("=" * 40)
    
    tests = [
        ("Qt Multimedia Import", test_qt_multimedia_import),
        ("Audio Preview Import", test_audio_preview_import),
        ("Audio Preview Creation", test_audio_preview_creation),
        ("Main Window Preview Integration", test_main_window_preview_integration),
    ]
    
    passed = 0
    total = len(tests)
    
    for test_name, test_func in tests:
        print(f"\n🧪 {test_name}:")
        if test_func():
            passed += 1
            print(f"✅ {test_name} PASSED")
        else:
            print(f"❌ {test_name} FAILED")
    
    print(f"\n📊 Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All audio preview tests passed!")
        return True
    else:
        print("⚠️  Some audio preview tests failed")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1) 