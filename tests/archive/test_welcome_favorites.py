"""
Test welcome dialog and favorites system
"""

import sys
import os
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from PyQt6.QtWidgets import QApplication
from ui.welcome_dialog import WelcomeDialog
from ui.favorites_sidebar import FavoritesSidebar
from utils.settings_manager import SettingsManager


def test_welcome_dialog():
    """Test the welcome dialog"""
    app = QApplication(sys.argv)
    
    print("🧪 Testing Welcome Dialog...")
    
    # Create welcome dialog
    dialog = WelcomeDialog()
    
    # Test initial state
    assert dialog.get_favorites() == []
    assert dialog.should_show_welcome() == True
    
    print("✅ Welcome dialog created successfully")
    print("✅ Initial state is correct")
    
    # Test adding favorites (this would require user interaction in real test)
    print("📝 Note: To test adding favorites, you would need to:")
    print("   1. Click 'Add Directory' button")
    print("   2. Select a directory")
    print("   3. Verify it appears in the list")
    
    # Test dialog execution (commented out to avoid blocking)
    # result = dialog.exec()
    # print(f"Dialog result: {result}")
    
    print("✅ Welcome dialog test completed")


def test_favorites_sidebar():
    """Test the favorites sidebar"""
    app = QApplication(sys.argv)
    
    print("🧪 Testing Favorites Sidebar...")
    
    # Create favorites sidebar
    sidebar = FavoritesSidebar()
    
    # Test initial state
    assert sidebar.get_favorites() == []
    
    print("✅ Favorites sidebar created successfully")
    print("✅ Initial state is correct")
    
    # Test setting favorites
    test_favorites = [
        "/Users/alexthescott/Desktop/william crooks drumkit vol. 1",
        "/Users/alexthescott/Desktop/MF DOOM Drumkit"
    ]
    
    sidebar.set_favorites(test_favorites)
    current_favorites = sidebar.get_favorites()
    
    print(f"✅ Set favorites: {current_favorites}")
    
    # Test adding favorite (this would require user interaction)
    print("📝 Note: To test adding favorites, you would need to:")
    print("   1. Click the '+' button")
    print("   2. Select a directory")
    print("   3. Verify it appears in the list")
    
    print("✅ Favorites sidebar test completed")


def test_settings_manager():
    """Test the settings manager"""
    print("🧪 Testing Settings Manager...")
    
    # Create settings manager
    settings_manager = SettingsManager()
    
    # Test loading/saving favorites
    test_favorites = [
        "/Users/alexthescott/Desktop/william crooks drumkit vol. 1",
        "/Users/alexthescott/Desktop/MF DOOM Drumkit"
    ]
    
    settings_manager.save_favorites(test_favorites)
    loaded_favorites = settings_manager.load_favorites()
    
    print(f"✅ Saved favorites: {test_favorites}")
    print(f"✅ Loaded favorites: {loaded_favorites}")
    
    # Test show welcome setting
    settings_manager.save_show_welcome(False)
    show_welcome = settings_manager.load_show_welcome()
    assert show_welcome == False
    
    settings_manager.save_show_welcome(True)
    show_welcome = settings_manager.load_show_welcome()
    assert show_welcome == True
    
    print("✅ Show welcome setting works correctly")
    
    # Test processing settings
    test_settings = {
        'threshold': -50,
        'min_duration': 2000,
        'padding': 30,
        'overwrite': True,
        'preserve_stereo': False
    }
    
    settings_manager.save_processing_settings(test_settings)
    loaded_settings = settings_manager.load_processing_settings()
    
    print(f"✅ Saved settings: {test_settings}")
    print(f"✅ Loaded settings: {loaded_settings}")
    
    print("✅ Settings manager test completed")


def main():
    """Run all tests"""
    print("🚀 Starting Welcome & Favorites Tests...\n")
    
    try:
        test_settings_manager()
        print()
        
        test_welcome_dialog()
        print()
        
        test_favorites_sidebar()
        print()
        
        print("🎉 All tests completed successfully!")
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main() 