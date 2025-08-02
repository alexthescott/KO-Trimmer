"""
Processing manager component for KO Trimmer
"""

import os
import time
from pathlib import Path
from typing import List, Dict, Any

from PyQt6.QtCore import QThread, pyqtSignal, QTimer
from PyQt6.QtWidgets import QProgressDialog, QMessageBox

from audio.processor import AudioProcessor
from utils.icon_manager import show_information, show_warning, show_critical


class ProcessingManager:
    """Manages audio processing operations"""
    
    def __init__(self, settings_panel, progress_widget):
        self.audio_processor = AudioProcessor()
        self.processing_thread = None
        self.directory_scan_thread = None
        self.settings_panel = settings_panel
        self.progress_widget = progress_widget
        self.scan_progress_dialog = None
        
    def process_files(self, file_paths: List[str]):
        """Process a list of audio files"""
        if not file_paths:
            show_warning(None, "No Files", "No files to process.")
            return
            
        # Get current settings
        settings = self.settings_panel.get_settings()
        
        # Create and start processing thread
        self.processing_thread = ProcessingThread(file_paths, settings, self.audio_processor)
        self.processing_thread.progress_updated.connect(self.progress_widget.update_progress)
        self.processing_thread.file_processed.connect(self.progress_widget.update_file_progress)
        self.processing_thread.error_occurred.connect(self.on_processing_error)
        
        # Connect to settings panel buttons
        self.processing_thread.finished.connect(self.on_processing_finished)
        
        # Start processing
        self.progress_widget.start_processing()
        self.settings_panel.set_process_button_enabled(False)
        self.settings_panel.set_stop_button_enabled(True)
        
        self.processing_thread.start()
        
    def stop_processing(self):
        """Stop the current processing operation"""
        if self.processing_thread and self.processing_thread.isRunning():
            self.processing_thread.stop()
            self.processing_thread.wait()
            
        if self.directory_scan_thread and self.directory_scan_thread.isRunning():
            self.directory_scan_thread.stop()
            self.directory_scan_thread.wait()
            
    def scan_directory(self, directory: str):
        """Scan a directory for audio files"""
        self.directory_scan_thread = DirectoryScanThread(directory)
        self.directory_scan_thread.progress_updated.connect(self.on_scan_progress)
        self.directory_scan_thread.scan_finished.connect(self.on_scan_finished)
        self.directory_scan_thread.error_occurred.connect(self.on_scan_error)
        
        # Show progress dialog
        self.scan_progress_dialog = QProgressDialog("Scanning directory...", "Cancel", 0, 100)
        self.scan_progress_dialog.setWindowTitle("Scanning Directory")
        self.scan_progress_dialog.setModal(True)
        self.scan_progress_dialog.canceled.connect(self._close_scan_progress)
        
        self.directory_scan_thread.start()
        self.scan_progress_dialog.show()
        
    def on_processing_finished(self):
        """Handle processing completion"""
        self.progress_widget.finish_processing()
        self.settings_panel.set_process_button_enabled(True)
        self.settings_panel.set_stop_button_enabled(False)
        
        # Get summary info
        summary = self.progress_widget.get_summary_info()
        if summary:
            self.show_completion_dialog(summary)
            
    def on_processing_error(self, error_message: str):
        """Handle processing errors"""
        show_critical(None, "Processing Error", f"An error occurred during processing:\n{error_message}")
        
    def on_scan_progress(self, percentage: int):
        """Handle directory scan progress"""
        if self.scan_progress_dialog:
            self.scan_progress_dialog.setValue(percentage)
            
    def on_scan_finished(self, audio_files: List[str]):
        """Handle directory scan completion"""
        self._close_scan_progress(audio_files)
        
        if audio_files:
            # Emit signal to add files to the list
            # This would need to be connected to the file panel
            pass
        else:
            show_information(None, "No Audio Files", "No audio files found in the selected directory.")
            
    def on_scan_error(self, error_message: str):
        """Handle directory scan errors"""
        self._close_scan_progress()
        show_critical(None, "Scan Error", f"Error scanning directory:\n{error_message}")
        
    def _close_scan_progress(self, audio_files: List[str] = None):
        """Close the scan progress dialog"""
        if self.scan_progress_dialog:
            self.scan_progress_dialog.close()
            self.scan_progress_dialog = None
            
    def show_completion_dialog(self, summary: Dict[str, Any]):
        """Show processing completion dialog"""
        message = f"""
Processing Complete!

Files processed: {summary['files_processed']}/{summary['total_files']}
Failed files: {summary['failed_files']}

Original size: {summary['original_mb']:.1f} MB
Processed size: {summary['processed_mb']:.1f} MB
Space saved: {summary['reduction_mb']:.1f} MB ({summary['reduction_percent']:.1f}%)
        """.strip()
        
        show_information(None, "Processing Complete", message)


class DirectoryScanThread(QThread):
    """Thread for scanning directories for audio files"""
    
    progress_updated = pyqtSignal(int)
    scan_finished = pyqtSignal(list)  # list of audio file paths
    error_occurred = pyqtSignal(str)
    
    def __init__(self, directory: str):
        super().__init__()
        self.directory = directory
        self._stop_requested = False
        
    def run(self):
        """Run the directory scan"""
        try:
            audio_files = []
            directory_path = Path(self.directory)
            
            if not directory_path.exists():
                self.error_occurred.emit(f"Directory does not exist: {self.directory}")
                return
                
            if not directory_path.is_dir():
                self.error_occurred.emit(f"Path is not a directory: {self.directory}")
                return
                
            # Find all files in directory
            all_files = list(directory_path.rglob("*"))
            total_files = len(all_files)
            
            for i, file_path in enumerate(all_files):
                if self._stop_requested:
                    break
                    
                # Update progress
                progress = int((i / total_files) * 100)
                self.progress_updated.emit(progress)
                
                # Check if it's an audio file
                if file_path.is_file():
                    from .ui_utils import UIUtils
                    if UIUtils.is_audio_file(file_path):
                        audio_files.append(str(file_path))
                        
            if not self._stop_requested:
                self.scan_finished.emit(audio_files)
                
        except Exception as e:
            self.error_occurred.emit(str(e))
            
    def stop(self):
        """Request thread to stop"""
        self._stop_requested = True


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
        self._stop_requested = False
        
    def run(self):
        """Run the processing"""
        try:
            total_files = len(self.file_paths)
            
            for i, file_path in enumerate(self.file_paths):
                if self._stop_requested:
                    break
                    
                # Update progress
                progress = int((i / total_files) * 100)
                self.progress_updated.emit(progress)
                
                # Process the file
                try:
                    success = self.processor.process_file(file_path, self.settings)
                    
                    if success:
                        # Get the output path
                        output_path = self.processor._get_output_path(file_path, self.settings, self.settings.get('custom_output_dir'))
                        self.file_processed.emit(file_path, True, output_path)
                    else:
                        self.file_processed.emit(file_path, False, "")
                        
                except Exception as e:
                    self.file_processed.emit(file_path, False, "")
                    print(f"Error processing {file_path}: {e}")
                    
            if not self._stop_requested:
                self.progress_updated.emit(100)
                
        except Exception as e:
            self.error_occurred.emit(str(e))
            
    def stop(self):
        """Request thread to stop"""
        self._stop_requested = True 