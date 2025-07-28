"""
Debug test for favorites selection
"""

import sys
import os
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from PyQt6.QtWidgets import QApplication
from ui.main_window import MainWindow

def test_favorites_debug():
    """Test favorites selection with debug output"""
    app = QApplication(sys.argv)
    
    print("🧪 Testing Favorites Debug...")
    
    # Create main window
    window = MainWindow()
    
    # Test directory
    test_directory = "/Users/alexthescott/Desktop/Glitch With Friends+"
    
    if os.path.exists(test_directory):
        print(f"📁 Testing with directory: {test_directory}")
        
        # Manually trigger the favorite selection
        print("🎯 Manually calling on_favorite_selected...")
        window.on_favorite_selected(test_directory)
        
        # Check if files were added
        file_count = window.file_list.count()
        print(f"📊 Files in list after selection: {file_count}")
        
        if file_count > 0:
            print("✅ Success! Files were added to the list.")
        else:
            print("❌ No files were added to the list.")
    else:
        print(f"❌ Test directory not found: {test_directory}")
    
    print("🎉 Debug test completed!")

if __name__ == "__main__":
    test_favorites_debug() 