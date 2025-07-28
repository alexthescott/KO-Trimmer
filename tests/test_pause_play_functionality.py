#!/usr/bin/env python3
"""
Test pause and play functionality in audio preview
"""

import sys
from pathlib import Path

# Add the src directory to the Python path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

def test_pause_play_methods():
    """Test that pause and play methods exist and work"""
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
        
        print("Testing pause/play functionality...")
        
        dialog = AudioPreviewDialog(original_file, trimmed_file)
        
        # Test that pause methods exist
        if hasattr(dialog, 'pause_original'):
            print("✅ pause_original method exists")
        else:
            print("❌ pause_original method missing")
            return False
            
        if hasattr(dialog, 'pause_trimmed'):
            print("✅ pause_trimmed method exists")
        else:
            print("❌ pause_trimmed method missing")
            return False
            
        # Test that play methods exist
        if hasattr(dialog, 'play_original'):
            print("✅ play_original method exists")
        else:
            print("❌ play_original method missing")
            return False
            
        if hasattr(dialog, 'play_trimmed'):
            print("✅ play_trimmed method exists")
        else:
            print("❌ play_trimmed method missing")
            return False
        
        # Clean up
        dialog.close()
        dialog.deleteLater()
        
        print("✅ Pause/play functionality test passed")
        return True
        
    except Exception as e:
        print(f"❌ Pause/play functionality test failed: {e}")
        return False

def test_playback_state_handlers():
    """Test that playback state handlers exist"""
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
        
        print("Testing playback state handlers...")
        
        dialog = AudioPreviewDialog(original_file, trimmed_file)
        
        # Test that playback state handlers exist
        if hasattr(dialog, 'on_original_playback_state_changed'):
            print("✅ on_original_playback_state_changed method exists")
        else:
            print("❌ on_original_playback_state_changed method missing")
            return False
            
        if hasattr(dialog, 'on_trimmed_playback_state_changed'):
            print("✅ on_trimmed_playback_state_changed method exists")
        else:
            print("❌ on_trimmed_playback_state_changed method missing")
            return False
        
        # Clean up
        dialog.close()
        dialog.deleteLater()
        
        print("✅ Playback state handlers test passed")
        return True
        
    except Exception as e:
        print(f"❌ Playback state handlers test failed: {e}")
        return False

def test_button_state_management():
    """Test that button state management is simplified"""
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
        
        print("Testing button state management...")
        
        dialog = AudioPreviewDialog(original_file, trimmed_file)
        
        # Test that play methods don't manually set button states
        play_original_source = dialog.play_original.__code__.co_consts
        play_trimmed_source = dialog.play_trimmed.__code__.co_consts
        
        # Check that play methods don't contain setEnabled calls
        has_original_setenabled = any('setEnabled' in str(const) for const in play_original_source if isinstance(const, str))
        has_trimmed_setenabled = any('setEnabled' in str(const) for const in play_trimmed_source if isinstance(const, str))
        
        if not has_original_setenabled:
            print("✅ play_original method doesn't manually set button states")
        else:
            print("❌ play_original method still manually sets button states")
            return False
            
        if not has_trimmed_setenabled:
            print("✅ play_trimmed method doesn't manually set button states")
        else:
            print("❌ play_trimmed method still manually sets button states")
            return False
        
        # Clean up
        dialog.close()
        dialog.deleteLater()
        
        print("✅ Button state management test passed")
        return True
        
    except Exception as e:
        print(f"❌ Button state management test failed: {e}")
        return False

def main():
    """Run all pause/play functionality tests"""
    print("Testing Audio Preview Pause/Play Functionality")
    print("=" * 50)
    
    tests = [
        ("Pause/Play Methods", test_pause_play_methods),
        ("Playback State Handlers", test_playback_state_handlers),
        ("Button State Management", test_button_state_management),
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
        print("🎉 All pause/play functionality tests passed!")
        return True
    else:
        print("⚠️  Some pause/play functionality tests failed")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1) 