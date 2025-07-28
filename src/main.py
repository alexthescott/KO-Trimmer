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
import sys
import os
from pathlib import Path

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


def main():
    """Main application entry point"""
    # Set application properties before creating QApplication
    import sys
    if sys.platform == "darwin":  # macOS
        try:
            import os
            os.environ['QT_MAC_WANTS_LAYER'] = '1'
            os.environ['QT_MAC_DISABLE_ZOOM_BUTTON'] = '1'
            # Try to set process name
            try:
                import setproctitle
                setproctitle.setproctitle("KO Trimmer")
            except ImportError:
                pass
        except:
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
    
    # Set application icon
    icon_path = Path(__file__).parent / "ui" / "images" / "Knockout.png"
    if icon_path.exists():
        app.setWindowIcon(QIcon(str(icon_path)))
    
    # Create and show the main window
    window = MainWindow()
    window.show()
    
    # Start the application event loop
    sys.exit(app.exec())


if __name__ == "__main__":
    main() 