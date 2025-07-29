"""
Icon management utilities for KO Trimmer
"""

from pathlib import Path
from PyQt6.QtWidgets import QMessageBox, QApplication, QDialog, QVBoxLayout, QHBoxLayout, QPushButton, QLabel
from PyQt6.QtGui import QIcon
from PyQt6.QtCore import Qt


def get_app_icon() -> QIcon:
    """Get the application icon (PNG for macOS compatibility)"""
    # Use PNG for application icon (better macOS dock compatibility)
    icon_path = Path(__file__).parent.parent / "ui" / "images" / "Knockout.png"
    if icon_path.exists():
        return QIcon(str(icon_path))
    
    # Fallback to SVG if PNG doesn't exist
    icon_path = Path(__file__).parent.parent / "ui" / "images" / "Knockout.svg"
    if icon_path.exists():
        return QIcon(str(icon_path))
    
    return QIcon()


def get_popup_icon() -> QIcon:
    """Get the popup icon (SVG for better quality in dialogs)"""
    # Try SVG first (better quality for popup dialogs)
    icon_path = Path(__file__).parent.parent / "ui" / "images" / "Knockout.svg"
    if icon_path.exists():
        return QIcon(str(icon_path))
    
    # Fallback to PNG
    icon_path = Path(__file__).parent.parent / "ui" / "images" / "Knockout.png"
    if icon_path.exists():
        return QIcon(str(icon_path))
    
    return QIcon()


def set_dialog_icon(dialog):
    """Set the application icon for a dialog"""
    dialog.setWindowIcon(get_app_icon())


class CustomMessageBox(QDialog):
    """Custom message box with guaranteed icon display"""
    
    def __init__(self, parent=None, title="", message="", icon_type=QMessageBox.Icon.Information):
        super().__init__(parent)
        self.setWindowTitle(title)
        self.setWindowIcon(get_app_icon())
        self.setModal(True)
        
        # Set minimum size but allow expansion
        self.setMinimumSize(450, 200)
        self.resize(450, 200)
        
        # Create layout
        layout = QVBoxLayout(self)
        layout.setSpacing(15)
        layout.setContentsMargins(20, 20, 20, 20)
        
        # Add icon and message
        content_layout = QHBoxLayout()
        content_layout.setSpacing(15)
        
        # Icon label (use popup icon for better quality in dialogs)
        icon_label = QLabel()
        icon_label.setPixmap(get_popup_icon().pixmap(48, 48))
        icon_label.setAlignment(Qt.AlignmentFlag.AlignTop)
        content_layout.addWidget(icon_label)
        
        # Message label with better text handling
        message_label = QLabel(message)
        message_label.setWordWrap(True)
        message_label.setAlignment(Qt.AlignmentFlag.AlignTop)
        message_label.setMinimumWidth(350)
        message_label.setStyleSheet("""
            QLabel {
                font-size: 12px;
                line-height: 1.4;
                padding: 5px;
            }
        """)
        content_layout.addWidget(message_label)
        
        layout.addLayout(content_layout)
        
        # Add some spacing
        layout.addSpacing(10)
        
        # OK button
        button_layout = QHBoxLayout()
        button_layout.addStretch()
        ok_button = QPushButton("OK")
        ok_button.setMinimumWidth(80)
        ok_button.setMinimumHeight(30)
        ok_button.clicked.connect(self.accept)
        button_layout.addWidget(ok_button)
        layout.addLayout(button_layout)
        
        # Adjust size to fit content
        self.adjustSize()
        
        # Ensure reasonable maximum size
        screen = QApplication.primaryScreen()
        if screen:
            screen_geometry = screen.availableGeometry()
            max_width = min(self.width(), screen_geometry.width() * 0.8)
            max_height = min(self.height(), screen_geometry.height() * 0.8)
            self.resize(max_width, max_height)


def show_message_box(parent, title, message, icon_type=QMessageBox.Icon.Information):
    """Show a message box with the application icon"""
    msg_box = CustomMessageBox(parent, title, message, icon_type)
    return msg_box.exec()


def show_information(parent, title, message):
    """Show an information message box"""
    return show_message_box(parent, title, message, QMessageBox.Icon.Information)


def show_warning(parent, title, message):
    """Show a warning message box"""
    return show_message_box(parent, title, message, QMessageBox.Icon.Warning)


def show_critical(parent, title, message):
    """Show a critical error message box"""
    return show_message_box(parent, title, message, QMessageBox.Icon.Critical)


def show_question(parent, title, message):
    """Show a question message box"""
    return show_message_box(parent, title, message, QMessageBox.Icon.Question) 