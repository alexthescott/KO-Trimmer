"""
Simplified audio preview component for KO Trimmer
"""

import os
from pathlib import Path
from typing import Optional

from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QPushButton, 
    QGroupBox, QGridLayout
)
from PyQt6.QtCore import Qt, pyqtSignal

from .audio_player import AudioPlayerWidget
from .ui_utils import UIUtils


class AudioPreviewSimple(QWidget):
    """Simplified audio preview widget for comparing original vs trimmed audio"""
    
    preview_closed = pyqtSignal()  # Signal emitted when preview is closed
    
    def __init__(self, parent=None):
        super().__init__(parent)
        self.original_file = None
        self.trimmed_file = None
        self.init_ui()
        
    def init_ui(self):
        """Initialize the user interface"""
        layout = QVBoxLayout(self)
        layout.setContentsMargins(10, 10, 10, 10)
        
        # File info section
        info_group = UIUtils.create_group_box("Audio Preview")
        info_layout = QGridLayout(info_group)
        
        # File info labels
        self.original_file_label = QLabel("Original File: None")
        self.trimmed_file_label = QLabel("Trimmed File: None")
        self.original_size_label = QLabel("Original Size: --")
        self.trimmed_size_label = QLabel("Trimmed Size: --")
        self.reduction_label = QLabel("Reduction: --")
        
        info_layout.addWidget(self.original_file_label, 0, 0)
        info_layout.addWidget(self.original_size_label, 0, 1)
        info_layout.addWidget(self.trimmed_file_label, 1, 0)
        info_layout.addWidget(self.trimmed_size_label, 1, 1)
        info_layout.addWidget(self.reduction_label, 2, 0, 1, 2)
        
        layout.addWidget(info_group)
        
        # Audio players section
        players_group = UIUtils.create_group_box("Playback Controls")
        players_layout = QVBoxLayout(players_group)
        
        # Create audio players
        self.original_player = AudioPlayerWidget("Original Audio")
        self.trimmed_player = AudioPlayerWidget("Trimmed Audio")
        
        players_layout.addWidget(self.original_player)
        players_layout.addWidget(self.trimmed_player)
        
        layout.addWidget(players_group)
        
        # Close button
        close_layout = QHBoxLayout()
        close_layout.addStretch()
        
        self.close_btn = UIUtils.create_styled_button("Close Preview")
        self.close_btn.clicked.connect(self.close_preview)
        close_layout.addWidget(self.close_btn)
        
        layout.addLayout(close_layout)
        
    def load_files(self, original_file: str, trimmed_file: str):
        """Load original and trimmed audio files"""
        self.original_file = original_file
        self.trimmed_file = trimmed_file
        
        # Load files into players
        self.original_player.load_file(original_file)
        self.trimmed_player.load_file(trimmed_file)
        
        # Update file info
        self.update_file_info()
        
    def update_file_info(self):
        """Update file information display"""
        if not self.original_file or not self.trimmed_file:
            return
            
        try:
            # Original file info
            original_path = Path(self.original_file)
            original_size = original_path.stat().st_size if original_path.exists() else 0
            self.original_file_label.setText(f"Original File: {original_path.name}")
            self.original_size_label.setText(f"Original Size: {UIUtils.format_file_size(original_size)}")
            
            # Trimmed file info
            trimmed_path = Path(self.trimmed_file)
            trimmed_size = trimmed_path.stat().st_size if trimmed_path.exists() else 0
            self.trimmed_file_label.setText(f"Trimmed File: {trimmed_path.name}")
            self.trimmed_size_label.setText(f"Trimmed Size: {UIUtils.format_file_size(trimmed_size)}")
            
            # Calculate reduction
            if original_size > 0 and trimmed_size > 0:
                reduction_bytes = original_size - trimmed_size
                reduction_percent = (reduction_bytes / original_size) * 100
                self.reduction_label.setText(f"Reduction: {reduction_percent:.1f}% ({UIUtils.format_file_size(reduction_bytes)})")
            else:
                self.reduction_label.setText("Reduction: --")
                
        except Exception as e:
            print(f"Error updating file info: {e}")
            
    def close_preview(self):
        """Close the preview"""
        # Stop both players
        self.original_player.stop()
        self.trimmed_player.stop()
        
        # Hide the widget
        self.hide()
        
        # Emit signal
        self.preview_closed.emit()
        
    def hideEvent(self, event):
        """Handle hide event"""
        # Stop players when widget is hidden
        self.original_player.stop()
        self.trimmed_player.stop()
        event.accept()
        
    def cleanup(self):
        """Clean up resources"""
        self.original_player.cleanup()
        self.trimmed_player.cleanup() 