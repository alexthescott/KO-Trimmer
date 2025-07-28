#!/usr/bin/env python3
"""
Test GUI functionality
"""

import sys
import time
from pathlib import Path

# Add the src directory to the Python path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from PyQt6.QtWidgets import QApplication
from PyQt6.QtCore import QThread, pyqtSignal
from ui.main_window import MainWindow

class TestProcessingThread(QThread):
    """Test processing thread"""
    
    progress_updated = pyqtSignal(int)
    file_processed = pyqtSignal(str, bool)
    
    def __init__(self, file_paths):
        super().__init__()
        self.file_paths = file_paths
        
    def run(self):
        """Simulate processing"""
        for i, file_path in enumerate(self.file_paths):
            print(f"Processing {file_path}")
            time.sleep(0.5)  # Simulate processing time
            
            # Simulate success/failure
            success = True  # Always succeed for testing
            
            progress = int((i + 1) / len(self.file_paths) * 100)
            self.progress_updated.emit(progress)
            self.file_processed.emit(file_path, success)

def test_gui():
    """Test the GUI functionality"""
    app = QApplication(sys.argv)
    
    # Create main window
    window = MainWindow()
    window.show()
    
    # Test with a few files
    test_files = [
        "/Users/alexthescott/Desktop/william crooks drumkit vol. 1/01 kicks/kick01-1.wav",
        "/Users/alexthescott/Desktop/william crooks drumkit vol. 1/01 kicks/kick02-1.wav",
        "/Users/alexthescott/Desktop/william crooks drumkit vol. 1/01 kicks/kick03-1.wav"
    ]
    
    # Add files to the list
    for file_path in test_files:
        window.add_files_to_list([file_path])
    
    # Start processing
    window.process_files()
    
    return app.exec()

if __name__ == "__main__":
    test_gui() 