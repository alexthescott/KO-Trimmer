#!/usr/bin/env python3
"""
Test the new completion dialog with summary information
"""

import sys
from pathlib import Path

# Add the src directory to the Python path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from ui.progress import ProcessingProgressWidget
from PyQt6.QtWidgets import QApplication, QMessageBox

def test_completion_dialog():
    """Test the completion dialog with summary information"""
    
    app = QApplication(sys.argv)
    
    # Create progress widget
    progress_widget = ProcessingProgressWidget()
    
    # Simulate processing some files
    test_files = [
        "/Users/alexthescott/Desktop/william crooks drumkit vol. 1/01 kicks/kick01-1.wav",
        "/Users/alexthescott/Desktop/william crooks drumkit vol. 1/03 hats & cymbals/crash-1.wav"
    ]
    
    print("Testing completion dialog with summary...")
    print("Starting processing...")
    progress_widget.start_processing()
    
    # Simulate processing files with file sizes
    for i, file_path in enumerate(test_files):
        print(f"Processing file {i+1}/{len(test_files)}: {file_path}")
        
        # Simulate file sizes (mock data)
        progress_widget.original_sizes[file_path] = 1024 * 1024  # 1MB
        progress_widget.processed_sizes[file_path] = 200 * 1024  # 200KB
        
        # Simulate successful processing
        progress_widget.update_progress(int((i + 1) / len(test_files) * 100))
        progress_widget.update_file_progress(file_path, True, "")
        
        # Small delay to see the progress
        import time
        time.sleep(0.5)
    
    print("Finishing processing...")
    progress_widget.finish_processing()
    
    # Get summary info
    summary_info = progress_widget.get_summary_info()
    
    print("Summary info:", summary_info)
    
    # Create completion message
    message = "All files have been processed successfully!\n\n"
    
    if summary_info:
        message += f"📊 Processing Summary:\n"
        message += f"Files: {summary_info['files_processed']}/{summary_info['total_files']} processed\n"
        message += f"Original: {summary_info['original_mb']:.1f} MB\n"
        message += f"Processed: {summary_info['processed_mb']:.1f} MB\n"
        message += f"Reduction: {summary_info['reduction_percent']:.1f}% ({summary_info['reduction_mb']:.1f} MB)\n\n"
    
    message += f"📁 Output Directory:\n/Users/alexthescott/Desktop/william crooks drumkit vol. 1_trimmed"
    
    # Show the completion dialog
    QMessageBox.information(
        None,
        "Processing Complete",
        message
    )
    
    print("Completion dialog test complete!")

if __name__ == "__main__":
    test_completion_dialog() 