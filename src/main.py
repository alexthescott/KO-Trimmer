#!/usr/bin/env python3
"""
KO Trimmer - Audio Silence Trimmer for KO II Sampler
Main application entry point
"""

import sys
import os
from pathlib import Path

# Add the src directory to the Python path
sys.path.insert(0, str(Path(__file__).parent))

from PyQt6.QtWidgets import QApplication
from PyQt6.QtCore import Qt
from PyQt6.QtGui import QIcon

# Add src directory to path for PyInstaller
if getattr(sys, 'frozen', False):
    # Running in PyInstaller bundle
    bundle_dir = Path(sys._MEIPASS)
    src_dir = bundle_dir / "src"
    if src_dir.exists():
        sys.path.insert(0, str(src_dir))
    else:
        # Try to find src in the current directory
        current_dir = Path(sys.executable).parent
        src_dir = current_dir / "src"
        if src_dir.exists():
            sys.path.insert(0, str(src_dir))

from ui.main_window import MainWindow
from utils.icon_manager import get_app_icon


def main():
    """Main application entry point"""
    import sys
    import os
    
    if sys.platform == "darwin":  # macOS
        # Try to set process name
        try:
            import setproctitle
            setproctitle.setproctitle("KO Trimmer")
        except ImportError:
            pass
    
    # Create the Qt application
    app = QApplication(sys.argv)
    app.setApplicationName("KO Trimmer")
    app.setApplicationVersion("1.0.0")
    app.setOrganizationName("KO Trimmer")
    app.setApplicationDisplayName("KO Trimmer")
    
    # Set window title for better macOS integration
    if sys.platform == "darwin":
        app.setDesktopFileName("ko-trimmer.desktop")
    
    # Enable high DPI scaling (PyQt6 handles this automatically)
    # Note: PyQt6 has better DPI support built-in, so we don't need to set these attributes
    
    # Set application icon aggressively
    app_icon = get_app_icon()
    if not app_icon.isNull():
        app.setWindowIcon(app_icon)
        # Also set the icon property
        app.setProperty("windowIcon", app_icon)
    
    # Create and show the main window
    window = MainWindow()
    window.show()
    
    # Start the application event loop
    sys.exit(app.exec())


if __name__ == "__main__":
    main() 