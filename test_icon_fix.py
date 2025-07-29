#!/usr/bin/env python3
"""
Test script to verify that the icon fix is working
"""

import sys
from pathlib import Path

# Add the src directory to the Python path
sys.path.insert(0, str(Path(__file__).parent / "src"))

from PyQt6.QtWidgets import QApplication
from utils.icon_manager import show_information, show_warning, show_critical
from ui.welcome_dialog import WelcomeDialog


def test_icons():
    """Test that all dialogs and message boxes show the correct icon"""
    
    app = QApplication(sys.argv)
    
    # Set application icon
    from utils.icon_manager import get_app_icon
    app.setWindowIcon(get_app_icon())
    
    print("🧪 Testing icon consistency...")
    print("This will show various dialogs and message boxes.")
    print("All should display the KO Trimmer icon (boxing glove) instead of the Qt logo.")
    print()
    
    # Test 1: Information message box
    print("1. Testing information message box...")
    show_information(None, "Test Information", "This is a test information message.")
    
    # Test 2: Warning message box
    print("2. Testing warning message box...")
    show_warning(None, "Test Warning", "This is a test warning message.")
    
    # Test 3: Critical message box
    print("3. Testing critical message box...")
    show_critical(None, "Test Critical", "This is a test critical error message.")
    
    # Test 4: Welcome dialog
    print("4. Testing welcome dialog...")
    welcome_dialog = WelcomeDialog()
    welcome_dialog.show()
    print("   Welcome dialog should show with KO Trimmer icon")
    print("   Press any key to continue...")
    input()
    welcome_dialog.close()
    
    print("✅ Icon test complete!")
    print("All dialogs and message boxes should have shown the KO Trimmer icon.")


if __name__ == "__main__":
    test_icons() 