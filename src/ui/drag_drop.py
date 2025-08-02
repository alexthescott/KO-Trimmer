"""
Drag and drop widget for file import
"""

import os
from pathlib import Path
from typing import List

from PyQt6.QtWidgets import QWidget, QVBoxLayout, QLabel, QFrame
from PyQt6.QtCore import Qt, pyqtSignal, QMimeData
from PyQt6.QtGui import QDragEnterEvent, QDropEvent, QFont

from .ui_utils import UIUtils


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
        
        # Create labels using UIUtils
        self.label = UIUtils.create_styled_label("Drop audio files or folders here", 12, True)
        self.label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        
        subtitle = UIUtils.create_styled_label("or click 'Add Files' / 'Add Folder' buttons", 9, False, "gray")
        subtitle.setAlignment(Qt.AlignmentFlag.AlignCenter)
        
        layout.addWidget(self.label)
        layout.addWidget(subtitle)
        
        # Set initial styling
        self.update_style(False)
        
    def update_style(self, is_drag_over: bool):
        """Update the widget styling based on drag state"""
        self.setStyleSheet(UIUtils.create_drag_drop_style(is_drag_over))
        
        if is_drag_over:
            self.label.setText("Drop files here to add them")
        else:
            self.label.setText("Drop audio files or folders here")
            
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
                        if UIUtils.is_audio_file(path):
                            file_paths.append(str(path))
                    elif path.is_dir():
                        # Directory - find all audio files
                        audio_files = UIUtils.find_audio_files(path)
                        file_paths.extend(audio_files)
                        
            if file_paths:
                self.files_dropped.emit(file_paths)
                
        event.acceptProposedAction() 