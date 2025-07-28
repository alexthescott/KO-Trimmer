"""
Test favorite selection functionality
"""

import sys
import os
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from PyQt6.QtWidgets import QApplication
from ui.main_window import MainWindow


def test_favorite_selection():
    """Test that selecting a favorite populates the file list"""
    app = QApplication(sys.argv)
    
    print("🧪 Testing Favorite Selection...")
    
    # Create main window
    window = MainWindow()
    
    # Test directory with known audio files
    test_directory = "/Users/alexthescott/Desktop/Glitch With Friends+"
    
    if os.path.exists(test_directory):
        print(f"📁 Testing with directory: {test_directory}")
        
        # Simulate selecting a favorite
        window.on_favorite_selected(test_directory)
        
        # Check if files were added to the list
        file_count = window.file_list.count()
        print(f"📊 Files added to list: {file_count}")
        
        if file_count > 0:
            print("✅ Files successfully added to processing list!")
            
            # Show first few files
            print("📋 First few files:")
            for i in range(min(3, file_count)):
                file_path = window.file_list.item(i).text()
                print(f"  {i+1}. {Path(file_path).name}")
        else:
            print("⚠️ No files were added to the list")
    else:
        print(f"⚠️ Test directory not found: {test_directory}")
    
    print("✅ Favorite selection test completed!")


if __name__ == "__main__":
    test_favorite_selection() 