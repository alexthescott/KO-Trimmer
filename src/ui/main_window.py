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
    QSpinBox, QDoubleSpinBox, QCheckBox, QMenu,
    QProgressDialog, QLineEdit, QInputDialog, QMenuBar,
    QDialog, QVBoxLayout, QHBoxLayout, QLabel, QPushButton,
    QApplication, QSizePolicy, QComboBox
)
from PyQt6.QtCore import Qt, QThread, pyqtSignal, QMimeData, QTimer
from PyQt6.QtGui import QDragEnterEvent, QDropEvent, QIcon, QAction

# AudioProcessor will be imported lazily in _deferred_init
from .combined_file_widget import CombinedFileWidget
from .audio_preview import AudioPreviewDialog, AudioPreviewWidget
from .favorites_sidebar import FavoritesSidebar
from .processing_window import ProcessingWindow
from .welcome_dialog import WelcomeDialog
from ..utils.settings_manager import SettingsManager
from ..utils.icon_manager import show_information, show_warning, show_critical, set_dialog_icon, get_app_icon
from ..utils.error_handler import error_handler, setup_error_handling


class MainWindow(QMainWindow):
    """Main application window"""
    
    def __init__(self):
        super().__init__()
        self.audio_processor = None  # Defer initialization
        self.processing_thread = None
        self.directory_scan_thread = None
        self.processing_window = None
        self.settings_manager = SettingsManager()
        self.favorites = []
        self.custom_output_directory = None  # Store custom output directory
        
        # Setup error handling
        setup_error_handling()
        error_handler.set_error_callback(self.show_error_dialog)
        
        # Connect error handler signals for thread-safe error display
        error_handler.error_occurred.connect(self.show_error_dialog)
        error_handler.warning_occurred.connect(self.show_warning_dialog)
        
        self.init_ui()
        self.load_settings()
        
        # Defer heavy initialization until after window is shown
        from PyQt6.QtCore import QTimer
        QTimer.singleShot(100, self._deferred_init)
        
    def _deferred_init(self):
        """Initialize heavy components after window is shown"""
        # Initialize audio processor
        from ..audio.processor import AudioProcessor
        self.audio_processor = AudioProcessor()
        
        # Show welcome dialog if needed
        self.show_welcome_if_needed()
        
    def init_ui(self):
        """Initialize the user interface"""
        self.setWindowTitle("KO Trimmer - Audio Silence Trimmer")
        self.setMinimumSize(900, 700)  # Increased height for new layout
        self.resize(900, 700)  # Set initial size to full layout size
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
        
        # Create main layout - horizontal with favorites on left
        main_layout = QHBoxLayout(central_widget)

        # Create left panel for favorites sidebar
        left_panel = QWidget()
        left_layout = QVBoxLayout(left_panel)
        left_layout.setContentsMargins(0, 0, 0, 0)
        left_layout.setSpacing(0)
        
        # Initialize favorites sidebar
        self.favorites_sidebar = FavoritesSidebar()
        self.favorites_sidebar.favorite_selected.connect(self.on_favorite_selected)
        self.favorites_sidebar.favorites_changed.connect(self.on_favorites_changed)
        self.favorites_sidebar.setSizePolicy(QSizePolicy.Policy.Fixed, QSizePolicy.Policy.Expanding)
        self.favorites_sidebar.favorites_changed.connect(self.on_favorites_visibility_changed)
        
        # Add favorites sidebar to left panel
        left_layout.addWidget(self.favorites_sidebar)
        main_layout.addWidget(left_panel)
        
        # Right section - Vertical layout for everything else
        right_section = QWidget()
        right_layout = QVBoxLayout(right_section)
        
        # Top section - Audio Preview and Settings
        top_layout = QHBoxLayout()
        
        # Center panel - Audio Preview
        self.audio_preview_widget = AudioPreviewWidget()
        self.audio_preview_widget.preview_closed.connect(self.on_preview_closed)
        top_layout.addWidget(self.audio_preview_widget)
        
        # Right panel - Settings and controls
        self.right_panel = self.create_control_panel()
        top_layout.addWidget(self.right_panel)
        
        # Add top section to right layout
        right_layout.addLayout(top_layout)
        
        # Bottom section - Files to Process (full width of right section)
        bottom_panel = self.create_file_panel()
        right_layout.addWidget(bottom_panel)
        
        # Add right section to main layout
        main_layout.addWidget(right_section)
        
        # Initially hide the right panel until files are added
        self.right_panel.hide()
        
    def create_menu_bar(self):
        """Create the application menu bar"""
        menubar = self.menuBar()
        
        # File menu
        file_menu = menubar.addMenu("File")
        
        # Close Window action
        close_action = file_menu.addAction("Close Window")
        close_action.setShortcut("Ctrl+W")  # Will show as Cmd+W on macOS
        close_action.triggered.connect(self.close)
        
        # Add Favorite action
        add_favorite_action = file_menu.addAction("Add Favorite")
        add_favorite_action.setShortcut("Ctrl+D")  # Will show as Cmd+D on macOS
        add_favorite_action.triggered.connect(self.add_favorite_from_main)
        
        file_menu.addSeparator()
        
        # Quit action
        quit_action = file_menu.addAction("Quit")
        quit_action.setShortcut("Ctrl+Q")  # Will show as Cmd+Q on macOS
        quit_action.triggered.connect(QApplication.quit)
        
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
        
        # Connect selection change to auto-update preview
        self.file_list.selectionModel().selectionChanged.connect(self.on_file_selection_changed)
        
        # File list buttons
        file_buttons_layout = QHBoxLayout()
        
        self.clear_btn = QPushButton("Clear All")
        self.clear_btn.clicked.connect(self.clear_files)
        self.clear_btn.setVisible(False)  # Initially hidden
        file_buttons_layout.addWidget(self.clear_btn)
        
        self.preview_btn = QPushButton("Show Preview")
        self.preview_btn.clicked.connect(self.preview_selected)
        file_buttons_layout.addWidget(self.preview_btn)
        
        file_layout.addLayout(file_buttons_layout)
        layout.addWidget(file_group)
        
        return panel
        
    def create_control_panel(self) -> QWidget:
        """Create the control panel with settings"""
        panel = QWidget()
        layout = QVBoxLayout(panel)
        
        # Create horizontal layout for settings and controls
        top_layout = QHBoxLayout()
        
        # Left side - Settings group
        settings_group = QGroupBox("Silence Detection Settings")
        settings_layout = QVBoxLayout(settings_group)
        
        # Silence threshold
        threshold_layout = QHBoxLayout()
        threshold_layout.addWidget(QLabel("Silence Threshold (dB):"))
        self.threshold_spin = QDoubleSpinBox()
        self.threshold_spin.setRange(-60, 0)
        self.threshold_spin.setValue(-50)  # More forgiving for natural decay
        self.threshold_spin.setSuffix(" dB")
        self.threshold_spin.setMaximumWidth(80)  # Limit width
        threshold_layout.addWidget(self.threshold_spin)
        threshold_layout.addStretch()  # Push to left
        settings_layout.addLayout(threshold_layout)
        
        # Minimum silence duration
        duration_layout = QHBoxLayout()
        duration_layout.addWidget(QLabel("Min Silence Duration (ms):"))
        self.duration_spin = QSpinBox()
        self.duration_spin.setRange(100, 10000)
        self.duration_spin.setValue(1000)  # Longer duration to avoid cutting natural decay
        self.duration_spin.setSuffix(" ms")
        self.duration_spin.setMaximumWidth(80)  # Limit width
        duration_layout.addWidget(self.duration_spin)
        duration_layout.addStretch()  # Push to left
        settings_layout.addLayout(duration_layout)
        
        # Padding
        padding_layout = QHBoxLayout()
        padding_layout.addWidget(QLabel("Padding (ms):"))
        self.padding_spin = QSpinBox()
        self.padding_spin.setRange(0, 1000)
        self.padding_spin.setValue(20)  # Reduced padding for tighter trimming
        self.padding_spin.setSuffix(" ms")
        self.padding_spin.setMaximumWidth(80)  # Limit width
        padding_layout.addWidget(self.padding_spin)
        padding_layout.addStretch()  # Push to left
        settings_layout.addLayout(padding_layout)
        
        # Options - reorganized with checkboxes on left
        options_layout = QHBoxLayout()
        
        # Left side - checkboxes and bitrate
        checkbox_layout = QVBoxLayout()
        
        self.overwrite_check = QCheckBox("Overwrite")
        self.overwrite_check.setChecked(False)
        self.overwrite_check.toggled.connect(self.on_overwrite_changed)
        checkbox_layout.addWidget(self.overwrite_check)
        
        self.preserve_stereo_check = QCheckBox("Preserve Stereo")
        self.preserve_stereo_check.setChecked(True)  # Default to preserving stereo
        self.preserve_stereo_check.toggled.connect(self.on_settings_changed)
        checkbox_layout.addWidget(self.preserve_stereo_check)
        
        # Conversion-only mode (skip silence detection)
        self.conversion_only_check = QCheckBox("Conversion Only (Fast)")
        self.conversion_only_check.setChecked(False)  # Default to full processing
        self.conversion_only_check.toggled.connect(self.on_settings_changed)
        checkbox_layout.addWidget(self.conversion_only_check)
        
        # Bitrate reduction option
        bitrate_layout = QHBoxLayout()
        bitrate_layout.addWidget(QLabel("Bitrate:"))
        self.bitrate_combo = QComboBox()
        self.bitrate_combo.addItems(["320", "192", "160", "128", "96", "64"])
        self.bitrate_combo.setCurrentText("320")  # Default to no reduction
        self.bitrate_combo.setMaximumWidth(80)
        self.bitrate_combo.currentTextChanged.connect(self.on_bitrate_changed)
        bitrate_layout.addWidget(self.bitrate_combo)
        bitrate_layout.addWidget(QLabel("kbps"))
        checkbox_layout.addLayout(bitrate_layout)
        
        options_layout.addLayout(checkbox_layout)
        
        # Right side - descriptions
        description_layout = QVBoxLayout()
        
        overwrite_desc = QLabel("Overwrite original files")
        overwrite_desc.setStyleSheet("color: #666666; font-size: 11px;")
        description_layout.addWidget(overwrite_desc)
        
        stereo_desc = QLabel("Convert to mono if unchecked")
        stereo_desc.setStyleSheet("color: #666666; font-size: 11px;")
        description_layout.addWidget(stereo_desc)
        
        conversion_desc = QLabel("Skip silence detection (10x faster)")
        conversion_desc.setStyleSheet("color: #666666; font-size: 11px;")
        description_layout.addWidget(conversion_desc)
        
        bitrate_desc = QLabel("Reduce file size (lower = smaller)")
        bitrate_desc.setStyleSheet("color: #666666; font-size: 11px;")
        description_layout.addWidget(bitrate_desc)
        
        options_layout.addLayout(description_layout)
        options_layout.addStretch()  # Push everything to left
        
        settings_layout.addLayout(options_layout)
        
        top_layout.addWidget(settings_group)
        
        # Right side - Output directory and Process button
        right_layout = QVBoxLayout()
        
        # Output directory group
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
        right_layout.addWidget(output_group)
        
        # Process button
        self.process_btn = QPushButton("Process Files")
        self.process_btn.clicked.connect(self.process_files)
        self.process_btn.setEnabled(False)
        self.process_btn.setStyleSheet("""
            QPushButton {
                background-color: #27ae60;
                color: white;
                border: none;
                border-radius: 4px;
                padding: 10px 20px;
                font-weight: bold;
                font-size: 14px;
            }
            QPushButton:hover {
                background-color: #2ecc71;
            }
            QPushButton:disabled {
                background-color: #bdc3c7;
                color: #7f8c8d;
            }
        """)
        right_layout.addWidget(self.process_btn)
        
        # Add right layout to top layout
        top_layout.addLayout(right_layout)
        
        # Add top layout to main layout
        layout.addLayout(top_layout)
        
        return panel
        
    def add_files_to_list(self, file_paths: List[str]):
        """Add files to the list"""
        self.combined_file_widget.add_files(file_paths)
        self.update_process_button()
        self.update_preview_button_state()
        self.update_clear_button_state()
        
        # Check for KO II compatibility warnings
        self._check_ko_ii_compatibility(file_paths)
        
    def _check_ko_ii_compatibility(self, file_paths: List[str]):
        """Check files for KO II compatibility and show warnings"""
        if self.audio_processor is None:
            return  # Can't check without processor
            
        incompatible_files = []
        
        for file_path in file_paths:
            try:
                compatibility_info = self.audio_processor.check_ko_ii_compatibility(file_path)
                if not compatibility_info['compatible']:
                    incompatible_files.append(compatibility_info)
            except Exception as e:
                print(f"Error checking KO II compatibility for {file_path}: {e}")
                
        # Show warning if any files are incompatible
        if incompatible_files:
            warning_message = "The following files are longer than 20 seconds and may not work properly on the KO II:\n\n"
            for file_info in incompatible_files:
                # Handle case where file_info might not have expected keys
                filename = file_info.get('filename', 'Unknown file')
                duration = file_info.get('duration_seconds', 0)
                warning_message += f"• {filename} ({duration:.1f}s)\n"
            warning_message += "\nThe KO II has a 20-second sample length limitation. Consider trimming these files for best compatibility."
            
            QMessageBox.warning(
                self,
                "KO II Compatibility Warning",
                warning_message
            )
        
    def clear_files(self):
        """Clear all files from the list"""
        self.combined_file_widget.clear_files()
        self.update_process_button()
        self.update_preview_button_state()
        self.update_clear_button_state()
        
    def on_files_dropped(self, file_paths: List[str]):
        """Handle files dropped on the drag-drop area"""
        self.add_files_to_list(file_paths)
        self.update_clear_button_state()
        
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
        else:
            self.right_panel.setVisible(False)
            self.right_panel.hide()
            
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
            'preserve_stereo': self.preserve_stereo_check.isChecked(),
            'conversion_only': self.conversion_only_check.isChecked(),
            'bitrate': int(self.bitrate_combo.currentText())
        }
        
        # Add custom output directory to settings if set
        if self.custom_output_directory:
            settings['custom_output_dir'] = self.custom_output_directory
        
        # Check if audio processor is initialized
        if self.audio_processor is None:
            QMessageBox.information(
                self,
                "Initializing",
                "Please wait a moment for the application to finish initializing."
            )
            return
            
        # Initialize the processing session with unified output structure
        self.audio_processor.start_processing_session(file_paths, settings)
            
        # Create and show processing window
        self.processing_window = ProcessingWindow(self)
        self.processing_window.processing_finished.connect(self.on_processing_finished)
        self.processing_window.start_processing(file_paths, settings, self.audio_processor)
        
    def on_processing_finished(self, summary_info: Dict[str, Any]):
        """Handle processing completion from the processing window"""
        # Re-enable the process button
        self.process_btn.setEnabled(True)
        
        # Get timing statistics from the audio processor
        if self.audio_processor:
            timing_stats = self.audio_processor.end_processing_session()
            print(f"🎯 Processing completed with timing: {timing_stats}")
        
        # Clean up the processing window reference
        self.processing_window = None
        
        # Update preview button state to show it after processing
        self.update_preview_button_state()
        
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
        
        # Check if audio processor is initialized
        if self.audio_processor is None:
            return None
            
        try:
            # Get settings
            settings = {
                'threshold': self.threshold_spin.value(),
                'min_duration': self.duration_spin.value(),
                'padding': self.padding_spin.value(),
                'overwrite': self.overwrite_check.isChecked(),
                'preserve_stereo': self.preserve_stereo_check.isChecked(),
                'bitrate': int(self.bitrate_combo.currentText())
            }
            
            # Find the root directory that was originally dragged in
            root_dir = self.audio_processor._find_root_directory(first_file)
            if root_dir:
                # Create the root trimmed directory path
                root_name = root_dir.name
                new_root_name = f"{root_name}_trimmed"
                new_root_path = root_dir.parent / new_root_name
                return str(new_root_path)
            else:
                # Fallback: get output path for the first file and go up to parent
                output_path = self.audio_processor._get_output_path(first_file, settings)
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
        # Get the current output directory to use as starting point
        current_dir = self._get_output_directory()
        if not current_dir:
            # Fallback to home directory if no current directory
            current_dir = str(Path.home())
        
        new_dir = QFileDialog.getExistingDirectory(
            self,
            "Select Output Directory",
            current_dir,
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
        
    def on_bitrate_changed(self, bitrate_text: str):
        """Handle bitrate changes"""
        try:
            bitrate = int(bitrate_text)
            # No need to check FFmpeg availability since we're using ffmpeg-python
            # which handles FFmpeg installation automatically
        except ValueError:
            pass  # Invalid bitrate text
        
        self.update_output_directory_display()
        
    def on_output_dir_click(self, event):
        """Handle click on output directory field"""
        # Open directory dialog when clicked
        self.change_output_directory()
        
    def preview_selected(self):
        """Preview the selected file or hide preview if already visible"""
        # Check if preview is currently visible
        if self.audio_preview_widget.isVisible():
            # Hide the preview
            self.audio_preview_widget.hide()
            self.preview_btn.setText("Show Preview")
            self.update_preview_button_state()
            return
            
        # Show preview logic
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
            'overwrite': self.overwrite_check.isChecked(),
            'preserve_stereo': self.preserve_stereo_check.isChecked()
        }
        
        # Get the output path
        custom_output_dir = self.custom_output_directory
        if self.audio_processor is None:
            QMessageBox.information(
                self,
                "Initializing",
                "Please wait a moment for the application to finish initializing."
            )
            return
        output_path = self.audio_processor._get_output_path(original_file, settings, custom_output_dir)
        
        # Check if trimmed file exists
        if not os.path.exists(output_path):
            QMessageBox.information(
                self,
                "No Trimmed File",
                "This file hasn't been processed yet. Please process it first to preview the comparison."
            )
            return
            
        # Show the embedded preview widget
        try:
            # Load files into the preview widget
            self.audio_preview_widget.load_files(original_file, output_path)
            # Show the preview widget
            self.audio_preview_widget.show()
            # Update button text
            self.preview_btn.setText("Hide Preview")
            self.update_preview_button_state()
        except Exception as e:
            QMessageBox.critical(
                self,
                "Preview Error",
                f"Error loading preview:\n{str(e)}"
            )
            
    def on_preview_closed(self):
        """Handle preview widget being closed"""
        # Reset the preview button text
        self.preview_btn.setText("Show Preview")
        self.update_preview_button_state()
            
    def on_file_selection_changed(self, selected, deselected):
        """Handle file selection changes to auto-update preview"""
        # Only update if preview is currently visible
        if self.audio_preview_widget.isVisible():
            # Get the currently selected file
            selected_rows = self.file_list.selectionModel().selectedRows()
            
            if selected_rows:
                # Get the selected file path
                row = selected_rows[0].row()
                path_item = self.file_list.item(row, 1)
                if path_item:
                    original_file = path_item.text()
                    
                    # Check if the file has been processed
                    settings = {
                        'threshold': self.threshold_spin.value(),
                        'min_duration': self.duration_spin.value(),
                        'padding': self.padding_spin.value(),
                        'overwrite': self.overwrite_check.isChecked(),
                        'preserve_stereo': self.preserve_stereo_check.isChecked()
                    }
                    
                    # Get the output path
                    custom_output_dir = self.custom_output_directory
                    if self.audio_processor is None:
                        return  # Skip if not initialized yet
                    output_path = self.audio_processor._get_output_path(original_file, settings, custom_output_dir)
                    
                    # Check if trimmed file exists
                    if os.path.exists(output_path):
                        try:
                            # Update the preview with the new file
                            self.audio_preview_widget.load_files(original_file, output_path)
                        except Exception as e:
                            print(f"Error updating preview: {e}")
                    else:
                        # Hide preview if no trimmed file exists
                        self.audio_preview_widget.hide()
                        self.preview_btn.setText("Show Preview")
            
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
        
    def on_favorites_visibility_changed(self, favorites: List[Dict[str, str]]):
        """Handle favorites visibility changes"""
        # The sidebar will automatically show/hide based on favorites count
        # We just need to ensure the layout updates properly
        self.update()
        has_favorites = bool(favorites)
        self.favorites_sidebar.setVisible(has_favorites)

    def add_favorite_from_main(self):
        """Allows adding a favorite directly from the main window when the sidebar is hidden."""
        self.favorites_sidebar.add_favorite()
        # The on_favorites_changed signal from sidebar will handle visibility update

    def update_preview_button_state(self):
        # Enable preview button only if there are files in the list AND they have been processed
        file_list = self.combined_file_widget.get_file_list()
        has_files = file_list.rowCount() > 0 and not (
            file_list.rowCount() == 1 and file_list.item(0, 0) and file_list.item(0, 0).flags() == Qt.ItemFlag.NoItemFlags
        )
        
        # Check if files have been processed by looking for processed output files
        has_processed_files = False
        if has_files and self.audio_processor is not None:
            try:
                # Check if any processed files exist
                for row in range(file_list.rowCount()):
                    path_item = file_list.item(row, 1)
                    if path_item and path_item.flags() != Qt.ItemFlag.NoItemFlags:
                        original_file = path_item.text()
                        settings = {
                            'threshold': self.threshold_spin.value(),
                            'min_duration': self.duration_spin.value(),
                            'padding': self.padding_spin.value(),
                            'overwrite': self.overwrite_check.isChecked(),
                            'preserve_stereo': self.preserve_stereo_check.isChecked(),
                            'bitrate': int(self.bitrate_combo.currentText())
                        }
                        output_path = self.audio_processor._get_output_path(original_file, settings, self.custom_output_directory)
                        if os.path.exists(output_path):
                            has_processed_files = True
                            break
            except Exception as e:
                print(f"Error checking processed files: {e}")
        
        self.preview_btn.setVisible(has_files and has_processed_files)
        self.preview_btn.setEnabled(has_files and has_processed_files)

    def update_clear_button_state(self):
        """Update the visibility of the Clear All button based on whether files are present"""
        file_list = self.combined_file_widget.get_file_list()
        has_files = file_list.rowCount() > 0 and not (
            file_list.rowCount() == 1 and file_list.item(0, 0) and file_list.item(0, 0).flags() == Qt.ItemFlag.NoItemFlags
        )
        self.clear_btn.setVisible(has_files)

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
        
        # Set initial visibility for add favorite button and preview button
        self.on_favorites_visibility_changed(self.favorites)
        self.update_preview_button_state()
        self.update_clear_button_state()

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
                
    def show_error_dialog(self, title: str, message: str):
        """Show error dialog using the icon manager"""
        show_critical(self, title, message)
        
    def show_warning_dialog(self, title: str, message: str):
        """Show warning dialog using the icon manager"""
        show_warning(self, title, message)
        
    def closeEvent(self, event):
        """Handle window close event"""
        self.save_settings()
        super().closeEvent(event)
        
    def keyPressEvent(self, event):
        """Handle keyboard shortcuts"""
        # Handle Cmd+W (close window), Cmd+Q (quit app), and Cmd+D (add favorite) on macOS
        if event.key() == Qt.Key.Key_W and event.modifiers() == Qt.KeyboardModifier.ControlModifier:
            self.close()
            event.accept()
        elif event.key() == Qt.Key.Key_Q and event.modifiers() == Qt.KeyboardModifier.ControlModifier:
            QApplication.quit()
            event.accept()
        elif event.key() == Qt.Key.Key_D and event.modifiers() == Qt.KeyboardModifier.ControlModifier:
            self.add_favorite_from_main()
            event.accept()
        else:
            super().keyPressEvent(event)


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
    processing_stopped = pyqtSignal(str, list)  # error_message, failed_files
    
    def __init__(self, file_paths: List[str], settings: dict, processor: 'AudioProcessor'):
        super().__init__()
        self.file_paths = file_paths
        self.settings = settings
        self.processor = processor
        self._stop_flag = False
        
    def run(self):
        """Run the processing thread"""
        try:
            total_files = len(self.file_paths)
            failed_files = []
            critical_error = None
            
            # Clear output directories before processing to overwrite with new content
            custom_output_dir = self.settings.get('custom_output_dir')
            self.processor.clear_output_directories(self.file_paths, self.settings, custom_output_dir)
            
            for i, file_path in enumerate(self.file_paths):
                if self._stop_flag:
                    break
                    
                try:
                    # Process the file
                    success = self.processor.process_file(
                        file_path, 
                        self.settings
                    )
                    
                    # Get output path for successful processing
                    output_path = ""
                    if success:
                        output_path = self.processor._get_output_path(file_path, self.settings, custom_output_dir)
                    else:
                        # Track failed files
                        failed_files.append(file_path)
                        
                        # Check if this is a critical error that should stop processing
                        if self._is_critical_error(file_path):
                            critical_error = f"Critical error processing {file_path}. Processing stopped."
                            break
                    
                    # Emit progress signals
                    progress = int((i + 1) / total_files * 100)
                    self.progress_updated.emit(progress)
                    self.file_processed.emit(file_path, success, output_path)
                    
                except Exception as e:
                    failed_files.append(file_path)
                    print(f"Error processing {file_path}: {e}")
                    
                    # Check if this is a critical error
                    if self._is_critical_error(file_path):
                        critical_error = f"Critical error processing {file_path}: {e}. Processing stopped."
                        break
                    
                    # Emit failure signal
                    self.file_processed.emit(file_path, False, "")
                    
            # If we had a critical error, emit the stop signal
            if critical_error:
                self.processing_stopped.emit(critical_error, failed_files)
                    
        except Exception as e:
            self.error_occurred.emit(str(e))
    
    def _is_critical_error(self, file_path: str) -> bool:
        """Determine if an error is critical enough to stop processing"""
        # Critical errors include:
        # - Audio format not supported
        # - File corruption
        # - Permission issues
        # - Disk space issues
        # - FFmpeg/compression failures
        
        # For now, we'll consider all errors as potentially critical
        # This can be refined based on specific error types
        return True
            
    def stop(self):
        """Stop the processing thread"""
        self._stop_flag = True 