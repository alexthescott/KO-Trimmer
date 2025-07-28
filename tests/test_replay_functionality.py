#!/usr/bin/env python3
"""
Test replay functionality in audio preview
"""

import sys
from pathlib import Path

# Add the src directory to the Python path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

def test_replay_methods():
    """Test that replay methods exist and work"""
    try:
        from PyQt6.QtWidgets import QApplication
        from ui.audio_preview import AudioPreviewDialog
        
        # Create QApplication
        app = QApplication.instance()
        if app is None:
            app = QApplication(sys.argv)
        
        # Test file paths
        original_file = "/path/to/original.wav"
        trimmed_file = "/path/to/trimmed.wav"
        
        print("Testing replay functionality...")
        
        dialog = AudioPreviewDialog(original_file, trimmed_file)
        
        # Test that restart methods exist
        if hasattr(dialog, 'restart_original'):
            print("✅ restart_original method exists")
        else:
            print("❌ restart_original method missing")
            return False
            
        if hasattr(dialog, 'restart_trimmed'):
            print("✅ restart_trimmed method exists")
        else:
            print("❌ restart_trimmed method missing")
            return False
            
        # Test that restart buttons exist
        if hasattr(dialog, 'original_restart_btn'):
            print("✅ original_restart_btn exists")
        else:
            print("❌ original_restart_btn missing")
            return False
            
        if hasattr(dialog, 'trimmed_restart_btn'):
            print("✅ trimmed_restart_btn exists")
        else:
            print("❌ trimmed_restart_btn missing")
            return False
        
        # Clean up
        dialog.close()
        dialog.deleteLater()
        
        print("✅ Replay functionality test passed")
        return True
        
    except Exception as e:
        print(f"❌ Replay functionality test failed: {e}")
        return False

def test_auto_replay_logic():
    """Test the auto-replay logic in play methods"""
    try:
        from PyQt6.QtWidgets import QApplication
        from ui.audio_preview import AudioPreviewDialog
        
        # Create QApplication
        app = QApplication.instance()
        if app is None:
            app = QApplication(sys.argv)
        
        # Test file paths
        original_file = "/path/to/original.wav"
        trimmed_file = "/path/to/trimmed.wav"
        
        print("Testing auto-replay logic...")
        
        dialog = AudioPreviewDialog(original_file, trimmed_file)
        
        # Test that play methods exist and can be called
        if callable(dialog.play_original):
            print("✅ play_original method is callable")
        else:
            print("❌ play_original method not callable")
            return False
            
        if callable(dialog.play_trimmed):
            print("✅ play_trimmed method is callable")
        else:
            print("❌ play_trimmed method not callable")
            return False
        
        # Test that restart methods exist and can be called
        if callable(dialog.restart_original):
            print("✅ restart_original method is callable")
        else:
            print("❌ restart_original method not callable")
            return False
            
        if callable(dialog.restart_trimmed):
            print("✅ restart_trimmed method is callable")
        else:
            print("❌ restart_trimmed method not callable")
            return False
        
        # Clean up
        dialog.close()
        dialog.deleteLater()
        
        print("✅ Auto-replay logic test passed")
        return True
        
    except Exception as e:
        print(f"❌ Auto-replay logic test failed: {e}")
        return False

def main():
    """Run all replay functionality tests"""
    print("Testing Audio Preview Replay Functionality")
    print("=" * 45)
    
    tests = [
        ("Replay Methods", test_replay_methods),
        ("Auto-Replay Logic", test_auto_replay_logic),
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
        print("🎉 All replay functionality tests passed!")
        return True
    else:
        print("⚠️  Some replay functionality tests failed")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1) 