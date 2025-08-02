"""
Test display name functionality for favorites
"""

import sys
import os
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from PyQt6.QtWidgets import QApplication
from ui.favorites_sidebar import FavoritesSidebar
from ui.welcome_dialog import WelcomeDialog


def test_display_names():
    """Test the display name creation functionality"""
    app = QApplication(sys.argv)
    
    print("🧪 Testing Display Names...")
    
    # Test paths
    test_paths = [
        "/Users/alexthescott/Desktop/william crooks drumkit vol. 1",
        "/Users/alexthescott/Desktop/MF DOOM Drumkit", 
        "/Users/alexthescott/Documents/Programming/TrimVibe",
        "/Users/alexthescott/Library/Audio/Samples",
        "/Volumes/External/My Samples",
        "/Users/alexthescott/Desktop/Samples/Drums/Kicks"
    ]
    
    # Test favorites sidebar
    sidebar = FavoritesSidebar()
    
    print("📁 Testing Favorites Sidebar Display Names:")
    for path in test_paths:
        display_name = sidebar._create_display_name(path)
        print(f"  {path}")
        print(f"  → {display_name}")
        print()
    
    # Test welcome dialog
    dialog = WelcomeDialog()
    
    print("📁 Testing Welcome Dialog Display Names:")
    for path in test_paths:
        display_name = dialog._create_display_name(path)
        print(f"  {path}")
        print(f"  → {display_name}")
        print()
    
    print("✅ Display name tests completed!")


if __name__ == "__main__":
    test_display_names() 