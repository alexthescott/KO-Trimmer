#!/usr/bin/env python3
"""
TrimVibe - Audio Silence Trimmer for KO II Sampler
Main application entry point
"""

import sys
import os
from pathlib import Path

# Add the src directory to the Python path
sys.path.insert(0, str(Path(__file__).parent))

from PyQt6.QtWidgets import QApplication
from PyQt6.QtCore import Qt
from ui.main_window import MainWindow


def main():
    """Main application entry point"""
    # Create the Qt application
    app = QApplication(sys.argv)
    app.setApplicationName("TrimVibe")
    app.setApplicationVersion("1.0.0")
    app.setOrganizationName("TrimVibe")
    
    # Enable high DPI scaling (PyQt6 handles this automatically)
    # Note: PyQt6 has better DPI support built-in, so we don't need to set these attributes
    
    # Create and show the main window
    window = MainWindow()
    window.show()
    
    # Start the application event loop
    sys.exit(app.exec())


if __name__ == "__main__":
    main() 