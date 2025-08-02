"""
Progress widget for displaying processing status
"""

from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QProgressBar, 
    QLabel, QGroupBox, QTextEdit
)
from PyQt6.QtCore import Qt, pyqtSignal
from pathlib import Path

from .ui_utils import UIUtils


class ProcessingProgressWidget(QWidget):
    """Widget for displaying processing progress"""
    
    def __init__(self):
        super().__init__()
        self.original_sizes = {}  # Track original file sizes
        self.processed_sizes = {}  # Track processed file sizes
        self.failed_files = []  # Track failed files
        self.init_ui()
        
    def init_ui(self):
        """Initialize the user interface"""
        layout = QVBoxLayout(self)
        
        # Overall progress
        self.overall_progress = QProgressBar()
        self.overall_progress.setRange(0, 100)
        self.overall_progress.setValue(0)
        self.overall_progress.setFormat("Overall Progress: %p%")
        layout.addWidget(self.overall_progress)
        
        # Current file progress
        self.file_progress = QProgressBar()
        self.file_progress.setRange(0, 100)
        self.file_progress.setValue(0)
        self.file_progress.setFormat("Current File: %p%")
        layout.addWidget(self.file_progress)
        
        # Status label
        self.status_label = UIUtils.create_styled_label("Ready to process", 12, False)
        self.status_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        layout.addWidget(self.status_label)
        
        # Log area
        log_group = UIUtils.create_group_box("Processing Log")
        log_layout = QVBoxLayout(log_group)
        
        self.log_text = QTextEdit()
        self.log_text.setMinimumHeight(200)
        self.log_text.setReadOnly(True)
        log_layout.addWidget(self.log_text)
        
        layout.addWidget(log_group)
        
    def start_processing(self):
        """Start the processing display"""
        self.overall_progress.setValue(0)
        self.file_progress.setValue(0)
        self.status_label.setText("Processing files...")
        self.log_text.clear()
        # Reset tracking
        self.original_sizes = {}
        self.processed_sizes = {}
        self.failed_files = []
        
    def update_progress(self, percentage: int):
        """Update the overall progress"""
        self.overall_progress.setValue(percentage)
        
    def update_file_progress(self, file_path: str, success: bool, output_path: str = None):
        """Update the current file progress"""
        if success:
            self.log_text.append(f"✅ Processed: {file_path}")
            # Track file sizes for successful processing
            self._track_file_sizes(file_path, output_path)
        else:
            self.log_text.append(f"❌ Failed: {file_path}")
            # Track failed files
            self.failed_files.append(file_path)
            
        # Scroll to bottom
        scrollbar = self.log_text.verticalScrollBar()
        scrollbar.setValue(scrollbar.maximum())
        
    def _track_file_sizes(self, file_path: str, output_path: str = None):
        """Track original and processed file sizes"""
        try:
            original_path = Path(file_path)
            if original_path.exists():
                self.original_sizes[file_path] = original_path.stat().st_size
                
                # Use provided output path or try to find it
                if output_path and Path(output_path).exists():
                    self.processed_sizes[file_path] = Path(output_path).stat().st_size
                else:
                    # Fallback: try to find the processed file
                    from audio.processor import AudioProcessor
                    processor = AudioProcessor()
                    # Try common output patterns including the new folder structure
                    possible_outputs = [
                        original_path.parent / f"{original_path.stem}_trimmed{original_path.suffix}",
                        original_path.parent / "trimmed" / f"{original_path.stem}_trimmed{original_path.suffix}"
                    ]
                    
                    # Also try the new root folder structure
                    try:
                        # Find the root directory and check for _trimmed folder
                        root_dir = processor._find_root_directory(file_path)
                        if root_dir:
                            root_name = root_dir.name
                            new_root_name = f"{root_name}_trimmed"
                            new_root_path = root_dir.parent / new_root_name
                            relative_path = original_path.relative_to(root_dir)
                            new_output_path = new_root_path / relative_path
                            possible_outputs.append(new_output_path)
                    except:
                        pass
                    
                    for output in possible_outputs:
                        if output.exists():
                            self.processed_sizes[file_path] = output.stat().st_size
                            break
        except Exception as e:
            print(f"Error tracking file sizes for {file_path}: {e}")
        
    def finish_processing(self):
        """Finish the processing display"""
        self.overall_progress.setValue(100)
        self.file_progress.setValue(100)
        self.status_label.setText("Processing complete!")
        
    def update_status(self, message: str):
        """Update the status message"""
        self.status_label.setText(message)
        
    def get_summary_info(self):
        """Get summary information for the completion dialog"""
        if not self.original_sizes:
            return None
            
        total_original = sum(self.original_sizes.values())
        total_processed = sum(self.processed_sizes.values())
        files_processed = len(self.processed_sizes)
        total_files = len(self.original_sizes)
        failed_files = len(self.failed_files)
        
        # Convert to MB for display
        original_mb = total_original / (1024 * 1024)
        processed_mb = total_processed / (1024 * 1024)
        
        # Calculate reduction only if there are processed files
        if total_processed > 0:
            reduction_bytes = total_original - total_processed
            reduction_percent = (reduction_bytes / total_original) * 100
            reduction_mb = reduction_bytes / (1024 * 1024)
        else:
            reduction_percent = 0
            reduction_mb = 0
        
        return {
            'files_processed': files_processed,
            'total_files': total_files,
            'failed_files': failed_files,
            'original_mb': original_mb,
            'processed_mb': processed_mb,
            'reduction_percent': reduction_percent,
            'reduction_mb': reduction_mb
        } 