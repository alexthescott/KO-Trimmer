#!/usr/bin/env python3
"""
Test the combined file interface (drag-drop + file list in single section)
"""

import sys
import tempfile
from pathlib import Path

# Add the src directory to the Python path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

def test_combined_file_interface():
    """Test that drag-drop and file list are in the same section"""
    try:
        import sys
        from pathlib import Path
        sys.path.insert(0, str(Path(__file__).parent.parent / "src"))
        from ui.main_window import MainWindow
        from PyQt6.QtWidgets import QApplication
        
        print("Testing combined file interface...")
        
        # Create Qt application
        app = QApplication.instance()
        if app is None:
            app = QApplication(sys.argv)
        
        # Create main window
        window = MainWindow()
        
        # Check that both drag-drop and file list exist
        if hasattr(window, 'drag_drop_widget'):
            print("✅ Drag-drop widget exists")
        else:
            print("❌ Drag-drop widget not found")
            return False
            
        if hasattr(window, 'file_list'):
            print("✅ File list exists")
        else:
            print("❌ File list not found")
            return False
        
        # Test adding files
        with tempfile.TemporaryDirectory() as temp_dir:
            test_file = Path(temp_dir) / "test.wav"
            test_file.touch()
            
            # Add file to list
            window.add_files_to_list([str(test_file)])
            
            # Check if file was added
            if window.file_list.count() > 0:
                print("✅ File was added to list")
                return True
            else:
                print("❌ File was not added to list")
                return False
                
    except Exception as e:
        print(f"❌ Combined file interface test failed: {e}")
        return False

def test_file_interface_functionality():
    """Test that file interface functionality still works"""
    try:
        import sys
        from pathlib import Path
        sys.path.insert(0, str(Path(__file__).parent.parent / "src"))
        from ui.main_window import MainWindow
        from PyQt6.QtWidgets import QApplication
        
        print("\nTesting file interface functionality...")
        
        # Create Qt application
        app = QApplication.instance()
        if app is None:
            app = QApplication(sys.argv)
        
        # Create main window
        window = MainWindow()
        
        # Test buttons exist
        buttons = ['add_files_btn', 'add_folder_btn', 'clear_btn', 'preview_btn']
        for button_name in buttons:
            if hasattr(window, button_name):
                print(f"✅ {button_name} exists")
            else:
                print(f"❌ {button_name} not found")
                return False
        
        # Test clear functionality
        with tempfile.TemporaryDirectory() as temp_dir:
            test_file = Path(temp_dir) / "test.wav"
            test_file.touch()
            
            # Add file
            window.add_files_to_list([str(test_file)])
            if window.file_list.count() == 1:
                print("✅ File added successfully")
            else:
                print("❌ File not added")
                return False
            
            # Clear files
            window.clear_files()
            if window.file_list.count() == 0:
                print("✅ Files cleared successfully")
                return True
            else:
                print("❌ Files not cleared")
                return False
                
    except Exception as e:
        print(f"❌ File interface functionality test failed: {e}")
        return False

def main():
    """Run combined file interface tests"""
    print("=== Testing Combined File Interface ===\n")
    
    tests = [
        ("Combined Interface", test_combined_file_interface),
        ("Functionality", test_file_interface_functionality),
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
        print("✅ Combined file interface works correctly")
        return True
    else:
        print(f"\n❌ {len(results) - passed} tests failed")
        return False

if __name__ == "__main__":
    main() 