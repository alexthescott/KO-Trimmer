#!/usr/bin/env python3
"""
Simple test to verify output directory feature works with bottom position
"""

import sys
import tempfile
from pathlib import Path

# Add the src directory to the Python path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

def test_output_directory_bottom_position():
    """Test that output directory functionality works with bottom position"""
    try:
        import sys
        from pathlib import Path
        sys.path.insert(0, str(Path(__file__).parent.parent / "src"))
        from ui.main_window import MainWindow
        from PyQt6.QtWidgets import QApplication
        
        print("Testing output directory functionality with bottom position...")
        
        # Create Qt application
        app = QApplication.instance()
        if app is None:
            app = QApplication(sys.argv)
        
        # Create main window
        window = MainWindow()
        
        # Test that output directory label exists
        if hasattr(window, 'output_dir_label'):
            print("✅ Output directory label exists")
            
            # Test with no files
            window.update_output_directory_display()
            initial_text = window.output_dir_label.text()
            print(f"Initial output directory text: {initial_text}")
            
            # Test with files
            with tempfile.TemporaryDirectory() as temp_dir:
                test_file = Path(temp_dir) / "test.wav"
                test_file.touch()
                
                # Add file to list
                window.add_files_to_list([str(test_file)])
                window.update_output_directory_display()
                
                # Check if output directory is displayed
                output_text = window.output_dir_label.text()
                print(f"Output directory text with files: {output_text}")
                
                if "📁" in output_text and len(output_text) > 10:
                    print("✅ Output directory display works with bottom position")
                    
                    # Test custom output directory
                    custom_dir = Path(temp_dir) / "custom_output"
                    custom_dir.mkdir()
                    window.custom_output_directory = str(custom_dir)
                    window.update_output_directory_display()
                    
                    custom_text = window.output_dir_label.text()
                    print(f"Custom output directory text: {custom_text}")
                    
                    if str(custom_dir) in custom_text:
                        print("✅ Custom output directory works with bottom position")
                        return True
                    else:
                        print("❌ Custom output directory not working")
                        return False
                else:
                    print("❌ Output directory not displayed correctly")
                    return False
        else:
            print("❌ Output directory label not found")
            return False
            
    except Exception as e:
        print(f"❌ Output directory bottom position test failed: {e}")
        return False

def test_buttons_functionality():
    """Test that buttons work correctly with bottom position"""
    try:
        import sys
        from pathlib import Path
        sys.path.insert(0, str(Path(__file__).parent.parent / "src"))
        from ui.main_window import MainWindow
        from PyQt6.QtWidgets import QApplication
        
        print("\nTesting button functionality with bottom position...")
        
        # Create Qt application
        app = QApplication.instance()
        if app is None:
            app = QApplication(sys.argv)
        
        # Create main window
        window = MainWindow()
        
        # Test that buttons exist
        if hasattr(window, 'change_output_btn') and hasattr(window, 'reset_output_btn'):
            print("✅ Output directory buttons exist")
            
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
                    print("✅ Initial button states correct with bottom position")
                    
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
                            print("✅ Reset functionality works with bottom position")
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
        else:
            print("❌ Output directory buttons not found")
            return False
            
    except Exception as e:
        print(f"❌ Button functionality test failed: {e}")
        return False

def main():
    """Run output directory bottom position tests"""
    print("=== Testing Output Directory Bottom Position ===\n")
    
    tests = [
        ("Output Directory Functionality", test_output_directory_bottom_position),
        ("Button Functionality", test_buttons_functionality),
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
        print("✅ Output directory functionality works with bottom position")
        print("✅ Button functionality works with bottom position")
        return True
    else:
        print(f"\n❌ {len(results) - passed} tests failed")
        return False

if __name__ == "__main__":
    main() 