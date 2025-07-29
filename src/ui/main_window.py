"""
Main window for KO Trimmer application
"""

import os
import time
from pathlib import Path
from typing import List, Optional, Dict, Any

from PyQt6.QtWidgets import (
    QMainWindow, QWidget, QVBoxLayout, QHBoxLayout, 
    QPushButton, QLabel, QProgressBar, QListWidget,
    QListWidgetItem, QMessageBox, QFileDialog, QGroupBox,
    QSpinBox, QDoubleSpinBox, QCheckBox, QSplitter, QMenu,
    QProgressDialog, QLineEdit, QInputDialog, QMenuBar,
    QDialog, QVBoxLayout, QHBoxLayout, QLabel, QPushButton
)
from PyQt6.QtCore import Qt, QThread, pyqtSignal, QMimeData, QTimer
from PyQt6.QtGui import QDragEnterEvent, QDropEvent, QIcon, QAction

from audio.processor import AudioProcessor
from ui.combined_file_widget import CombinedFileWidget
from ui.progress import ProcessingProgressWidget
from ui.audio_preview import AudioPreviewDialog
from ui.favorites_sidebar import FavoritesSidebar
from ui.welcome_dialog import WelcomeDialog
from utils.settings_manager import SettingsManager
from utils.icon_manager import show_information, show_warning, show_critical, set_dialog_icon, get_app_icon


class MainWindow(QMainWindow):
    """Main application window"""
    
    def __init__(self):
        super().__init__()
        self.audio_processor = AudioProcessor()
        self.processing_thread = None
        self.directory_scan_thread = None
        self.settings_manager = SettingsManager()
        self.favorites = []
        self.custom_output_directory = None  # Store custom output directory
        self.init_ui()
        self.load_settings()
        self.show_welcome_if_needed()
        
    def init_ui(self):
        """Initialize the user interface"""
        self.setWindowTitle("KO Trimmer - Audio Silence Trimmer")
        self.setMinimumSize(900, 600)  # Increased to accommodate full layout
        self.resize(900, 600)  # Set initial size to full layout size
        self.setWindowIconText("KO Trimmer")
        
        # Set window properties for better macOS integration
        self.setWindowFlags(self.windowFlags() | Qt.WindowType.WindowTitleHint)
        
        # Set window name for task switcher
        self.setObjectName("KO Trimmer")
        
        # Set window icon using icon manager
        self.setWindowIcon(get_app_icon())
        
        # Create menu bar
        self.create_menu_bar()
        
        # Create central widget
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        
        # Create main layout
        main_layout = QHBoxLayout(central_widget)
        
        # Create splitter for resizable panels
        self.splitter = QSplitter(Qt.Orientation.Horizontal)
        main_layout.addWidget(self.splitter)
        
        # Left panel - Favorites sidebar
        self.favorites_sidebar = FavoritesSidebar()
        self.favorites_sidebar.favorite_selected.connect(self.on_favorite_selected)
        self.favorites_sidebar.favorites_changed.connect(self.on_favorites_changed)
        self.splitter.addWidget(self.favorites_sidebar)
        
        # Center panel - File management
        center_panel = self.create_file_panel()
        self.splitter.addWidget(center_panel)
        
        # Right panel - Settings and controls
        self.right_panel = self.create_control_panel()
        self.splitter.addWidget(self.right_panel)
        
        # Set splitter proportions
        self.splitter.setSizes([200, 400, 300])
        
        # Initially hide the right panel until files are added
        self.right_panel.hide()
        self.splitter.setSizes([200, 400, 0])
        
    def create_menu_bar(self):
        """Create the menu bar with undo functionality"""
        menubar = self.menuBar()
        
        # Edit menu
        edit_menu = menubar.addMenu("Edit")
        
        # Undo action
        self.undo_action = QAction("Undo", self)
        self.undo_action.setShortcut("Ctrl+Z")
        self.undo_action.setEnabled(False)
        self.undo_action.triggered.connect(self.undo_last_action)
        edit_menu.addAction(self.undo_action)
        
    def create_file_panel(self) -> QWidget:
        """Create the file management panel"""
        panel = QWidget()
        layout = QVBoxLayout(panel)
        
        # Combined file section
        file_group = QGroupBox("Files to Process")
        file_layout = QVBoxLayout(file_group)
        
        # Combined drag-drop and file list widget
        self.combined_file_widget = CombinedFileWidget()
        self.combined_file_widget.files_dropped.connect(self.on_files_dropped)
        file_layout.addWidget(self.combined_file_widget)
        
        # Get the file list from the combined widget
        self.file_list = self.combined_file_widget.get_file_list()
        self.file_list.customContextMenuRequested.connect(self.show_context_menu)
        
        # File list buttons
        file_buttons_layout = QHBoxLayout()
        
        self.add_files_btn = QPushButton("Add Files")
        self.add_files_btn.clicked.connect(self.add_files)
        file_buttons_layout.addWidget(self.add_files_btn)
        
        self.add_folder_btn = QPushButton("Add Folder")
        self.add_folder_btn.clicked.connect(self.add_folder)
        file_buttons_layout.addWidget(self.add_folder_btn)
        
        self.clear_btn = QPushButton("Clear All")
        self.clear_btn.clicked.connect(self.clear_files)
        file_buttons_layout.addWidget(self.clear_btn)
        
        self.preview_btn = QPushButton("Preview Selected")
        self.preview_btn.clicked.connect(self.preview_selected)
        file_buttons_layout.addWidget(self.preview_btn)
        
        file_layout.addLayout(file_buttons_layout)
        layout.addWidget(file_group)
        
        return panel
        
    def create_control_panel(self) -> QWidget:
        """Create the control panel with settings"""
        panel = QWidget()
        layout = QVBoxLayout(panel)
        
        # Settings group
        settings_group = QGroupBox("Silence Detection Settings")
        settings_layout = QVBoxLayout(settings_group)
        
        # Silence threshold
        threshold_layout = QHBoxLayout()
        threshold_layout.addWidget(QLabel("Silence Threshold (dB):"))
        self.threshold_spin = QDoubleSpinBox()
        self.threshold_spin.setRange(-60, 0)
        self.threshold_spin.setValue(-50)  # More forgiving for natural decay
        self.threshold_spin.setSuffix(" dB")
        threshold_layout.addWidget(self.threshold_spin)
        settings_layout.addLayout(threshold_layout)
        
        # Minimum silence duration
        duration_layout = QHBoxLayout()
        duration_layout.addWidget(QLabel("Min Silence Duration (ms):"))
        self.duration_spin = QSpinBox()
        self.duration_spin.setRange(100, 10000)
        self.duration_spin.setValue(1000)  # Longer duration to avoid cutting natural decay
        self.duration_spin.setSuffix(" ms")
        duration_layout.addWidget(self.duration_spin)
        settings_layout.addLayout(duration_layout)
        
        # Padding
        padding_layout = QHBoxLayout()
        padding_layout.addWidget(QLabel("Padding (ms):"))
        self.padding_spin = QSpinBox()
        self.padding_spin.setRange(0, 1000)
        self.padding_spin.setValue(20)  # Reduced padding for tighter trimming
        self.padding_spin.setSuffix(" ms")
        padding_layout.addWidget(self.padding_spin)
        settings_layout.addLayout(padding_layout)
        
        # Options
        self.overwrite_check = QCheckBox("Overwrite original files")
        self.overwrite_check.setChecked(False)
        self.overwrite_check.toggled.connect(self.on_overwrite_changed)
        settings_layout.addWidget(self.overwrite_check)
        
        # Stereo preservation option
        self.preserve_stereo_check = QCheckBox("Preserve stereo channels (convert to mono if unchecked)")
        self.preserve_stereo_check.setChecked(True)  # Default to preserving stereo
        self.preserve_stereo_check.toggled.connect(self.on_settings_changed)
        settings_layout.addWidget(self.preserve_stereo_check)
        
        layout.addWidget(settings_group)
        
        # Progress group
        progress_group = QGroupBox("Processing")
        progress_layout = QVBoxLayout(progress_group)
        
        self.progress_widget = ProcessingProgressWidget()
        progress_layout.addWidget(self.progress_widget)
        
        # Control buttons
        buttons_layout = QHBoxLayout()
        
        self.process_btn = QPushButton("Process Files")
        self.process_btn.clicked.connect(self.process_files)
        self.process_btn.setEnabled(False)
        buttons_layout.addWidget(self.process_btn)
        
        self.stop_btn = QPushButton("Stop")
        self.stop_btn.clicked.connect(self.stop_processing)
        self.stop_btn.setEnabled(False)
        buttons_layout.addWidget(self.stop_btn)
        
        progress_layout.addLayout(buttons_layout)
        layout.addWidget(progress_group)
        
        # Add stretch to push output directory to the bottom
        layout.addStretch()
        
        # Output directory group (moved to bottom)
        output_group = QGroupBox("Output Directory")
        output_layout = QVBoxLayout(output_group)
        
        # Output directory display
        self.output_dir_edit = QLineEdit()
        self.output_dir_edit.setPlaceholderText("Output directory will be shown here")
        self.output_dir_edit.setReadOnly(True)
        self.output_dir_edit.setStyleSheet("""
            QLineEdit {
                background-color: #f8f9fa;
                border: 1px solid #dee2e6;
                border-radius: 4px;
                padding: 8px;
                color: #495057;
                font-family: monospace;
                font-size: 11px;
            }
            QLineEdit:focus {
                border: 2px solid #007bff;
            }
        """)
        self.output_dir_edit.mousePressEvent = self.on_output_dir_click
        output_layout.addWidget(self.output_dir_edit)
        

        layout.addWidget(output_group)
        
        return panel
        
    def add_files(self):
        """Add files via file dialog"""
        files, _ = QFileDialog.getOpenFileNames(
            self,
            "Select Audio Files",
            "",
            "Audio Files (*.wav *.mp3 *.flac *.aiff *.m4a *.ogg);;All Files (*)"
        )
        if files:
            self.add_files_to_list(files)
            
    def add_folder(self):
        """Add folder via folder dialog"""
        folder = QFileDialog.getExistingDirectory(
            self,
            "Select Folder with Audio Files"
        )
        if folder:
            # Find all audio files in the folder
            audio_extensions = {'.wav', '.mp3', '.flac', '.aiff', '.m4a', '.ogg'}
            audio_files = []
            
            for file_path in Path(folder).rglob("*"):
                if file_path.suffix.lower() in audio_extensions:
                    audio_files.append(str(file_path))
                    
            if audio_files:
                self.add_files_to_list(audio_files)
            else:
                QMessageBox.information(self, "No Audio Files", 
                                      "No audio files found in the selected folder.")
                
    def add_files_to_list(self, file_paths: List[str]):
        """Add files to the file list"""
        self.combined_file_widget.add_files(file_paths)
        self.update_process_button()
        
    def clear_files(self):
        """Clear all files from the list"""
        self.combined_file_widget.clear_files()
        self.update_process_button()
        
    def on_files_dropped(self, file_paths: List[str]):
        """Handle files dropped on the drag-drop area"""
        self.add_files_to_list(file_paths)
        
    def update_process_button(self):
        """Update the process button state and show/hide right panel"""
        # Check if there are files (excluding placeholder)
        has_files = False
        if self.file_list.rowCount() > 0:
            # Check if the first row is not a placeholder
            first_item = self.file_list.item(0, 0)
            if first_item and first_item.flags() != Qt.ItemFlag.NoItemFlags:
                has_files = True
        
        self.process_btn.setEnabled(has_files)
        
        # Show/hide right panel based on whether files are selected
        if has_files:
            self.right_panel.setVisible(True)
            self.right_panel.show()
            # Force the splitter to show the right panel
            self.splitter.setSizes([200, 400, 300])
        else:
            self.right_panel.setVisible(False)
            self.right_panel.hide()
            # Hide the right panel by setting its size to 0
            self.splitter.setSizes([200, 400, 0])
            
        self.update_output_directory_display()
        
    def process_files(self):
        """Start processing the files"""
        # Check if there are files (excluding placeholder)
        has_files = False
        if self.file_list.rowCount() > 0:
            # Check if the first row is not a placeholder
            first_item = self.file_list.item(0, 0)
            if first_item and first_item.flags() != Qt.ItemFlag.NoItemFlags:
                has_files = True
        
        if not has_files:
            return
            
        # Get file paths from the second column
        file_paths = []
        for row in range(self.file_list.rowCount()):
            path_item = self.file_list.item(row, 1)
            if path_item and path_item.flags() != Qt.ItemFlag.NoItemFlags:
                file_paths.append(path_item.text())
        
        # Get settings
        settings = {
            'threshold': self.threshold_spin.value(),
            'min_duration': self.duration_spin.value(),
            'padding': self.padding_spin.value(),
            'overwrite': self.overwrite_check.isChecked(),
            'preserve_stereo': self.preserve_stereo_check.isChecked()
        }
        
        # Add custom output directory to settings if set
        if self.custom_output_directory:
            settings['custom_output_dir'] = self.custom_output_directory
        
        # Start processing in a separate thread
        self.processing_thread = ProcessingThread(
            file_paths, settings, self.audio_processor
        )
        self.processing_thread.progress_updated.connect(
            self.progress_widget.update_progress
        )
        self.processing_thread.file_processed.connect(
            lambda file_path, success, output_path: self.progress_widget.update_file_progress(file_path, success, output_path)
        )
        self.processing_thread.finished.connect(self.on_processing_finished)
        self.processing_thread.error_occurred.connect(self.on_processing_error)
        
        # Update UI state
        self.process_btn.setEnabled(False)
        self.stop_btn.setEnabled(True)
        self.progress_widget.start_processing()
        
        # Start the thread
        self.processing_thread.start()
        
    def stop_processing(self):
        """Stop the processing thread"""
        if self.processing_thread and self.processing_thread.isRunning():
            self.processing_thread.stop()
            
    def on_processing_finished(self):
        """Handle processing completion"""
        self.process_btn.setEnabled(True)
        self.stop_btn.setEnabled(False)
        self.progress_widget.finish_processing()
        
        # Get summary information
        summary_info = self.progress_widget.get_summary_info()
        output_dir = self._get_output_directory()
        
        # Check if there were any failures
        failed_files = summary_info.get('failed_files', 0) if summary_info else 0
        total_files = summary_info.get('total_files', 0) if summary_info else 0
        processed_files = summary_info.get('files_processed', 0) if summary_info else 0
        
        # Create completion message based on results
        if failed_files == 0:
            message = "All files have been processed successfully!\n\n"
        elif processed_files == 0:
            message = "Processing completed with errors.\n\n"
        else:
            message = f"Processing completed with {failed_files} file(s) that failed to process.\n\n"
        
        if summary_info:
            message += f"📊 Processing Summary:\n"
            message += f"Files: {processed_files}/{total_files} processed successfully\n"
            if failed_files > 0:
                message += f"Failed: {failed_files} file(s)\n"
            message += f"Original: {summary_info['original_mb']:.1f} MB\n"
            message += f"Processed: {summary_info['processed_mb']:.1f} MB\n"
            message += f"Reduction: {summary_info['reduction_percent']:.1f}% ({summary_info['reduction_mb']:.1f} MB)\n\n"
        
        if output_dir:
            message += f"📁 Output Directory:\n{output_dir}"
        else:
            message += "📁 Check the original file locations for processed files"
        
        # Use appropriate dialog type based on results
        if failed_files == 0:
            QMessageBox.information(
                self,
                "Processing Complete",
                message
            )
        else:
            QMessageBox.warning(
                self,
                "Processing Complete",
                message
            )
        
    def _get_output_directory(self):
        """Get the output directory path"""
        # Check if there are files (excluding placeholder)
        has_files = False
        if self.file_list.rowCount() > 0:
            # Check if the first row is not a placeholder
            first_item = self.file_list.item(0, 0)
            if first_item and first_item.flags() != Qt.ItemFlag.NoItemFlags:
                has_files = True
        
        if not has_files:
            return None
            
        # If custom output directory is set, use it
        if self.custom_output_directory:
            return self.custom_output_directory
            
        # Get the first file to determine output directory
        first_file_item = self.file_list.item(0, 1)  # Get from second column
        if not first_file_item:
            return None
        first_file = first_file_item.text()
        try:
            from audio.processor import AudioProcessor
            processor = AudioProcessor()
            
            # Get settings
            settings = {
                'threshold': self.threshold_spin.value(),
                'min_duration': self.duration_spin.value(),
                'padding': self.padding_spin.value(),
                'overwrite': self.overwrite_check.isChecked(),
                'preserve_stereo': self.preserve_stereo_check.isChecked()
            }
            
            # Find the root directory that was originally dragged in
            root_dir = processor._find_root_directory(first_file)
            if root_dir:
                # Create the root trimmed directory path
                root_name = root_dir.name
                new_root_name = f"{root_name}_trimmed"
                new_root_path = root_dir.parent / new_root_name
                return str(new_root_path)
            else:
                # Fallback: get output path for the first file and go up to parent
                output_path = processor.get_output_path(first_file, settings)
                if output_path:
                    from pathlib import Path
                    output_dir = Path(output_path).parent
                    return str(output_dir)
        except Exception as e:
            print(f"Error getting output directory: {e}")
            
        return None
        
    def update_output_directory_display(self):
        """Update the output directory display"""
        output_dir = self._get_output_directory()
        
        if output_dir:
            # Show the output directory path
            self.output_dir_edit.setText(f"📁 {output_dir}")
            self.output_dir_edit.setToolTip(output_dir)
        else:
            # No files selected
            self.output_dir_edit.setText("")
            self.output_dir_edit.setToolTip("")
            
    def change_output_directory(self):
        """Change the output directory"""
        new_dir = QFileDialog.getExistingDirectory(
            self,
            "Select Output Directory",
            str(Path.home()),
            QFileDialog.Option.ShowDirsOnly
        )
        
        if new_dir:
            self.custom_output_directory = new_dir
            self.update_output_directory_display()
            
    def reset_output_directory(self):
        """Reset to default output directory"""
        self.custom_output_directory = None
        self.update_output_directory_display()
        
    def on_overwrite_changed(self, checked: bool):
        """Handle overwrite checkbox changes"""
        if checked:
            # If overwrite is checked, clear custom output directory
            self.custom_output_directory = None
        self.update_output_directory_display()
        
    def on_settings_changed(self):
        """Handle settings changes that affect output directory"""
        self.update_output_directory_display()
        
    def on_output_dir_click(self, event):
        """Handle click on output directory field"""
        # Open directory dialog when clicked
        self.change_output_directory()
        
    def preview_selected(self):
        """Preview the selected file"""
        selected_rows = self.file_list.selectionModel().selectedRows()
        
        if not selected_rows:
            QMessageBox.information(
                self,
                "No File Selected",
                "Please select a file to preview."
            )
            return
            
        if len(selected_rows) > 1:
            QMessageBox.information(
                self,
                "Multiple Files Selected",
                "Please select only one file to preview."
            )
            return
            
        # Get the selected file path from the second column
        row = selected_rows[0].row()
        path_item = self.file_list.item(row, 1)
        if not path_item:
            QMessageBox.information(
                self,
                "No File Selected",
                "Please select a file to preview."
            )
            return
            
        original_file = path_item.text()
        
        # Check if the file has been processed
        settings = {
            'threshold': self.threshold_spin.value(),
            'min_duration': self.duration_spin.value(),
            'padding': self.padding_spin.value(),
            'overwrite': self.overwrite_check.isChecked()
        }
        
        # Get the output path
        custom_output_dir = self.custom_output_directory
        output_path = self.audio_processor.get_output_path(original_file, settings, custom_output_dir)
        
        # Check if trimmed file exists
        if not os.path.exists(output_path):
            QMessageBox.information(
                self,
                "No Trimmed File",
                "This file hasn't been processed yet. Please process it first to preview the comparison."
            )
            return
            
        # Show the preview dialog
        try:
            # Create a new dialog instance each time to ensure fresh state
            preview_dialog = AudioPreviewDialog(original_file, output_path, self)
            preview_dialog.exec()
            # Clean up the dialog after it's closed
            preview_dialog.deleteLater()
        except Exception as e:
            QMessageBox.critical(
                self,
                "Preview Error",
                f"Error opening preview dialog:\n{str(e)}"
            )
            
    def show_context_menu(self, position):
        """Show context menu for file list"""
        menu = QMenu()
        
        # Get the item at the clicked position
        item = self.file_list.itemAt(position)
        if item and item.flags() != Qt.ItemFlag.NoItemFlags:
            # Add preview action
            preview_action = menu.addAction("Preview")
            preview_action.triggered.connect(self.preview_selected)
            
            # Add separator
            menu.addSeparator()
            
            # Add rename action
            rename_action = menu.addAction("Rename File")
            rename_action.triggered.connect(lambda: self.rename_selected_file_inline(item))
            
            # Add separator
            menu.addSeparator()
            
            # Add remove action
            remove_action = menu.addAction("Remove from List")
            remove_action.triggered.connect(lambda: self.remove_selected_file(item))
            
        menu.exec(self.file_list.mapToGlobal(position))
        
    def remove_selected_file(self, item):
        """Remove a file from the list"""
        row = self.file_list.row(item)
        self.file_list.removeRow(row)
        self.update_process_button()
        
    def rename_selected_file(self, item):
        """Rename a file with undo support"""
        row = self.file_list.row(item)
        path_item = self.file_list.item(row, 1)
        if not path_item:
            return
            
        old_path = path_item.text()
        old_filename = self.file_list.item(row, 0).text()
        
        # Get new filename from user
        new_filename, ok = QInputDialog.getText(
            self, 
            "Rename File", 
            "Enter new filename:", 
            QLineEdit.EchoMode.Normal, 
            old_filename
        )
        
        # Only proceed if user clicked OK and entered a different name
        if ok and new_filename and new_filename != old_filename:
            try:
                from pathlib import Path
                old_path_obj = Path(old_path)
                new_path_obj = old_path_obj.parent / new_filename
                
                # Check if new filename already exists
                if new_path_obj.exists():
                    QMessageBox.warning(
                        self,
                        "File Exists",
                        f"A file named '{new_filename}' already exists in this directory."
                    )
                    return
                
                # Store undo information BEFORE renaming
                if not hasattr(self, 'undo_stack'):
                    self.undo_stack = []
                
                undo_info = {
                    'type': 'rename',
                    'old_path': str(old_path_obj),
                    'new_path': str(new_path_obj),
                    'row': row
                }
                self.undo_stack.append(undo_info)
                
                # Rename the file on disk
                old_path_obj.rename(new_path_obj)
                
                # Update the display
                self.file_list.item(row, 0).setText(new_filename)
                self.file_list.item(row, 1).setText(str(new_path_obj))
                
                # Enable undo action
                if hasattr(self, 'undo_action'):
                    self.undo_action.setEnabled(True)
                    
            except Exception as e:
                QMessageBox.critical(
                    self,
                    "Rename Error",
                    f"Failed to rename file:\n{str(e)}"
                )
                
    def rename_selected_file_inline(self, item):
        """Rename a file with inline editing behavior"""
        row = self.file_list.row(item)
        path_item = self.file_list.item(row, 1)
        if not path_item:
            return
            
        old_path = path_item.text()
        old_filename = self.file_list.item(row, 0).text()
        
        # Create a custom dialog for inline editing
        
        dialog = QDialog(self)
        dialog.setWindowTitle("Rename File")
        dialog.setModal(True)
        dialog.setFixedSize(400, 150)
        
        layout = QVBoxLayout(dialog)
        
        # Label
        label = QLabel(f"Rename '{old_filename}' to:")
        layout.addWidget(label)
        
        # Input field
        input_field = QLineEdit(old_filename)
        input_field.selectAll()  # Select all text for easy editing
        layout.addWidget(input_field)
        
        # Buttons
        button_layout = QHBoxLayout()
        cancel_btn = QPushButton("Cancel")
        rename_btn = QPushButton("Rename")
        rename_btn.setDefault(True)
        
        button_layout.addWidget(cancel_btn)
        button_layout.addWidget(rename_btn)
        layout.addLayout(button_layout)
        
        # Connect signals
        cancel_btn.clicked.connect(dialog.reject)
        rename_btn.clicked.connect(dialog.accept)
        input_field.returnPressed.connect(dialog.accept)
        input_field.escapePressed.connect(dialog.reject)
        
        # Focus on input field
        input_field.setFocus()
        
        # Show dialog
        result = dialog.exec()
        
        if result == QDialog.DialogCode.Accepted:
            new_filename = input_field.text().strip()
            
            # Only proceed if name changed
            if new_filename and new_filename != old_filename:
                try:
                    from pathlib import Path
                    old_path_obj = Path(old_path)
                    new_path_obj = old_path_obj.parent / new_filename
                    
                    # Check if new filename already exists
                    if new_path_obj.exists():
                        QMessageBox.warning(
                            self,
                            "File Exists",
                            f"A file named '{new_filename}' already exists in this directory."
                        )
                        return
                    
                    # Store undo information BEFORE renaming
                    if not hasattr(self, 'undo_stack'):
                        self.undo_stack = []
                    
                    undo_info = {
                        'type': 'rename',
                        'old_path': str(old_path_obj),
                        'new_path': str(new_path_obj),
                        'row': row
                    }
                    self.undo_stack.append(undo_info)
                    
                    # Rename the file on disk
                    old_path_obj.rename(new_path_obj)
                    
                    # Update the display
                    self.file_list.item(row, 0).setText(new_filename)
                    self.file_list.item(row, 1).setText(str(new_path_obj))
                    
                    # Enable undo action
                    if hasattr(self, 'undo_action'):
                        self.undo_action.setEnabled(True)
                        
                except Exception as e:
                    QMessageBox.critical(
                        self,
                        "Rename Error",
                        f"Failed to rename file:\n{str(e)}"
                    )
                
    def undo_last_action(self):
        """Undo the last action"""
        if not hasattr(self, 'undo_stack') or not self.undo_stack:
            return
            
        undo_info = self.undo_stack.pop()
        
        if undo_info['type'] == 'rename':
            try:
                from pathlib import Path
                old_path = Path(undo_info['old_path'])
                new_path = Path(undo_info['new_path'])
                
                # Rename back
                new_path.rename(old_path)
                
                # Update display
                row = undo_info['row']
                if row < self.file_list.rowCount():
                    old_filename = old_path.name
                    self.file_list.item(row, 0).setText(old_filename)
                    self.file_list.item(row, 1).setText(str(old_path))
                    
            except Exception as e:
                QMessageBox.critical(
                    self,
                    "Undo Error",
                    f"Failed to undo rename:\n{str(e)}"
                )
        
        # Disable undo if no more actions
        if not self.undo_stack and hasattr(self, 'undo_action'):
            self.undo_action.setEnabled(False)
            
    def on_processing_error(self, error_message: str):
        """Handle processing errors"""
        self.process_btn.setEnabled(True)
        self.stop_btn.setEnabled(False)
        self.progress_widget.finish_processing()
        
        QMessageBox.critical(
            self,
            "Processing Error",
            f"An error occurred during processing:\n{error_message}"
        )
        
    def on_favorite_selected(self, directory: str):
        """Handle favorite directory selection"""
        # Clear existing files
        self.clear_files()
        
        # Create progress dialog
        self.scan_progress = QProgressDialog(
            f"Scanning directory for audio files...\n{directory}",
            "Cancel",
            0,
            100,
            self
        )
        self.scan_progress.setWindowTitle("Scanning Directory")
        self.scan_progress.setModal(True)
        self.scan_progress.setAutoClose(False)
        self.scan_progress.setAutoReset(False)
        
        # Store start time for minimum display duration
        self.scan_start_time = time.time()
        
        # Create and start directory scan thread
        self.directory_scan_thread = DirectoryScanThread(directory)
        self.directory_scan_thread.progress_updated.connect(self.scan_progress.setValue)
        self.directory_scan_thread.scan_finished.connect(self.on_scan_finished)
        self.directory_scan_thread.error_occurred.connect(self.on_scan_error)
        
        # Connect cancel button
        self.scan_progress.canceled.connect(self.directory_scan_thread.stop)
        
        # Start scanning
        self.directory_scan_thread.start()
        self.scan_progress.show()
        
    def on_scan_finished(self, audio_files: List[str]):
        """Handle directory scan completion"""
        # Ensure minimum display time (1 second)
        if hasattr(self, 'scan_start_time'):
            elapsed_time = time.time() - self.scan_start_time
            if elapsed_time < 1.0:
                # Use QTimer to delay closing
                from PyQt6.QtCore import QTimer
                QTimer.singleShot(int((1.0 - elapsed_time) * 1000), lambda: self._close_scan_progress(audio_files))
                return
        
        self._close_scan_progress(audio_files)
    
    def _close_scan_progress(self, audio_files: List[str] = None):
        """Close scan progress dialog and handle results"""
        # Close progress dialog
        if hasattr(self, 'scan_progress'):
            self.scan_progress.close()
            self.scan_progress = None
        
        # Clean up thread
        if self.directory_scan_thread:
            self.directory_scan_thread.quit()
            self.directory_scan_thread.wait()
            self.directory_scan_thread = None
        
        # Add files to list if provided
        if audio_files is not None:
            if audio_files:
                self.add_files_to_list(audio_files)
                QMessageBox.information(
                    self, 
                    "Files Added", 
                    f"Added {len(audio_files)} audio files from the selected directory."
                )
            else:
                QMessageBox.information(
                    self, 
                    "No Audio Files", 
                    "No audio files found in the selected directory."
                )
    
    def on_scan_error(self, error_message: str):
        """Handle directory scan error"""
        # Close progress dialog
        if hasattr(self, 'scan_progress'):
            self.scan_progress.close()
            self.scan_progress = None
        
        # Clean up thread
        if self.directory_scan_thread:
            self.directory_scan_thread.quit()
            self.directory_scan_thread.wait()
            self.directory_scan_thread = None
        
        # Show error message
        QMessageBox.warning(
            self, 
            "Scan Error", 
            f"Error scanning directory:\n{error_message}"
        )
        
    def on_favorites_changed(self, favorites: List[Dict[str, str]]):
        """Handle favorites list changes"""
        self.favorites = favorites
        self.settings_manager.save_favorites(favorites)
        
    def load_settings(self):
        """Load application settings"""
        # Load window geometry and state
        geometry = self.settings_manager.load_window_geometry()
        if geometry:
            self.restoreGeometry(geometry)
            
        state = self.settings_manager.load_window_state()
        if state:
            self.restoreState(state)
            
        # Load favorites
        self.favorites = self.settings_manager.load_favorites()
        self.favorites_sidebar.set_favorites(self.favorites)
        
    def save_settings(self):
        """Save application settings"""
        self.settings_manager.save_window_geometry(self.saveGeometry())
        self.settings_manager.save_window_state(self.saveState())
        
    def show_welcome_if_needed(self):
        """Show welcome dialog if needed"""
        if self.settings_manager.load_show_welcome():
            welcome_dialog = WelcomeDialog(self)
            if welcome_dialog.exec() == WelcomeDialog.DialogCode.Accepted:
                # Update favorites from welcome dialog
                self.favorites = welcome_dialog.get_favorites()
                self.favorites_sidebar.set_favorites(self.favorites)
                
                # Save show welcome preference
                self.settings_manager.save_show_welcome(welcome_dialog.should_show_welcome())
        
    def closeEvent(self, event):
        """Handle window close event"""
        self.save_settings()
        super().closeEvent(event)


class DirectoryScanThread(QThread):
    """Thread for scanning directories for audio files"""
    
    progress_updated = pyqtSignal(int)
    scan_finished = pyqtSignal(list)  # list of audio file paths
    error_occurred = pyqtSignal(str)
    
    def __init__(self, directory: str):
        super().__init__()
        self.directory = directory
        self._stop_flag = False
        
    def run(self):
        """Run the directory scanning thread"""
        try:
            audio_extensions = {'.wav', '.mp3', '.flac', '.aiff', '.m4a', '.ogg'}
            audio_files = []
            
            # First, count total files for progress
            total_files = 0
            for _ in Path(self.directory).rglob("*"):
                if self._stop_flag:
                    return
                total_files += 1
            
            # Now scan for audio files
            scanned_files = 0
            last_progress = -1
            
            for file_path in Path(self.directory).rglob("*"):
                if self._stop_flag:
                    return
                    
                scanned_files += 1
                if file_path.is_file() and file_path.suffix.lower() in audio_extensions:
                    audio_files.append(str(file_path))
                
                # Update progress more granularly (every 5% or every 10 files)
                progress = int((scanned_files / total_files) * 100) if total_files > 0 else 0
                if progress != last_progress or scanned_files % 10 == 0:
                    self.progress_updated.emit(progress)
                    last_progress = progress
                    
                    # Small delay to make progress visible
                    if scanned_files % 50 == 0:
                        self.msleep(10)  # 10ms delay every 50 files
            
            # Ensure we show 100% at the end
            self.progress_updated.emit(100)
            
            # Small delay before finishing to show completion
            self.msleep(200)
            
            self.scan_finished.emit(audio_files)
            
        except Exception as e:
            self.error_occurred.emit(str(e))
            
    def stop(self):
        """Stop the scanning thread"""
        self._stop_flag = True


class ProcessingThread(QThread):
    """Thread for processing audio files"""
    
    progress_updated = pyqtSignal(int)
    file_processed = pyqtSignal(str, bool, str)  # file_path, success, output_path
    error_occurred = pyqtSignal(str)
    
    def __init__(self, file_paths: List[str], settings: dict, processor: AudioProcessor):
        super().__init__()
        self.file_paths = file_paths
        self.settings = settings
        self.processor = processor
        self._stop_flag = False
        
    def run(self):
        """Run the processing thread"""
        try:
            total_files = len(self.file_paths)
            
            for i, file_path in enumerate(self.file_paths):
                if self._stop_flag:
                    break
                    
                try:
                    # Get custom output directory from settings
                    custom_output_dir = self.settings.get('custom_output_dir')
                    
                    # Process the file
                    success = self.processor.process_file(
                        file_path, 
                        self.settings
                    )
                    
                    # Get output path for successful processing
                    output_path = ""
                    if success:
                        output_path = self.processor.get_output_path(file_path, self.settings, custom_output_dir)
                    
                    # Emit progress signals
                    progress = int((i + 1) / total_files * 100)
                    self.progress_updated.emit(progress)
                    self.file_processed.emit(file_path, success, output_path)
                    
                except Exception as e:
                    self.file_processed.emit(file_path, False, "")
                    print(f"Error processing {file_path}: {e}")
                    
        except Exception as e:
            self.error_occurred.emit(str(e))
            
    def stop(self):
        """Stop the processing thread"""
        self._stop_flag = True 