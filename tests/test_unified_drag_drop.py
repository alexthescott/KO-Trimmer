#!/usr/bin/env python3
"""
Test the unified drag-drop and file list functionality
"""

import sys
import tempfile
from pathlib import Path

# Add the src directory to the Python path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

def test_unified_drag_drop_widget():
    """Test that the combined widget exists and works"""
    try:
        import sys
        from pathlib import Path
        sys.path.insert(0, str(Path(__file__).parent.parent / "src"))
        from ui.main_window import MainWindow
        from PyQt6.QtWidgets import QApplication
        
        print("Testing unified drag-drop widget...")
        
        # Create Qt application
        app = QApplication.instance()
        if app is None:
            app = QApplication(sys.argv)
        
        # Create main window
        window = MainWindow()
        
        # Check that combined widget exists
        if hasattr(window, 'combined_file_widget'):
            print("✅ Combined file widget exists")
        else:
            print("❌ Combined file widget not found")
            return False
            
        # Check that file list exists
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
        print(f"❌ Unified drag-drop test failed: {e}")
        return False

def test_unified_drag_drop_functionality():
    """Test that the unified widget functionality works"""
    try:
        import sys
        from pathlib import Path
        sys.path.insert(0, str(Path(__file__).parent.parent / "src"))
        from ui.main_window import MainWindow
        from PyQt6.QtWidgets import QApplication
        
        print("\nTesting unified drag-drop functionality...")
        
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
            if window.file_list.count() == 1:  # Should have placeholder
                print("✅ Files cleared successfully")
                return True
            else:
                print("❌ Files not cleared")
                return False
                
    except Exception as e:
        print(f"❌ Unified drag-drop functionality test failed: {e}")
        return False

def test_unified_drag_drop_placeholder():
    """Test that placeholder text appears when no files"""
    try:
        import sys
        from pathlib import Path
        sys.path.insert(0, str(Path(__file__).parent.parent / "src"))
        from ui.main_window import MainWindow
        from PyQt6.QtWidgets import QApplication
        
        print("\nTesting unified drag-drop placeholder...")
        
        # Create Qt application
        app = QApplication.instance()
        if app is None:
            app = QApplication(sys.argv)
        
        # Create main window
        window = MainWindow()
        
        # Check initial state
        if window.file_list.count() == 1:
            placeholder_text = window.file_list.item(0).text()
            if "Drop audio files" in placeholder_text:
                print("✅ Placeholder text appears correctly")
                return True
            else:
                print(f"❌ Unexpected placeholder text: {placeholder_text}")
                return False
        else:
            print("❌ No placeholder item found")
            return False
                
    except Exception as e:
        print(f"❌ Unified drag-drop placeholder test failed: {e}")
        return False

def main():
    """Run unified drag-drop tests"""
    print("=== Testing Unified Drag-Drop Interface ===\n")
    
    tests = [
        ("Unified Widget", test_unified_drag_drop_widget),
        ("Functionality", test_unified_drag_drop_functionality),
        ("Placeholder", test_unified_drag_drop_placeholder),
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
        print("✅ Unified drag-drop interface works correctly")
        return True
    else:
        print(f"\n❌ {len(results) - passed} tests failed")
        return False

if __name__ == "__main__":
    main() 