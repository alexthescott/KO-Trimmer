"""
Drag and drop widget for file import
"""

import os
from pathlib import Path
from typing import List

from PyQt6.QtWidgets import QWidget, QVBoxLayout, QLabel, QFrame
from PyQt6.QtCore import Qt, pyqtSignal, QMimeData
from PyQt6.QtGui import QDragEnterEvent, QDropEvent, QFont, QPalette, QColor


class DragDropWidget(QFrame):
    """Widget that accepts drag and drop of files"""
    
    files_dropped = pyqtSignal(list)  # Signal emitted when files are dropped
    
    def __init__(self):
        super().__init__()
        self.init_ui()
        self.setAcceptDrops(True)
        
    def init_ui(self):
        """Initialize the user interface"""
        self.setFrameStyle(QFrame.Shape.Box)
        self.setMinimumHeight(120)
        
        # Create layout
        layout = QVBoxLayout(self)
        layout.setAlignment(Qt.AlignmentFlag.AlignCenter)
        
        # Create label
        self.label = QLabel("Drop audio files or folders here")
        self.label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.label.setFont(QFont("Arial", 12, QFont.Weight.Bold))
        self.label.setStyleSheet("color: #333333;")  # Dark gray text
        
        # Create subtitle
        subtitle = QLabel("or click 'Add Files' / 'Add Folder' buttons")
        subtitle.setAlignment(Qt.AlignmentFlag.AlignCenter)
        subtitle.setFont(QFont("Arial", 9))
        subtitle.setStyleSheet("color: gray;")
        
        layout.addWidget(self.label)
        layout.addWidget(subtitle)
        
        # Set initial styling
        self.update_style(False)
        
    def update_style(self, is_drag_over: bool):
        """Update the widget styling based on drag state"""
        if is_drag_over:
            self.setStyleSheet("""
                QFrame {
                    border: 2px dashed #0078d4;
                    background-color: #f0f8ff;
                    border-radius: 8px;
                }
            """)
            self.label.setText("Drop files here to add them")
            self.label.setStyleSheet("color: #333333;")  # Dark gray text
        else:
            self.setStyleSheet("""
                QFrame {
                    border: 2px dashed #cccccc;
                    background-color: #fafafa;
                    border-radius: 8px;
                }
                QFrame:hover {
                    border-color: #0078d4;
                    background-color: #f0f8ff;
                }
            """)
            self.label.setText("Drop audio files or folders here")
            self.label.setStyleSheet("color: #333333;")  # Dark gray text
            
    def dragEnterEvent(self, event: QDragEnterEvent):
        """Handle drag enter events"""
        if event.mimeData().hasUrls():
            event.acceptProposedAction()
            self.update_style(True)
        else:
            event.ignore()
            
    def dragLeaveEvent(self, event):
        """Handle drag leave events"""
        self.update_style(False)
        
    def dropEvent(self, event: QDropEvent):
        """Handle drop events"""
        self.update_style(False)
        
        if event.mimeData().hasUrls():
            urls = event.mimeData().urls()
            file_paths = []
            
            for url in urls:
                # Convert URL to local file path
                local_path = url.toLocalFile()
                
                if local_path:
                    path = Path(local_path)
                    
                    if path.is_file():
                        # Single file
                        if self.is_audio_file(path):
                            file_paths.append(str(path))
                    elif path.is_dir():
                        # Directory - find all audio files
                        audio_files = self.find_audio_files(path)
                        file_paths.extend(audio_files)
                        
            if file_paths:
                self.files_dropped.emit(file_paths)
                
        event.acceptProposedAction()
        
    def is_audio_file(self, file_path: Path) -> bool:
        """Check if a file is an audio file"""
        audio_extensions = {'.wav', '.mp3', '.flac', '.aiff', '.m4a', '.ogg', '.wma', '.aac'}
        return file_path.suffix.lower() in audio_extensions
        
    def find_audio_files(self, directory: Path) -> List[str]:
        """Find all audio files in a directory recursively"""
        audio_files = []
        
        try:
            for file_path in directory.rglob("*"):
                if file_path.is_file() and self.is_audio_file(file_path):
                    audio_files.append(str(file_path))
        except PermissionError:
            # Skip directories we don't have permission to access
            pass
            
        return audio_files 