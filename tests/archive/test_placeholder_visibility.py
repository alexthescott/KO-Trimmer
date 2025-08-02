#!/usr/bin/env python3
"""
Test that placeholder text is visible in the unified drag-drop area
"""

import sys
import tempfile
from pathlib import Path

# Add the src directory to the Python path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

def test_placeholder_visibility():
    """Test that placeholder text is visible when no files are loaded"""
    try:
        import sys
        from pathlib import Path
        sys.path.insert(0, str(Path(__file__).parent.parent / "src"))
        from ui.main_window import MainWindow
        from PyQt6.QtWidgets import QApplication
        
        print("Testing placeholder text visibility...")
        
        # Create Qt application
        app = QApplication.instance()
        if app is None:
            app = QApplication(sys.argv)
        
        # Create main window
        window = MainWindow()
        
        # Check that placeholder text is visible
        if window.file_list.count() == 1:
            placeholder_item = window.file_list.item(0)
            placeholder_text = placeholder_item.text()
            
            print(f"Placeholder text: '{placeholder_text}'")
            
            if "Drop audio files" in placeholder_text and "Add Files" in placeholder_text and "Add Folder" in placeholder_text:
                print("✅ Placeholder text contains expected content")
                
                # Check if item is properly formatted
                from PyQt6.QtCore import Qt
                if placeholder_item.flags() == Qt.ItemFlag.NoItemFlags:
                    print("✅ Placeholder item is non-selectable")
                    return True
                else:
                    print(f"❌ Placeholder item flags: {placeholder_item.flags()}, expected: {Qt.ItemFlag.NoItemFlags}")
                    return False
            else:
                print("❌ Placeholder text missing expected content")
                return False
        else:
            print(f"❌ Expected 1 item, found {window.file_list.count()}")
            return False
                
    except Exception as e:
        print(f"❌ Placeholder visibility test failed: {e}")
        return False

def test_placeholder_after_clear():
    """Test that placeholder text reappears after clearing files"""
    try:
        import sys
        from pathlib import Path
        sys.path.insert(0, str(Path(__file__).parent.parent / "src"))
        from ui.main_window import MainWindow
        from PyQt6.QtWidgets import QApplication
        
        print("\nTesting placeholder text after clearing files...")
        
        # Create Qt application
        app = QApplication.instance()
        if app is None:
            app = QApplication(sys.argv)
        
        # Create main window
        window = MainWindow()
        
        # Add a file
        with tempfile.TemporaryDirectory() as temp_dir:
            test_file = Path(temp_dir) / "test.wav"
            test_file.touch()
            
            window.add_files_to_list([str(test_file)])
            
            # Verify file was added
            if window.file_list.count() == 1:
                print("✅ File added successfully")
            else:
                print("❌ File not added")
                return False
            
            # Clear files
            window.clear_files()
            
            # Check placeholder reappears
            if window.file_list.count() == 1:
                placeholder_text = window.file_list.item(0).text()
                if "Drop audio files" in placeholder_text:
                    print("✅ Placeholder text reappears after clearing")
                    return True
                else:
                    print(f"❌ Unexpected text after clearing: {placeholder_text}")
                    return False
            else:
                print(f"❌ Expected 1 item after clearing, found {window.file_list.count()}")
                return False
                
    except Exception as e:
        print(f"❌ Placeholder after clear test failed: {e}")
        return False

def main():
    """Run placeholder visibility tests"""
    print("=== Testing Placeholder Text Visibility ===\n")
    
    tests = [
        ("Placeholder Visibility", test_placeholder_visibility),
        ("Placeholder After Clear", test_placeholder_after_clear),
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
        print("✅ Placeholder text is visible and working correctly")
        return True
    else:
        print(f"\n❌ {len(results) - passed} tests failed")
        return False

if __name__ == "__main__":
    main() 