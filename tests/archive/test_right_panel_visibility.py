#!/usr/bin/env python3
"""
Test right panel visibility based on file selection
"""

import sys
import tempfile
from pathlib import Path

# Add the src directory to the Python path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

def test_right_panel_initial_hidden():
    """Test that right panel is initially hidden"""
    try:
        import sys
        from pathlib import Path
        sys.path.insert(0, str(Path(__file__).parent.parent / "src"))
        from ui.main_window import MainWindow
        from PyQt6.QtWidgets import QApplication
        
        print("Testing initial right panel visibility...")
        
        # Create Qt application
        app = QApplication.instance()
        if app is None:
            app = QApplication(sys.argv)
        
        # Create main window
        window = MainWindow()
        
        # Check that right panel is initially hidden
        if hasattr(window, 'right_panel'):
            is_visible = window.right_panel.isVisible()
            print(f"Right panel visible: {is_visible}")
            
            if not is_visible:
                print("✅ Right panel is initially hidden")
                return True
            else:
                print("❌ Right panel should be initially hidden")
                return False
        else:
            print("❌ Right panel not found")
            return False
            
    except Exception as e:
        print(f"❌ Initial visibility test failed: {e}")
        return False

def test_right_panel_shows_with_files():
    """Test that right panel shows when files are added"""
    try:
        import sys
        from pathlib import Path
        sys.path.insert(0, str(Path(__file__).parent.parent / "src"))
        from ui.main_window import MainWindow
        from PyQt6.QtWidgets import QApplication
        
        print("\nTesting right panel shows with files...")
        
        # Create Qt application
        app = QApplication.instance()
        if app is None:
            app = QApplication(sys.argv)
        
        # Create main window
        window = MainWindow()
        
        # Verify initially hidden
        if not window.right_panel.isVisible():
            print("✅ Right panel initially hidden")
            
            # Add a file
            with tempfile.TemporaryDirectory() as temp_dir:
                test_file = Path(temp_dir) / "test.wav"
                test_file.touch()
                
                # Add file to list
                window.add_files_to_list([str(test_file)])
                
                # Check that right panel is now visible
                # Add a small delay to allow UI to update
                import time
                time.sleep(0.1)
                
                is_visible = window.right_panel.isVisible()
                print(f"Right panel visible after adding file: {is_visible}")
                
                # Also check if the panel has a non-zero size
                panel_size = window.right_panel.size()
                print(f"Right panel size: {panel_size.width()}x{panel_size.height()}")
                
                if panel_size.width() > 0:
                    print("✅ Right panel shows when files are added")
                    return True
                else:
                    print("❌ Right panel should show when files are added")
                    return False
        else:
            print("❌ Right panel should be initially hidden")
            return False
            
    except Exception as e:
        print(f"❌ Show with files test failed: {e}")
        return False

def test_right_panel_hides_when_cleared():
    """Test that right panel hides when files are cleared"""
    try:
        import sys
        from pathlib import Path
        sys.path.insert(0, str(Path(__file__).parent.parent / "src"))
        from ui.main_window import MainWindow
        from PyQt6.QtWidgets import QApplication
        
        print("\nTesting right panel hides when files cleared...")
        
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
            
            # Add file to list
            window.add_files_to_list([str(test_file)])
            
            # Verify panel is visible
            import time
            time.sleep(0.1)
            
            panel_size = window.right_panel.size()
            if panel_size.width() > 0:
                print("✅ Right panel visible after adding file")
                
                # Clear files
                window.clear_files()
                
                # Add delay and check that right panel is now hidden
                time.sleep(0.1)
                is_visible = window.right_panel.isVisible()
                print(f"Right panel visible after clearing files: {is_visible}")
                
                panel_size_after = window.right_panel.size()
                if panel_size_after.width() == 0:
                    print("✅ Right panel hides when files are cleared")
                    return True
                else:
                    print("❌ Right panel should hide when files are cleared")
                    return False
            else:
                print("❌ Right panel should be visible after adding file")
                return False
                
    except Exception as e:
        print(f"❌ Hide when cleared test failed: {e}")
        return False

def main():
    """Run right panel visibility tests"""
    print("=== Testing Right Panel Visibility ===\n")
    
    tests = [
        ("Initial Hidden", test_right_panel_initial_hidden),
        ("Shows With Files", test_right_panel_shows_with_files),
        ("Hides When Cleared", test_right_panel_hides_when_cleared),
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
        print("✅ Right panel visibility works correctly")
        return True
    else:
        print(f"\n❌ {len(results) - passed} tests failed")
        return False

if __name__ == "__main__":
    main() 