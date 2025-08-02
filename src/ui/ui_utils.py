"""
UI utility functions for common operations
"""

import os
from pathlib import Path
from typing import List, Dict, Optional

from PyQt6.QtWidgets import QLabel, QPushButton, QGroupBox, QVBoxLayout, QHBoxLayout
from PyQt6.QtCore import Qt
from PyQt6.QtGui import QFont, QIcon


class UIUtils:
    """Utility class for common UI operations"""
    
    # Audio file extensions
    AUDIO_EXTENSIONS = {'.wav', '.mp3', '.flac', '.aiff', '.m4a', '.ogg', '.wma', '.aac'}
    
    @staticmethod
    def is_audio_file(file_path: Path) -> bool:
        """Check if a file is an audio file"""
        return file_path.suffix.lower() in UIUtils.AUDIO_EXTENSIONS
    
    @staticmethod
    def find_audio_files(directory: Path) -> List[str]:
        """Find all audio files in a directory recursively"""
        audio_files = []
        
        try:
            for file_path in directory.rglob("*"):
                if file_path.is_file() and UIUtils.is_audio_file(file_path):
                    audio_files.append(str(file_path))
        except PermissionError:
            # Skip directories we don't have permission to access
            pass
            
        return audio_files
    
    @staticmethod
    def create_display_name(directory: str) -> str:
        """Create a descriptive display name for a directory"""
        path_obj = Path(directory)
        
        # If it's in the user's home directory, show a relative path
        try:
            relative_path = path_obj.relative_to(Path.home())
            if len(str(relative_path).split('/')) <= 2:
                # For shallow paths, show the full relative path
                return f"📁 {relative_path}"
            else:
                # For deeper paths, show parent/name
                parts = str(relative_path).split('/')
                if len(parts) >= 2:
                    return f"📁 {parts[-2]}/{parts[-1]}"
                else:
                    return f"📁 {path_obj.name}"
        except ValueError:
            # If not in home directory, show parent/name
            try:
                return f"📁 {path_obj.parent.name}/{path_obj.name}"
            except:
                return f"📁 {path_obj.name}"
    
    @staticmethod
    def create_styled_label(text: str, font_size: int = 12, bold: bool = False, color: str = "#333333") -> QLabel:
        """Create a styled label with consistent formatting"""
        label = QLabel(text)
        font_weight = QFont.Weight.Bold if bold else QFont.Weight.Normal
        label.setFont(QFont("Arial", font_size, font_weight))
        label.setStyleSheet(f"color: {color};")
        return label
    
    @staticmethod
    def create_styled_button(text: str, primary: bool = False) -> QPushButton:
        """Create a styled button with consistent formatting"""
        button = QPushButton(text)
        
        if primary:
            button.setStyleSheet("""
                QPushButton {
                    background-color: #27ae60;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    font-weight: bold;
                }
                QPushButton:hover {
                    background-color: #2ecc71;
                }
            """)
        else:
            button.setStyleSheet("""
                QPushButton {
                    background-color: #f8f9fa;
                    color: #333333;
                    border: 1px solid #dee2e6;
                    padding: 6px 12px;
                    border-radius: 4px;
                }
                QPushButton:hover {
                    background-color: #e9ecef;
                }
            """)
        
        return button
    
    @staticmethod
    def create_group_box(title: str) -> QGroupBox:
        """Create a styled group box"""
        group_box = QGroupBox(title)
        group_box.setStyleSheet("""
            QGroupBox {
                font-weight: bold;
                border: 1px solid #dee2e6;
                border-radius: 4px;
                margin-top: 8px;
                padding-top: 8px;
            }
            QGroupBox::title {
                subcontrol-origin: margin;
                left: 8px;
                padding: 0 4px 0 4px;
            }
        """)
        return group_box
    
    @staticmethod
    def create_drag_drop_style(is_drag_over: bool) -> str:
        """Create consistent drag-drop styling"""
        if is_drag_over:
            return """
                QFrame {
                    border: 2px dashed #0078d4;
                    background-color: #f0f8ff;
                    border-radius: 8px;
                }
            """
        else:
            return """
                QFrame {
                    border: 2px dashed #cccccc;
                    background-color: #fafafa;
                    border-radius: 8px;
                }
                QFrame:hover {
                    border-color: #0078d4;
                    background-color: #f0f8ff;
                }
            """
    
    @staticmethod
    def create_table_style() -> str:
        """Create consistent table styling"""
        return """
            QTableWidget {
                background-color: transparent;
                border: none;
                color: #333333;
                font-family: "Monaco", "Menlo", "Consolas", monospace;
                font-size: 10px;
                gridline-color: transparent;
            }
            QTableWidget::item {
                padding: 1px;
                border: none;
                background-color: transparent;
                color: #333333;
            }
            QTableWidget::item:selected {
                background-color: #0078d4;
                color: #ffffff;
            }
            QTableWidget::item:hover {
                background-color: #f0f0f0;
                color: #333333;
            }
            QHeaderView::section {
                background-color: transparent;
                border: none;
                color: #666666;
                font-size: 9px;
            }
        """
    
    @staticmethod
    def format_file_size(size_bytes: int) -> str:
        """Format file size in human-readable format"""
        size_units = [
            (1024 * 1024 * 1024, "GB"),
            (1024 * 1024, "MB"),
            (1024, "KB"),
            (1, "B")
        ]
        
        for unit_size, unit_name in size_units:
            if size_bytes >= unit_size:
                return f"{size_bytes / unit_size:.1f} {unit_name}"
        
        return f"{size_bytes} B" 