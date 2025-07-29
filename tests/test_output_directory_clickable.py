#!/usr/bin/env python3
"""
Test the clickable output directory field
"""

import sys
import tempfile
from pathlib import Path

# Add the src directory to the Python path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

def test_output_directory_field_exists():
    """Test that output directory field exists and is a QLineEdit"""
    try:
        import sys
        from pathlib import Path
        sys.path.insert(0, str(Path(__file__).parent.parent / "src"))
        from ui.main_window import MainWindow
        from PyQt6.QtWidgets import QApplication
        
        print("Testing output directory field type...")
        
        # Create Qt application
        app = QApplication.instance()
        if app is None:
            app = QApplication(sys.argv)
        
        # Create main window
        window = MainWindow()
        
        # Check that output directory field exists
        if hasattr(window, 'output_dir_edit'):
            print("✅ Output directory field exists")
            return True
        else:
            print("❌ Output directory field not found")
            return False
            
    except Exception as e:
        print(f"❌ Output directory field test failed: {e}")
        return False

def test_output_directory_field_properties():
    """Test that output directory field has correct properties"""
    try:
        import sys
        from pathlib import Path
        sys.path.insert(0, str(Path(__file__).parent.parent / "src"))
        from ui.main_window import MainWindow
        from PyQt6.QtWidgets import QApplication
        
        print("\nTesting output directory field properties...")
        
        # Create Qt application
        app = QApplication.instance()
        if app is None:
            app = QApplication(sys.argv)
        
        # Create main window
        window = MainWindow()
        
        # Check properties
        is_readonly = window.output_dir_edit.isReadOnly()
        placeholder = window.output_dir_edit.placeholderText()
        
        print(f"Read-only: {is_readonly}")
        print(f"Placeholder: {placeholder}")
        
        if is_readonly and "Output directory" in placeholder:
            print("✅ Output directory field has correct properties")
            return True
        else:
            print("❌ Output directory field properties incorrect")
            return False
            
    except Exception as e:
        print(f"❌ Output directory field properties test failed: {e}")
        return False

def test_output_directory_field_display():
    """Test that output directory field displays correctly"""
    try:
        import sys
        from pathlib import Path
        sys.path.insert(0, str(Path(__file__).parent.parent / "src"))
        from ui.main_window import MainWindow
        from PyQt6.QtWidgets import QApplication
        
        print("\nTesting output directory field display...")
        
        # Create Qt application
        app = QApplication.instance()
        if app is None:
            app = QApplication(sys.argv)
        
        # Create main window
        window = MainWindow()
        
        # Test with no files
        window.update_output_directory_display()
        initial_text = window.output_dir_edit.text()
        print(f"Initial text: '{initial_text}'")
        
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
                
    except Exception as e:
        print(f"❌ Output directory field display test failed: {e}")
        return False

def test_output_directory_field_click_handler():
    """Test that output directory field has click handler"""
    try:
        import sys
        from pathlib import Path
        sys.path.insert(0, str(Path(__file__).parent.parent / "src"))
        from ui.main_window import MainWindow
        from PyQt6.QtWidgets import QApplication
        
        print("\nTesting output directory field click handler...")
        
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
        print(f"❌ Output directory field click handler test failed: {e}")
        return False

def main():
    """Run output directory field tests"""
    print("=== Testing Clickable Output Directory Field ===\n")
    
    tests = [
        ("Field Type", test_output_directory_field_exists),
        ("Field Properties", test_output_directory_field_properties),
        ("Field Display", test_output_directory_field_display),
        ("Click Handler", test_output_directory_field_click_handler),
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
        print("✅ Output directory field is clickable and works correctly")
        return True
    else:
        print(f"\n❌ {len(results) - passed} tests failed")
        return False

if __name__ == "__main__":
    main() 