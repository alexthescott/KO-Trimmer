#!/usr/bin/env python3
"""
Test to verify the output directory panel is positioned at the bottom
"""

import sys
import tempfile
from pathlib import Path

# Add the src directory to the Python path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

def test_output_directory_position():
    """Test that output directory panel is at the bottom of the right panel"""
    try:
        import sys
        from pathlib import Path
        sys.path.insert(0, str(Path(__file__).parent.parent / "src"))
        from ui.main_window import MainWindow
        from PyQt6.QtWidgets import QApplication
        
        print("Testing output directory panel position...")
        
        # Create Qt application
        app = QApplication.instance()
        if app is None:
            app = QApplication(sys.argv)
        
        # Create main window
        window = MainWindow()
        
        # Get the control panel (right panel)
        control_panel = window.findChild(window.__class__, "control_panel")
        if not control_panel:
            # Try to find it by looking at the layout
            central_widget = window.centralWidget()
            if central_widget:
                layout = central_widget.layout()
                if layout:
                    # The control panel should be the second widget in the splitter
                    control_panel = layout.itemAt(1).widget()
        
        if control_panel:
            # Get the layout of the control panel
            control_layout = control_panel.layout()
            
            if control_layout:
                # Check that the output directory group is the last widget
                last_item = control_layout.itemAt(control_layout.count() - 1)
                if last_item and last_item.widget():
                    last_widget = last_item.widget()
                    if hasattr(last_widget, 'title') and last_widget.title() == "Output Directory":
                        print("✅ Output directory panel is at the bottom")
                        return True
                    else:
                        print(f"❌ Last widget is not output directory: {last_widget}")
                        return False
                else:
                    print("❌ No last item in control layout")
                    return False
            else:
                print("❌ No control layout found")
                return False
        else:
            print("❌ Control panel not found")
            return False
            
    except Exception as e:
        print(f"❌ Output directory position test failed: {e}")
        return False

def test_panel_order():
    """Test the order of panels in the control panel"""
    try:
        import sys
        from pathlib import Path
        sys.path.insert(0, str(Path(__file__).parent.parent / "src"))
        from ui.main_window import MainWindow
        from PyQt6.QtWidgets import QApplication
        
        print("\nTesting panel order...")
        
        # Create Qt application
        app = QApplication.instance()
        if app is None:
            app = QApplication(sys.argv)
        
        # Create main window
        window = MainWindow()
        
        # Get the control panel
        central_widget = window.centralWidget()
        if central_widget:
            layout = central_widget.layout()
            if layout:
                control_panel = layout.itemAt(1).widget()
                
                if control_panel:
                    control_layout = control_panel.layout()
                    
                    if control_layout:
                        # Check the order of widgets
                        widget_titles = []
                        for i in range(control_layout.count()):
                            item = control_layout.itemAt(i)
                            if item and item.widget():
                                widget = item.widget()
                                if hasattr(widget, 'title'):
                                    widget_titles.append(widget.title())
                        
                        print(f"Panel order: {widget_titles}")
                        
                        # Expected order: Settings, Processing, Output Directory
                        expected_order = ["Silence Detection Settings", "Processing", "Output Directory"]
                        
                        if widget_titles == expected_order:
                            print("✅ Panel order is correct")
                            return True
                        else:
                            print(f"❌ Panel order incorrect. Expected: {expected_order}, Got: {widget_titles}")
                            return False
                    else:
                        print("❌ No control layout")
                        return False
                else:
                    print("❌ No control panel")
                    return False
            else:
                print("❌ No central layout")
                return False
        else:
            print("❌ No central widget")
            return False
            
    except Exception as e:
        print(f"❌ Panel order test failed: {e}")
        return False

def main():
    """Run output directory position tests"""
    print("=== Testing Output Directory Panel Position ===\n")
    
    tests = [
        ("Output Directory Position", test_output_directory_position),
        ("Panel Order", test_panel_order),
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
        print("✅ Output directory panel is positioned at the bottom")
        print("✅ Panel order is correct")
        return True
    else:
        print(f"\n❌ {len(results) - passed} tests failed")
        return False

if __name__ == "__main__":
    main() 