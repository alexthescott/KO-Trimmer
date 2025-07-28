"""
Main window for KO Trimmer application
"""

import os
import time
from pathlib import Path
from typing import List, Optional

from PyQt6.QtWidgets import (
    QMainWindow, QWidget, QVBoxLayout, QHBoxLayout, 
    QPushButton, QLabel, QProgressBar, QListWidget,
    QListWidgetItem, QMessageBox, QFileDialog, QGroupBox,
    QSpinBox, QDoubleSpinBox, QCheckBox, QSplitter, QMenu,
    QProgressDialog
)
from PyQt6.QtCore import Qt, QThread, pyqtSignal, QMimeData
from PyQt6.QtGui import QDragEnterEvent, QDropEvent, QIcon

from audio.processor import AudioProcessor
from ui.drag_drop import DragDropWidget
from ui.progress import ProcessingProgressWidget
from ui.audio_preview import AudioPreviewDialog
from ui.favorites_sidebar import FavoritesSidebar
from ui.welcome_dialog import WelcomeDialog
from utils.settings_manager import SettingsManager


class MainWindow(QMainWindow):
    """Main application window"""
    
    def __init__(self):
        super().__init__()
        self.audio_processor = AudioProcessor()
        self.processing_thread = None
        self.directory_scan_thread = None
        self.settings_manager = SettingsManager()
        self.favorites = []
        self.init_ui()
        self.load_settings()
        self.show_welcome_if_needed()
        
    def init_ui(self):
        """Initialize the user interface"""
        self.setWindowTitle("KO Trimmer - Audio Silence Trimmer")
        self.setMinimumSize(800, 600)
        self.setWindowIconText("KO Trimmer")
        
        # Set window properties for better macOS integration
        self.setWindowFlags(self.windowFlags() | Qt.WindowType.WindowTitleHint)
        
        # Set window name for task switcher
        self.setObjectName("KO Trimmer")
        
        # Set window icon
        icon_path = Path(__file__).parent / "images" / "Knockout.png"
        if icon_path.exists():
            self.setWindowIcon(QIcon(str(icon_path)))
        
        # Create central widget
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        
        # Create main layout
        main_layout = QHBoxLayout(central_widget)
        
        # Create splitter for resizable panels
        splitter = QSplitter(Qt.Orientation.Horizontal)
        main_layout.addWidget(splitter)
        
        # Left panel - Favorites sidebar
        self.favorites_sidebar = FavoritesSidebar()
        self.favorites_sidebar.favorite_selected.connect(self.on_favorite_selected)
        self.favorites_sidebar.favorites_changed.connect(self.on_favorites_changed)
        splitter.addWidget(self.favorites_sidebar)
        
        # Center panel - File management
        center_panel = self.create_file_panel()
        splitter.addWidget(center_panel)
        
        # Right panel - Settings and controls
        right_panel = self.create_control_panel()
        splitter.addWidget(right_panel)
        
        # Set splitter proportions
        splitter.setSizes([200, 400, 300])
        
    def create_file_panel(self) -> QWidget:
        """Create the file management panel"""
        panel = QWidget()
        layout = QVBoxLayout(panel)
        
        # Drag and drop area
        self.drag_drop_widget = DragDropWidget()
        self.drag_drop_widget.files_dropped.connect(self.on_files_dropped)
        layout.addWidget(self.drag_drop_widget)
        
        # File list
        file_group = QGroupBox("Files to Process")
        file_layout = QVBoxLayout(file_group)
        
        self.file_list = QListWidget()
        self.file_list.setSelectionMode(QListWidget.SelectionMode.ExtendedSelection)
        self.file_list.setContextMenuPolicy(Qt.ContextMenuPolicy.CustomContextMenu)
        self.file_list.customContextMenuRequested.connect(self.show_context_menu)
        file_layout.addWidget(self.file_list)
        
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
        settings_layout.addWidget(self.overwrite_check)
        
        # Stereo preservation option
        self.preserve_stereo_check = QCheckBox("Preserve stereo channels (convert to mono if unchecked)")
        self.preserve_stereo_check.setChecked(True)  # Default to preserving stereo
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
        
        # Add stretch to push everything to the top
        layout.addStretch()
        
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
        for file_path in file_paths:
            # Check if file is already in the list
            existing_items = [
                self.file_list.item(i).text() 
                for i in range(self.file_list.count())
            ]
            
            if file_path not in existing_items:
                item = QListWidgetItem(file_path)
                self.file_list.addItem(item)
                
        self.update_process_button()
        
    def clear_files(self):
        """Clear all files from the list"""
        self.file_list.clear()
        self.update_process_button()
        
    def on_files_dropped(self, file_paths: List[str]):
        """Handle files dropped on the drag-drop area"""
        self.add_files_to_list(file_paths)
        
    def update_process_button(self):
        """Update the process button state"""
        self.process_btn.setEnabled(self.file_list.count() > 0)
        
    def process_files(self):
        """Start processing the files"""
        if self.file_list.count() == 0:
            return
            
        # Get file paths
        file_paths = [
            self.file_list.item(i).text() 
            for i in range(self.file_list.count())
        ]
        
        # Get settings
        settings = {
            'threshold': self.threshold_spin.value(),
            'min_duration': self.duration_spin.value(),
            'padding': self.padding_spin.value(),
            'overwrite': self.overwrite_check.isChecked(),
            'preserve_stereo': self.preserve_stereo_check.isChecked()
        }
        
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
        if self.file_list.count() == 0:
            return None
            
        # Get the first file to determine output directory
        first_file = self.file_list.item(0).text()
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
        
    def preview_selected(self):
        """Preview the selected file"""
        selected_items = self.file_list.selectedItems()
        
        if not selected_items:
            QMessageBox.information(
                self,
                "No File Selected",
                "Please select a file to preview."
            )
            return
            
        if len(selected_items) > 1:
            QMessageBox.information(
                self,
                "Multiple Files Selected",
                "Please select only one file to preview."
            )
            return
            
        # Get the selected file
        original_file = selected_items[0].text()
        
        # Check if the file has been processed
        settings = {
            'threshold': self.threshold_spin.value(),
            'min_duration': self.duration_spin.value(),
            'padding': self.padding_spin.value(),
            'overwrite': self.overwrite_check.isChecked()
        }
        
        # Get the output path
        output_path = self.audio_processor.get_output_path(original_file, settings)
        
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
        if item:
            # Add preview action
            preview_action = menu.addAction("Preview")
            preview_action.triggered.connect(self.preview_selected)
            
            # Add separator
            menu.addSeparator()
            
            # Add remove action
            remove_action = menu.addAction("Remove from List")
            remove_action.triggered.connect(lambda: self.remove_selected_file(item))
            
        menu.exec(self.file_list.mapToGlobal(position))
        
    def remove_selected_file(self, item):
        """Remove a file from the list"""
        row = self.file_list.row(item)
        self.file_list.takeItem(row)
        self.update_process_button()
            
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
        
    def on_favorites_changed(self, favorites: List[str]):
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
                    # Process the file
                    success = self.processor.process_file(
                        file_path, 
                        self.settings
                    )
                    
                    # Get output path for successful processing
                    output_path = ""
                    if success:
                        output_path = self.processor.get_output_path(file_path, self.settings)
                    
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