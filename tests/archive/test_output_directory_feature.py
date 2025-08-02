#!/usr/bin/env python3
"""
Test the output directory preview and selection feature
"""

import sys
import os
import tempfile
from pathlib import Path

# Add the src directory to the Python path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

def test_output_directory_display():
    """Test that output directory is displayed correctly"""
    try:
        import sys
        from pathlib import Path
        sys.path.insert(0, str(Path(__file__).parent.parent / "src"))
        from ui.main_window import MainWindow
        from PyQt6.QtWidgets import QApplication
        
        print("Testing output directory display...")
        
        # Create Qt application
        app = QApplication.instance()
        if app is None:
            app = QApplication(sys.argv)
        
        # Create main window
        window = MainWindow()
        
        # Test with no files
        window.update_output_directory_display()
        print("✅ Output directory display works with no files")
        
        # Test with files
        with tempfile.TemporaryDirectory() as temp_dir:
            test_file = Path(temp_dir) / "test.wav"
            test_file.touch()  # Create empty file
            
            # Add file to list
            window.add_files_to_list([str(test_file)])
            window.update_output_directory_display()
            
            # Check if output directory is displayed
            output_text = window.output_dir_label.text()
            print(f"Output directory text: {output_text}")
            
            if "📁" in output_text and len(output_text) > 10:  # Has folder icon and reasonable path
                print("✅ Output directory display works with files")
                return True
            else:
                print("❌ Output directory not displayed correctly")
                return False
                
    except Exception as e:
        print(f"❌ Output directory display test failed: {e}")
        return False

def test_custom_output_directory():
    """Test custom output directory functionality"""
    try:
        import sys
        from pathlib import Path
        sys.path.insert(0, str(Path(__file__).parent.parent / "src"))
        from ui.main_window import MainWindow
        from PyQt6.QtWidgets import QApplication
        
        print("\nTesting custom output directory...")
        
        # Create Qt application
        app = QApplication.instance()
        if app is None:
            app = QApplication(sys.argv)
        
        # Create main window
        window = MainWindow()
        
        with tempfile.TemporaryDirectory() as temp_dir:
            test_file = Path(temp_dir) / "test.wav"
            test_file.touch()
            
            # Add file to list
            window.add_files_to_list([str(test_file)])
            
            # Set custom output directory
            custom_dir = Path(temp_dir) / "custom_output"
            custom_dir.mkdir()
            window.custom_output_directory = str(custom_dir)
            
            # Update display
            window.update_output_directory_display()
            
            # Check if custom directory is displayed
            output_text = window.output_dir_label.text()
            print(f"Custom output directory text: {output_text}")
            
            if str(custom_dir) in output_text:
                print("✅ Custom output directory works")
                return True
            else:
                print("❌ Custom output directory not displayed")
                return False
                
    except Exception as e:
        print(f"❌ Custom output directory test failed: {e}")
        return False

def test_output_directory_buttons():
    """Test output directory buttons functionality"""
    try:
        import sys
        from pathlib import Path
        sys.path.insert(0, str(Path(__file__).parent.parent / "src"))
        from ui.main_window import MainWindow
        from PyQt6.QtWidgets import QApplication
        
        print("\nTesting output directory buttons...")
        
        # Create Qt application
        app = QApplication.instance()
        if app is None:
            app = QApplication(sys.argv)
        
        # Create main window
        window = MainWindow()
        
        with tempfile.TemporaryDirectory() as temp_dir:
            test_file = Path(temp_dir) / "test.wav"
            test_file.touch()
            
            # Add file to list
            window.add_files_to_list([str(test_file)])
            window.update_output_directory_display()
            
            # Check initial button states
            change_enabled = window.change_output_btn.isEnabled()
            reset_enabled = window.reset_output_btn.isEnabled()
            
            print(f"Change button enabled: {change_enabled}")
            print(f"Reset button enabled: {reset_enabled}")
            
            if change_enabled and not reset_enabled:
                print("✅ Initial button states correct")
                
                # Test reset functionality
                window.custom_output_directory = str(Path(temp_dir) / "test_output")
                window.update_output_directory_display()
                
                reset_enabled_after = window.reset_output_btn.isEnabled()
                if reset_enabled_after:
                    print("✅ Reset button enabled when custom directory set")
                    
                    # Test reset
                    window.reset_output_directory()
                    reset_enabled_after_reset = window.reset_output_btn.isEnabled()
                    if not reset_enabled_after_reset:
                        print("✅ Reset functionality works")
                        return True
                    else:
                        print("❌ Reset functionality failed")
                        return False
                else:
                    print("❌ Reset button not enabled")
                    return False
            else:
                print("❌ Initial button states incorrect")
                return False
                
    except Exception as e:
        print(f"❌ Output directory buttons test failed: {e}")
        return False

def test_processor_custom_output():
    """Test that processor handles custom output directory correctly"""
    try:
        from audio.processor import AudioProcessor
        
        print("\nTesting processor custom output directory...")
        
        processor = AudioProcessor()
        
        with tempfile.TemporaryDirectory() as temp_dir:
            # Create test file
            test_file = Path(temp_dir) / "test.wav"
            test_file.touch()
            
            # Test settings
            settings = {
                'threshold': -50,
                'min_duration': 1000,
                'padding': 20,
                'overwrite': False,
                'preserve_stereo': True
            }
            
            # Test without custom output directory
            output_path1 = processor.get_output_path(str(test_file), settings)
            print(f"Default output path: {output_path1}")
            
            # Test with custom output directory
            custom_dir = Path(temp_dir) / "custom_output"
            custom_dir.mkdir()
            output_path2 = processor.get_output_path(str(test_file), settings, str(custom_dir))
            print(f"Custom output path: {output_path2}")
            
            if output_path1 != output_path2 and str(custom_dir) in output_path2:
                print("✅ Processor custom output directory works")
                return True
            else:
                print("❌ Processor custom output directory failed")
                return False
                
    except Exception as e:
        print(f"❌ Processor custom output test failed: {e}")
        return False

def test_overwrite_interaction():
    """Test that overwrite checkbox interacts correctly with output directory"""
    try:
        import sys
        from pathlib import Path
        sys.path.insert(0, str(Path(__file__).parent.parent / "src"))
        from ui.main_window import MainWindow
        from PyQt6.QtWidgets import QApplication
        
        print("\nTesting overwrite checkbox interaction...")
        
        # Create Qt application
        app = QApplication.instance()
        if app is None:
            app = QApplication(sys.argv)
        
        # Create main window
        window = MainWindow()
        
        with tempfile.TemporaryDirectory() as temp_dir:
            test_file = Path(temp_dir) / "test.wav"
            test_file.touch()
            
            # Add file to list
            window.add_files_to_list([str(test_file)])
            
            # Set custom output directory
            custom_dir = Path(temp_dir) / "custom_output"
            window.custom_output_directory = str(custom_dir)
            
            # Test that overwrite clears custom directory
            window.overwrite_check.setChecked(True)
            
            if window.custom_output_directory is None:
                print("✅ Overwrite checkbox clears custom output directory")
                return True
            else:
                print("❌ Overwrite checkbox doesn't clear custom output directory")
                return False
                
    except Exception as e:
        print(f"❌ Overwrite interaction test failed: {e}")
        return False

def main():
    """Run output directory feature tests"""
    print("=== Testing Output Directory Feature ===\n")
    
    tests = [
        ("Output Directory Display", test_output_directory_display),
        ("Custom Output Directory", test_custom_output_directory),
        ("Output Directory Buttons", test_output_directory_buttons),
        ("Processor Custom Output", test_processor_custom_output),
        ("Overwrite Interaction", test_overwrite_interaction),
    ]
    
    results = []
    for test_name, test_func in tests:
        print(f"Running {test_name} test...")
        result = test_func()
        results.append((test_name, result))
        print()
    
    print("=== Test Results ===")
    passed = 0
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{test_name}: {status}")
        if result:
            passed += 1
    
    print(f"\nOverall: {passed}/{len(results)} tests passed")
    
    if passed == len(results):
        print("\n🎉 ALL TESTS PASSED!")
        print("✅ Output directory preview works correctly")
        print("✅ Custom output directory selection works")
        print("✅ Buttons and interactions work properly")
        print("✅ Processor handles custom output directories")
        return True
    else:
        print(f"\n❌ {len(results) - passed} tests failed")
        return False

if __name__ == "__main__":
    main() 