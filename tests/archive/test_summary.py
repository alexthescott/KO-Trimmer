#!/usr/bin/env python3
"""
Test the summary functionality
"""

import sys
from pathlib import Path

# Add the src directory to the Python path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from ui.progress import ProcessingProgressWidget
from PyQt6.QtWidgets import QApplication

def test_summary():
    """Test the summary functionality"""
    
    app = QApplication(sys.argv)
    
    # Create progress widget
    progress_widget = ProcessingProgressWidget()
    progress_widget.show()
    
    # Simulate processing some files
    test_files = [
        "/Users/alexthescott/Desktop/william crooks drumkit vol. 1/01 kicks/kick01-1.wav",
        "/Users/alexthescott/Desktop/william crooks drumkit vol. 1/03 hats & cymbals/crash-1.wav"
    ]
    
    print("Testing summary functionality...")
    print("Starting processing...")
    progress_widget.start_processing()
    
    # Simulate processing files
    for i, file_path in enumerate(test_files):
        print(f"Processing file {i+1}/{len(test_files)}: {file_path}")
        
        # Simulate successful processing
        progress_widget.update_progress(int((i + 1) / len(test_files) * 100))
        progress_widget.update_file_progress(file_path, True, "")
        
        # Small delay to see the progress
        import time
        time.sleep(0.5)
    
    print("Finishing processing...")
    progress_widget.finish_processing()
    
    print("Summary test complete!")
    print("Check the GUI window to see the summary display.")
    
    # Keep the window open for a few seconds
    import time
    time.sleep(3)
    
    app.quit()

if __name__ == "__main__":
    test_summary() 