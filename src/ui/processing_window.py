"""
Dedicated processing window for KO Trimmer
"""

import os
from pathlib import Path
from typing import List, Dict, Any

from PyQt6.QtWidgets import (
    QDialog, QVBoxLayout, QHBoxLayout, QLabel, QPushButton,
    QProgressBar, QGroupBox, QTextEdit, QScrollArea, QWidget,
    QFrame, QSizePolicy
)
from PyQt6.QtCore import Qt, QTimer, pyqtSignal
from PyQt6.QtGui import QFont, QIcon

from utils.icon_manager import get_app_icon, set_dialog_icon
from .progress import ProcessingProgressWidget


class ProcessingWindow(QDialog):
    """Dedicated window for processing audio files"""
    
    processing_finished = pyqtSignal(dict)  # Emits summary info
    processing_cancelled = pyqtSignal()
    
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("KO Trimmer - Processing Audio Files")
        self.setWindowIcon(get_app_icon())
        self.setModal(True)
        self.setMinimumSize(700, 600)
        self.resize(800, 700)
        
        # Set window properties
        self.setWindowFlags(
            Qt.WindowType.Window |
            Qt.WindowType.WindowTitleHint |
            Qt.WindowType.CustomizeWindowHint
        )
        
        self.processing_thread = None
        self.file_paths = []
        self.settings = {}
        self.audio_processor = None
        
        self.init_ui()
        
    def init_ui(self):
        """Initialize the processing window UI"""
        layout = QVBoxLayout(self)
        layout.setContentsMargins(20, 20, 20, 20)
        layout.setSpacing(15)
        
        # Header
        header_layout = QHBoxLayout()
        
        # Title
        title_label = QLabel("Processing Audio Files")
        title_font = QFont()
        title_font.setPointSize(18)
        title_font.setBold(True)
        title_label.setFont(title_font)
        title_label.setStyleSheet("color: #ffffff; margin-bottom: 10px;")
        header_layout.addWidget(title_label)
        
        header_layout.addStretch()  # Push title to left
        
        layout.addLayout(header_layout)
        
        # Progress section
        progress_group = QGroupBox("Processing Progress")
        progress_layout = QVBoxLayout(progress_group)
        
        # Progress widget
        self.progress_widget = ProcessingProgressWidget()
        progress_layout.addWidget(self.progress_widget)
        
        # Control buttons
        buttons_layout = QHBoxLayout()
        
        self.stop_btn = QPushButton("Stop Processing")
        self.stop_btn.clicked.connect(self.stop_processing)
        self.stop_btn.setStyleSheet("""
            QPushButton {
                background-color: #e74c3c;
                color: white;
                border: none;
                border-radius: 4px;
                padding: 8px 16px;
                font-weight: bold;
            }
            QPushButton:hover {
                background-color: #c0392b;
            }
        """)
        buttons_layout.addWidget(self.stop_btn)
        
        buttons_layout.addStretch()
        
        progress_layout.addLayout(buttons_layout)
        layout.addWidget(progress_group)
        

        
        # Results section (initially hidden)
        self.results_group = QGroupBox("Processing Results")
        self.results_layout = QVBoxLayout(self.results_group)
        
        self.results_text = QTextEdit()
        self.results_text.setMinimumHeight(150)
        self.results_text.setReadOnly(True)
        self.results_text.setStyleSheet("""
            QTextEdit {
                background-color: #d4edda;
                border: 1px solid #c3e6cb;
                border-radius: 4px;
                padding: 8px;
                font-family: monospace;
                font-size: 11px;
                color: #155724;
            }
        """)
        self.results_layout.addWidget(self.results_text)
        layout.addWidget(self.results_group)
        self.results_group.hide()
        
        # Close button at the bottom (only enabled when processing is done)
        self.close_btn = QPushButton("Close")
        self.close_btn.setEnabled(False)
        self.close_btn.clicked.connect(self.accept)
        self.close_btn.setStyleSheet("""
            QPushButton {
                background-color: #e74c3c;
                color: white;
                border: none;
                border-radius: 4px;
                padding: 10px 20px;
                font-weight: bold;
                font-size: 14px;
            }
            QPushButton:hover {
                background-color: #c0392b;
            }
            QPushButton:disabled {
                background-color: #bdc3c7;
                color: #7f8c8d;
            }
        """)
        layout.addWidget(self.close_btn)
        
    def start_processing(self, file_paths: List[str], settings: Dict[str, Any], audio_processor):
        """Start the processing with the given parameters"""
        self.file_paths = file_paths
        self.settings = settings
        self.audio_processor = audio_processor
        

        
        # Start progress widget
        self.progress_widget.start_processing()
        
        # Create and start processing thread
        from .main_window import ProcessingThread
        self.processing_thread = ProcessingThread(file_paths, settings, audio_processor)
        
        # Connect signals
        self.processing_thread.progress_updated.connect(
            self.progress_widget.update_progress
        )
        self.processing_thread.file_processed.connect(
            lambda file_path, success, output_path: self.progress_widget.update_file_progress(file_path, success, output_path)
        )
        self.processing_thread.finished.connect(self.on_processing_finished)
        self.processing_thread.error_occurred.connect(self.on_processing_error)
        
        # Start processing
        self.processing_thread.start()
        
        # Show the window
        self.show()
        self.raise_()
        self.activateWindow()
        
    def stop_processing(self):
        """Stop the processing thread"""
        if self.processing_thread and self.processing_thread.isRunning():
            self.processing_thread.stop()
            self.progress_widget.finish_processing()
            self.stop_btn.setEnabled(False)
            self.stop_btn.setText("Stopping...")
            

        
    def on_processing_finished(self):
        """Handle processing completion"""
        self.progress_widget.finish_processing()
        self.stop_btn.hide()  # Hide the stop button
        
        # Get summary information
        summary_info = self.progress_widget.get_summary_info()
        
        # Show results
        self.show_results(summary_info)
        
        # Enable close button
        self.close_btn.setEnabled(True)
        
        # Emit finished signal
        self.processing_finished.emit(summary_info)
        
    def on_processing_error(self, error_message: str):
        """Handle processing errors"""
        self.progress_widget.finish_processing()
        self.stop_btn.hide()  # Hide the stop button
        
        # Show error in results
        error_summary = {
            'error': True,
            'error_message': error_message
        }
        self.show_results(error_summary)
        
        # Enable close button
        self.close_btn.setEnabled(True)
        
    def show_results(self, summary_info: Dict[str, Any]):
        """Show processing results"""
        if summary_info.get('error'):
            results_text = f"❌ Processing Error:\n{summary_info.get('error_message', 'Unknown error')}"
            self.results_text.setStyleSheet("""
                QTextEdit {
                    background-color: #f8d7da;
                    border: 1px solid #f5c6cb;
                    border-radius: 4px;
                    padding: 8px;
                    font-family: monospace;
                    font-size: 11px;
                    color: #721c24;
                }
            """)
        else:
            failed_files = summary_info.get('failed_files', 0)
            total_files = summary_info.get('total_files', 0)
            processed_files = summary_info.get('files_processed', 0)
            
            results_text = f"✅ Processing Complete!\n\n"
            results_text += f"📊 Summary:\n"
            results_text += f"• Files processed: {processed_files}/{total_files}\n"
            if failed_files > 0:
                results_text += f"• Failed: {failed_files} file(s)\n"
            results_text += f"• Original size: {summary_info.get('original_mb', 0):.1f} MB\n"
            results_text += f"• Processed size: {summary_info.get('processed_mb', 0):.1f} MB\n"
            results_text += f"• Reduction: {summary_info.get('reduction_percent', 0):.1f}% ({summary_info.get('reduction_mb', 0):.1f} MB)\n"
            
            if summary_info.get('output_dir'):
                results_text += f"\n📁 Output Directory:\n{summary_info.get('output_dir')}"
            
        self.results_text.setText(results_text)
        self.results_group.show()
        
    def closeEvent(self, event):
        """Handle window close event"""
        if self.processing_thread and self.processing_thread.isRunning():
            # Don't allow closing while processing
            event.ignore()
        else:
            event.accept() 