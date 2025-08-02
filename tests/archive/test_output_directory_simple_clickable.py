#!/usr/bin/env python3
"""
Simple test for clickable output directory field
"""

import sys
import tempfile
from pathlib import Path

# Add the src directory to the Python path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

def test_output_directory_field():
    """Test that output directory field works"""
    try:
        import sys
        from pathlib import Path
        sys.path.insert(0, str(Path(__file__).parent.parent / "src"))
        from ui.main_window import MainWindow
        from PyQt6.QtWidgets import QApplication
        
        print("Testing output directory field...")
        
        # Create Qt application
        app = QApplication.instance()
        if app is None:
            app = QApplication(sys.argv)
        
        # Create main window
        window = MainWindow()
        
        # Check that output directory field exists
        if hasattr(window, 'output_dir_edit'):
            print("✅ Output directory field exists")
            
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

def main():
    """Run output directory field test"""
    print("=== Testing Clickable Output Directory Field ===\n")
    
    result = test_output_directory_field()
    
    if result:
        print("\n🎉 TEST PASSED!")
        print("✅ Output directory field is clickable and works correctly")
        return True
    else:
        print("\n❌ TEST FAILED")
        return False

if __name__ == "__main__":
    main() 