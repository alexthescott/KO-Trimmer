"""
Combined drag-drop and file list widget
"""

import os
from pathlib import Path
from typing import List

from PyQt6.QtWidgets import QWidget, QVBoxLayout, QLabel, QFrame, QTableWidget, QTableWidgetItem
from PyQt6.QtCore import Qt, pyqtSignal, QMimeData
from PyQt6.QtGui import QDragEnterEvent, QDropEvent, QFont, QPalette, QColor


class CombinedFileWidget(QFrame):
    """Widget that combines drag-drop area with file list"""
    
    files_dropped = pyqtSignal(list)  # Signal emitted when files are dropped
    
    def __init__(self):
        super().__init__()
        self.init_ui()
        self.setAcceptDrops(True)
        
    def init_ui(self):
        """Initialize the user interface"""
        self.setFrameStyle(QFrame.Shape.Box)
        self.setMinimumHeight(150)
        
        # Create layout
        layout = QVBoxLayout(self)
        layout.setContentsMargins(4, 4, 4, 4)
        
        # Create file table
        self.file_list = QTableWidget()
        self.file_list.setColumnCount(2)
        self.file_list.setHorizontalHeaderLabels(["Filename", "Path"])
        self.file_list.setSelectionBehavior(QTableWidget.SelectionBehavior.SelectRows)
        self.file_list.setSelectionMode(QTableWidget.SelectionMode.ExtendedSelection)
        self.file_list.setContextMenuPolicy(Qt.ContextMenuPolicy.CustomContextMenu)
        
        # Set column widths
        self.file_list.setColumnWidth(0, 200)  # Filename column
        self.file_list.setColumnWidth(1, 400)  # Path column
        
        # Make columns resizable
        self.file_list.horizontalHeader().setStretchLastSection(True)
        self.file_list.horizontalHeader().setSectionsMovable(False)
        
        # Create placeholder label
        self.placeholder_label = QLabel("Drop audio files or folders here, or click 'Add Files' / 'Add Folder' buttons")
        self.placeholder_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.placeholder_label.setFont(QFont("Arial", 9, QFont.Weight.Normal))
        self.placeholder_label.setStyleSheet("color: #666666; padding: 2px;")
        
        # Add placeholder to table widget
        self.file_list.setRowCount(1)
        placeholder_item = QTableWidgetItem(self.placeholder_label.text())
        placeholder_item.setFlags(Qt.ItemFlag.NoItemFlags)  # Make it non-selectable
        self.file_list.setItem(0, 0, placeholder_item)
        self.file_list.setSpan(0, 0, 1, 2)  # Span across both columns
        
        # Set table widget styling
        self.file_list.setStyleSheet("""
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
        """)
        
        # Initially hide headers since we start with placeholder
        self.file_list.horizontalHeader().setVisible(False)
        self.file_list.verticalHeader().setVisible(False)
        
        layout.addWidget(self.file_list)
        
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
                
                if os.path.isfile(local_path):
                    # Single file
                    if self.is_audio_file(Path(local_path)):
                        file_paths.append(local_path)
                elif os.path.isdir(local_path):
                    # Directory - find all audio files
                    audio_files = self.find_audio_files(Path(local_path))
                    file_paths.extend(audio_files)
            
            if file_paths:
                self.files_dropped.emit(file_paths)
                
    def is_audio_file(self, file_path: Path) -> bool:
        """Check if file is an audio file"""
        audio_extensions = {'.wav', '.mp3', '.flac', '.aiff', '.m4a', '.ogg'}
        return file_path.suffix.lower() in audio_extensions
        
    def find_audio_files(self, directory: Path) -> List[str]:
        """Find all audio files in a directory"""
        audio_extensions = {'.wav', '.mp3', '.flac', '.aiff', '.m4a', '.ogg'}
        audio_files = []
        
        for file_path in directory.rglob("*"):
            if file_path.is_file() and file_path.suffix.lower() in audio_extensions:
                audio_files.append(str(file_path))
                
        return audio_files
        
    def add_files(self, file_paths: List[str]):
        """Add files to the list"""
        # Remove placeholder if it exists
        if self.file_list.rowCount() == 1 and self.file_list.item(0, 0) and self.file_list.item(0, 0).flags() == Qt.ItemFlag.NoItemFlags:
            self.file_list.clear()
            self.file_list.setRowCount(0)
            # Show headers when we have actual files
            self.file_list.horizontalHeader().setVisible(True)
            self.file_list.verticalHeader().setVisible(True)
            
        for file_path in file_paths:
            # Check if file is already in the list
            existing_items = []
            for row in range(self.file_list.rowCount()):
                path_item = self.file_list.item(row, 1)
                if path_item:
                    existing_items.append(path_item.text())
            
            if file_path not in existing_items:
                # Create separate items for filename and path
                path_obj = Path(file_path)
                filename = path_obj.name
                full_path = str(path_obj)
                
                # Add new row
                row = self.file_list.rowCount()
                self.file_list.insertRow(row)
                
                # Create items
                filename_item = QTableWidgetItem(filename)
                path_item = QTableWidgetItem(full_path)
                
                # Add items to table
                self.file_list.setItem(row, 0, filename_item)
                self.file_list.setItem(row, 1, path_item)
                
    def clear_files(self):
        """Clear all files from the list"""
        self.file_list.clear()
        self.file_list.setRowCount(1)
        # Add placeholder back with proper formatting
        placeholder_item = QTableWidgetItem(self.placeholder_label.text())
        placeholder_item.setFlags(Qt.ItemFlag.NoItemFlags)
        self.file_list.setItem(0, 0, placeholder_item)
        self.file_list.setSpan(0, 0, 1, 2)  # Span across both columns
        # Hide headers when showing placeholder
        self.file_list.horizontalHeader().setVisible(False)
        self.file_list.verticalHeader().setVisible(False)
        
    def get_file_list(self):
        """Get the file list widget for external access"""
        return self.file_list 