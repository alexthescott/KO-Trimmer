"""
Main window for KO Trimmer application
"""

import os
from pathlib import Path
from typing import List, Optional

from PyQt6.QtWidgets import (
    QMainWindow, QWidget, QVBoxLayout, QHBoxLayout, 
    QPushButton, QLabel, QProgressBar, QListWidget,
    QListWidgetItem, QMessageBox, QFileDialog, QGroupBox,
    QSpinBox, QDoubleSpinBox, QCheckBox, QSplitter
)
from PyQt6.QtCore import Qt, QThread, pyqtSignal, QMimeData
from PyQt6.QtGui import QDragEnterEvent, QDropEvent, QIcon

from audio.processor import AudioProcessor
from ui.drag_drop import DragDropWidget
from ui.progress import ProcessingProgressWidget


class MainWindow(QMainWindow):
    """Main application window"""
    
    def __init__(self):
        super().__init__()
        self.audio_processor = AudioProcessor()
        self.processing_thread = None
        self.init_ui()
        
    def init_ui(self):
        """Initialize the user interface"""
        self.setWindowTitle("KO Trimmer - Audio Silence Trimmer")
        self.setMinimumSize(800, 600)
        self.setWindowIconText("KO Trimmer")
        
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
        
        # Left panel - File management
        left_panel = self.create_file_panel()
        splitter.addWidget(left_panel)
        
        # Right panel - Settings and controls
        right_panel = self.create_control_panel()
        splitter.addWidget(right_panel)
        
        # Set splitter proportions
        splitter.setSizes([500, 300])
        
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
        self.padding_spin.setValue(100)  # More padding to preserve natural sound
        self.padding_spin.setSuffix(" ms")
        padding_layout.addWidget(self.padding_spin)
        settings_layout.addLayout(padding_layout)
        
        # Options
        self.overwrite_check = QCheckBox("Overwrite original files")
        self.overwrite_check.setChecked(False)
        settings_layout.addWidget(self.overwrite_check)
        
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
            'overwrite': self.overwrite_check.isChecked()
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
        
        # Create completion message
        message = "All files have been processed successfully!\n\n"
        
        if summary_info:
            message += f"📊 Processing Summary:\n"
            message += f"Files: {summary_info['files_processed']}/{summary_info['total_files']} processed\n"
            message += f"Original: {summary_info['original_mb']:.1f} MB\n"
            message += f"Processed: {summary_info['processed_mb']:.1f} MB\n"
            message += f"Reduction: {summary_info['reduction_percent']:.1f}% ({summary_info['reduction_mb']:.1f} MB)\n\n"
        
        if output_dir:
            message += f"📁 Output Directory:\n{output_dir}"
        else:
            message += "📁 Check the original file locations for processed files"
        
        QMessageBox.information(
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
                'overwrite': self.overwrite_check.isChecked()
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