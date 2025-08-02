"""
File management panel component for KO Trimmer
"""

from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QPushButton, QGroupBox,
    QMenu, QListWidgetItem, QInputDialog, QMessageBox
)
from PyQt6.QtCore import Qt, pyqtSignal
from PyQt6.QtGui import QAction

from .combined_file_widget import CombinedFileWidget
from .audio_preview import AudioPreviewWidget
from .ui_utils import UIUtils


class FilePanel(QWidget):
    """File management panel for handling audio files"""
    
    files_changed = pyqtSignal()  # Emitted when file list changes
    file_selected = pyqtSignal(str)  # Emitted when a file is selected
    
    def __init__(self):
        super().__init__()
        self.file_paths = []  # Track file paths for undo
        self.last_action = None  # Track last action for undo
        self.init_ui()
        
    def init_ui(self):
        """Initialize the file panel UI"""
        layout = QVBoxLayout(self)
        
        # Audio preview section (initially hidden)
        self.audio_preview_widget = AudioPreviewWidget()
        self.audio_preview_widget.preview_closed.connect(self.on_preview_closed)
        layout.addWidget(self.audio_preview_widget)
        
        # Combined file section
        file_group = UIUtils.create_group_box("Files to Process")
        file_layout = QVBoxLayout(file_group)
        
        # Combined drag-drop and file list widget
        self.combined_file_widget = CombinedFileWidget()
        self.combined_file_widget.files_dropped.connect(self.on_files_dropped)
        file_layout.addWidget(self.combined_file_widget)
        
        # Get the file list from the combined widget
        self.file_list = self.combined_file_widget.get_file_list()
        self.file_list.customContextMenuRequested.connect(self.show_context_menu)
        
        # Connect selection change to auto-update preview
        self.file_list.selectionModel().selectionChanged.connect(self.on_file_selection_changed)
        
        # File list buttons
        file_buttons_layout = QHBoxLayout()
        
        self.add_files_btn = UIUtils.create_styled_button("Add Files")
        self.add_files_btn.clicked.connect(self.add_files)
        file_buttons_layout.addWidget(self.add_files_btn)
        
        self.add_folder_btn = UIUtils.create_styled_button("Add Folder")
        self.add_folder_btn.clicked.connect(self.add_folder)
        file_buttons_layout.addWidget(self.add_folder_btn)
        
        self.clear_btn = UIUtils.create_styled_button("Clear All")
        self.clear_btn.clicked.connect(self.clear_files)
        file_buttons_layout.addWidget(self.clear_btn)
        
        self.preview_btn = UIUtils.create_styled_button("Show Preview")
        self.preview_btn.clicked.connect(self.preview_selected)
        file_buttons_layout.addWidget(self.preview_btn)
        
        file_layout.addLayout(file_buttons_layout)
        layout.addWidget(file_group)
        
    def add_files(self):
        """Add files via file dialog"""
        from PyQt6.QtWidgets import QFileDialog
        
        file_paths, _ = QFileDialog.getOpenFileNames(
            self,
            "Select Audio Files",
            "",
            "Audio Files (*.wav *.mp3 *.flac *.aiff *.m4a *.ogg *.wma *.aac)"
        )
        
        if file_paths:
            self.add_files_to_list(file_paths)
            
    def add_folder(self):
        """Add folder via directory dialog"""
        from PyQt6.QtWidgets import QFileDialog
        from pathlib import Path
        
        directory = QFileDialog.getExistingDirectory(
            self,
            "Select Folder with Audio Files",
            str(Path.home()),
            QFileDialog.Option.ShowDirsOnly
        )
        
        if directory:
            # Find all audio files in the directory
            audio_files = UIUtils.find_audio_files(Path(directory))
            if audio_files:
                self.add_files_to_list(audio_files)
            else:
                QMessageBox.information(self, "No Audio Files", "No audio files found in the selected directory.")
                
    def add_files_to_list(self, file_paths):
        """Add files to the list"""
        self.combined_file_widget.add_files(file_paths)
        self.file_paths.extend(file_paths)
        self.files_changed.emit()
        
    def clear_files(self):
        """Clear all files from the list"""
        self.combined_file_widget.clear_files()
        self.file_paths.clear()
        self.files_changed.emit()
        
    def on_files_dropped(self, file_paths):
        """Handle files dropped onto the widget"""
        self.add_files_to_list(file_paths)
        
    def get_file_paths(self):
        """Get all file paths in the list"""
        paths = []
        for row in range(self.file_list.rowCount()):
            path_item = self.file_list.item(row, 1)
            if path_item:
                paths.append(path_item.text())
        return paths
        
    def get_selected_files(self):
        """Get currently selected file paths"""
        selected_paths = []
        for item in self.file_list.selectedItems():
            # Get the path from the second column
            row = item.row()
            path_item = self.file_list.item(row, 1)
            if path_item:
                selected_paths.append(path_item.text())
        return selected_paths
        
    def has_files(self):
        """Check if there are files in the list"""
        return self.file_list.rowCount() > 0 and self.file_list.item(0, 0).flags() != Qt.ItemFlag.NoItemFlags
        
    def show_context_menu(self, position):
        """Show context menu for file list"""
        item = self.file_list.itemAt(position)
        if not item or item.flags() == Qt.ItemFlag.NoItemFlags:
            return
            
        menu = QMenu(self)
        
        # Preview action
        preview_action = QAction("Preview Audio", self)
        preview_action.triggered.connect(lambda: self.preview_selected())
        menu.addAction(preview_action)
        
        menu.addSeparator()
        
        # Remove action
        remove_action = QAction("Remove from List", self)
        remove_action.triggered.connect(lambda: self.remove_selected_file(item))
        menu.addAction(remove_action)
        
        # Rename action
        rename_action = QAction("Rename File", self)
        rename_action.triggered.connect(lambda: self.rename_selected_file(item))
        menu.addAction(rename_action)
        
        menu.exec(self.file_list.mapToGlobal(position))
        
    def remove_selected_file(self, item):
        """Remove selected file from list"""
        row = item.row()
        path_item = self.file_list.item(row, 1)
        if path_item:
            file_path = path_item.text()
            self.file_list.removeRow(row)
            if file_path in self.file_paths:
                self.file_paths.remove(file_path)
            self.files_changed.emit()
            
    def rename_selected_file(self, item):
        """Rename selected file"""
        row = item.row()
        filename_item = self.file_list.item(row, 0)
        path_item = self.file_list.item(row, 1)
        
        if filename_item and path_item:
            current_name = filename_item.text()
            file_path = path_item.text()
            
            new_name, ok = QInputDialog.getText(
                self,
                "Rename File",
                "Enter new filename:",
                text=current_name
            )
            
            if ok and new_name.strip():
                # Update the display name
                filename_item.setText(new_name.strip())
                self.files_changed.emit()
                
    def preview_selected(self):
        """Preview selected audio files"""
        selected_files = self.get_selected_files()
        
        if not selected_files:
            QMessageBox.information(self, "No Selection", "Please select a file to preview.")
            return
            
        # For now, just preview the first selected file
        # In a full implementation, you might want to handle multiple files
        file_path = selected_files[0]
        
        # Try to find the corresponding trimmed file
        from pathlib import Path
        from audio.processor import AudioProcessor
        
        processor = AudioProcessor()
        path_obj = Path(file_path)
        
        # Look for trimmed file in various locations
        possible_trimmed_paths = [
            path_obj.parent / f"{path_obj.stem}_trimmed{path_obj.suffix}",
            path_obj.parent / "trimmed" / f"{path_obj.stem}_trimmed{path_obj.suffix}"
        ]
        
        # Also check for the new folder structure
        try:
            root_dir = processor._find_root_directory(file_path)
            if root_dir:
                root_name = root_dir.name
                new_root_name = f"{root_name}_trimmed"
                new_root_path = root_dir.parent / new_root_name
                relative_path = path_obj.relative_to(root_dir)
                new_output_path = new_root_path / relative_path
                possible_trimmed_paths.append(new_output_path)
        except:
            pass
        
        trimmed_path = None
        for possible_path in possible_trimmed_paths:
            if possible_path.exists():
                trimmed_path = str(possible_path)
                break
                
        if trimmed_path:
            # Show the embedded preview
            self.audio_preview_widget.load_files(file_path, trimmed_path)
            self.audio_preview_widget.show()
            self.preview_btn.setText("Hide Preview")
        else:
            QMessageBox.information(
                self, 
                "No Trimmed File", 
                f"No trimmed version found for {path_obj.name}. Process the file first."
            )
            
    def on_preview_closed(self):
        """Handle preview widget being closed"""
        self.preview_btn.setText("Show Preview")
        
    def on_file_selection_changed(self, selected, deselected):
        """Handle file selection changes"""
        selected_files = self.get_selected_files()
        if selected_files:
            self.file_selected.emit(selected_files[0])
            
    def undo_last_action(self):
        """Undo the last action (placeholder for future implementation)"""
        # This could be implemented to track and undo file operations
        pass 