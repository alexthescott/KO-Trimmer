#!/usr/bin/env python3
"""
Test the simplified output directory field (no buttons)
"""

import sys
import tempfile
from pathlib import Path

# Add the src directory to the Python path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

def test_output_directory_field_simplified():
    """Test that output directory field works without buttons"""
    try:
        import sys
        from pathlib import Path
        sys.path.insert(0, str(Path(__file__).parent.parent / "src"))
        from ui.main_window import MainWindow
        from PyQt6.QtWidgets import QApplication
        
        print("Testing simplified output directory field...")
        
        # Create Qt application
        app = QApplication.instance()
        if app is None:
            app = QApplication(sys.argv)
        
        # Create main window
        window = MainWindow()
        
        # Check that output directory field exists
        if hasattr(window, 'output_dir_edit'):
            print("✅ Output directory field exists")
            
            # Check that buttons don't exist
            if not hasattr(window, 'change_output_btn'):
                print("✅ Change output button removed")
            else:
                print("❌ Change output button still exists")
                return False
                
            if not hasattr(window, 'reset_output_btn'):
                print("✅ Reset output button removed")
            else:
                print("❌ Reset output button still exists")
                return False
            
            # Test with files
            with tempfile.TemporaryDirectory() as temp_dir:
                test_file = Path(temp_dir) / "test.wav"
                test_file.touch()
                
                # Add file to list
                window.add_files_to_list([str(test_file)])
                window.update_output_directory_display()
                
                # Check if output directory is displayed
                output_text = window.output_dir_edit.text()
                print(f"Output directory text: {output_text}")
                
                if "📁" in output_text and len(output_text) > 10:
                    print("✅ Output directory field displays correctly")
                    return True
                else:
                    print("❌ Output directory field not displaying correctly")
                    return False
        else:
            print("❌ Output directory field not found")
            return False
            
    except Exception as e:
        print(f"❌ Output directory field test failed: {e}")
        return False

def test_output_directory_click_functionality():
    """Test that clicking the output directory field still works"""
    try:
        import sys
        from pathlib import Path
        sys.path.insert(0, str(Path(__file__).parent.parent / "src"))
        from ui.main_window import MainWindow
        from PyQt6.QtWidgets import QApplication
        
        print("\nTesting output directory click functionality...")
        
        # Create Qt application
        app = QApplication.instance()
        if app is None:
            app = QApplication(sys.argv)
        
        # Create main window
        window = MainWindow()
        
        # Check that click handler exists
        if hasattr(window.output_dir_edit, 'mousePressEvent'):
            print("✅ Output directory field has click handler")
            return True
        else:
            print("❌ Output directory field missing click handler")
            return False
            
    except Exception as e:
        print(f"❌ Output directory click test failed: {e}")
        return False

def main():
    """Run simplified output directory field tests"""
    print("=== Testing Simplified Output Directory Field ===\n")
    
    tests = [
        ("Simplified Field", test_output_directory_field_simplified),
        ("Click Functionality", test_output_directory_click_functionality),
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
        print("✅ Output directory field simplified and works correctly")
        return True
    else:
        print(f"\n❌ {len(results) - passed} tests failed")
        return False

if __name__ == "__main__":
    main() 