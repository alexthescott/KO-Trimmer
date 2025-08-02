#!/usr/bin/env python3
"""
Test that audio preview can be opened multiple times for the same file
"""

import sys
from pathlib import Path

# Add the src directory to the Python path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

def test_preview_repeat():
    """Test that preview dialog can be opened multiple times"""
    try:
        from PyQt6.QtWidgets import QApplication
        from ui.audio_preview import AudioPreviewDialog
        
        # Create QApplication
        app = QApplication.instance()
        if app is None:
            app = QApplication(sys.argv)
        
        # Test file paths (these won't exist, but we're testing the dialog creation)
        original_file = "/path/to/original.wav"
        trimmed_file = "/path/to/trimmed.wav"
        
        print("Testing multiple preview dialog creation...")
        
        # Create the dialog multiple times
        for i in range(3):
            print(f"Creating preview dialog #{i+1}...")
            dialog = AudioPreviewDialog(original_file, trimmed_file)
            
            # Test that the dialog can be created
            if dialog is not None:
                print(f"✅ Dialog #{i+1} created successfully")
                
                # Test reset functionality
                dialog.reset_players()
                print(f"✅ Dialog #{i+1} reset successfully")
                
                # Test reload functionality
                dialog.reload_files()
                print(f"✅ Dialog #{i+1} reloaded successfully")
                
                # Clean up
                dialog.close()
                dialog.deleteLater()
            else:
                print(f"❌ Dialog #{i+1} creation failed")
                return False
        
        print("✅ All preview dialogs created and cleaned up successfully")
        return True
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        return False

def test_player_reset():
    """Test that media players reset properly"""
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
        
        print("Testing media player reset functionality...")
        
        dialog = AudioPreviewDialog(original_file, trimmed_file)
        
        # Test initial state
        if dialog.original_player.mediaStatus() == dialog.original_player.MediaStatus.NoMedia:
            print("✅ Original player starts in NoMedia state")
        else:
            print("❌ Original player not in NoMedia state")
            return False
            
        if dialog.trimmed_player.mediaStatus() == dialog.trimmed_player.MediaStatus.NoMedia:
            print("✅ Trimmed player starts in NoMedia state")
        else:
            print("❌ Trimmed player not in NoMedia state")
            return False
        
        # Test reset functionality
        dialog.reset_players()
        
        # Check that players are reset
        if dialog.original_player.mediaStatus() == dialog.original_player.MediaStatus.NoMedia:
            print("✅ Original player reset to NoMedia state")
        else:
            print("❌ Original player not reset properly")
            return False
            
        if dialog.trimmed_player.mediaStatus() == dialog.trimmed_player.MediaStatus.NoMedia:
            print("✅ Trimmed player reset to NoMedia state")
        else:
            print("❌ Trimmed player not reset properly")
            return False
        
        # Clean up
        dialog.close()
        dialog.deleteLater()
        
        print("✅ Media player reset test passed")
        return True
        
    except Exception as e:
        print(f"❌ Player reset test failed: {e}")
        return False

def main():
    """Run all preview repeat tests"""
    print("Testing Audio Preview Repeat Functionality")
    print("=" * 45)
    
    tests = [
        ("Preview Dialog Repeat", test_preview_repeat),
        ("Media Player Reset", test_player_reset),
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
        print("🎉 All preview repeat tests passed!")
        return True
    else:
        print("⚠️  Some preview repeat tests failed")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1) 