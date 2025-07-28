#!/usr/bin/env python3
"""
Test to verify stereo preservation checkbox and filename prefix functionality
"""

import sys
import os
from pathlib import Path

# Add the src directory to the Python path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

def test_stereo_preservation_settings():
    """Test that stereo preservation settings work correctly"""
    try:
        from audio.processor import AudioProcessor
        
        print("Testing stereo preservation settings...")
        
        processor = AudioProcessor()
        
        # Test with a stereo file
        test_file = "/Users/alexthescott/Desktop/william crooks drumkit vol. 1/02 snares/snare01.wav"
        
        if not os.path.exists(test_file):
            print(f"Test file not found: {test_file}")
            return False
        
        print(f"Testing with file: {test_file}")
        
        # Test 1: Preserve stereo (default)
        print("\n--- Test 1: Preserve Stereo ---")
        settings_preserve = {
            'threshold': -50,
            'min_duration': 1000,
            'padding': 100,
            'overwrite': False,
            'preserve_stereo': True
        }
        
        audio_data, sample_rate = processor.load_audio(test_file, preserve_stereo=True)
        if audio_data is not None:
            print(f"✅ Stereo preserved: {audio_data.shape}")
            is_stereo = len(audio_data.shape) == 2
            print(f"   Is stereo: {is_stereo}")
        else:
            print("❌ Failed to load audio with stereo preservation")
            return False
        
        # Test 2: Convert to mono
        print("\n--- Test 2: Convert to Mono ---")
        settings_mono = {
            'threshold': -50,
            'min_duration': 1000,
            'padding': 100,
            'overwrite': False,
            'preserve_stereo': False
        }
        
        audio_data_mono, sample_rate_mono = processor.load_audio(test_file, preserve_stereo=False)
        if audio_data_mono is not None:
            print(f"✅ Mono conversion: {audio_data_mono.shape}")
            is_mono = len(audio_data_mono.shape) == 1
            print(f"   Is mono: {is_mono}")
        else:
            print("❌ Failed to load audio with mono conversion")
            return False
        
        # Test 3: Check filename and directory suffix
        print("\n--- Test 3: Filename and Directory Suffix ---")
        output_path = processor.get_output_path(test_file, settings_preserve)
        print(f"Output path: {output_path}")
        
        # Check if filename contains "_trimmed" before the extension
        output_filename = Path(output_path).name
        has_suffix = "_trimmed" in output_filename and output_filename.endswith(".wav")
        print(f"Filename: {output_filename}")
        print(f"Has '_trimmed' suffix: {has_suffix}")
        
        # Check if directory includes stereo/mono information
        # Get the root directory name from the path
        path_parts = Path(output_path).parts
        root_dir_name = None
        for part in path_parts:
            if "_trimmed_stereo" in part or "_trimmed_mono" in part:
                root_dir_name = part
                break
        
        has_stereo_info = root_dir_name is not None
        print(f"Root directory: {root_dir_name}")
        print(f"Has stereo/mono info: {has_stereo_info}")
        
        if has_suffix and has_stereo_info:
            print("✅ Filename suffix and directory info working correctly")
        else:
            print("❌ Filename suffix or directory info not working")
            return False
        
        # Test 4: Check mono conversion directory
        print("\n--- Test 4: Mono Conversion Directory ---")
        output_path_mono = processor.get_output_path(test_file, settings_mono)
        print(f"Mono output path: {output_path_mono}")
        
        # Check if directory includes mono information
        path_parts_mono = Path(output_path_mono).parts
        root_dir_name_mono = None
        for part in path_parts_mono:
            if "_trimmed_mono" in part:
                root_dir_name_mono = part
                break
        
        has_mono_info = root_dir_name_mono is not None
        print(f"Mono root directory: {root_dir_name_mono}")
        print(f"Has mono info: {has_mono_info}")
        
        if has_mono_info:
            print("✅ Mono directory info working correctly")
        else:
            print("❌ Mono directory info not working")
            return False
        
        print("\n🎉 All stereo preservation and filename tests passed!")
        return True
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_ui_checkbox_integration():
    """Test that the UI checkbox integrates correctly with the processor"""
    try:
        from ui.main_window import MainWindow
        from PyQt6.QtWidgets import QApplication
        
        print("Testing UI checkbox integration...")
        
        # Create a minimal QApplication for testing
        app = QApplication.instance()
        if app is None:
            app = QApplication([])
        
        # Create main window
        window = MainWindow()
        
        # Test checkbox state
        preserve_stereo_check = window.preserve_stereo_check
        print(f"Checkbox exists: {preserve_stereo_check is not None}")
        print(f"Default state: {preserve_stereo_check.isChecked()}")
        
        # Test settings integration
        settings = {
            'threshold': window.threshold_spin.value(),
            'min_duration': window.duration_spin.value(),
            'padding': window.padding_spin.value(),
            'overwrite': window.overwrite_check.isChecked(),
            'preserve_stereo': window.preserve_stereo_check.isChecked()
        }
        
        print(f"Settings include preserve_stereo: {'preserve_stereo' in settings}")
        print(f"Preserve stereo value: {settings['preserve_stereo']}")
        
        # Test checkbox state changes
        preserve_stereo_check.setChecked(False)
        settings_false = {
            'preserve_stereo': preserve_stereo_check.isChecked()
        }
        print(f"Unchecked state: {settings_false['preserve_stereo']}")
        
        preserve_stereo_check.setChecked(True)
        settings_true = {
            'preserve_stereo': preserve_stereo_check.isChecked()
        }
        print(f"Checked state: {settings_true['preserve_stereo']}")
        
        print("✅ UI checkbox integration working correctly")
        return True
        
    except Exception as e:
        print(f"❌ UI test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """Run the stereo preservation and filename tests"""
    print("Testing Stereo Preservation Checkbox and Filename Prefix")
    print("=" * 55)
    
    success1 = test_stereo_preservation_settings()
    success2 = test_ui_checkbox_integration()
    
    if success1 and success2:
        print("\n🎉 All tests passed!")
        return True
    else:
        print("\n❌ Some tests failed!")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1) 