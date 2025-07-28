#!/usr/bin/env python3
"""
Test script to debug single file processing
"""

import sys
from pathlib import Path

# Add the src directory to the Python path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from audio.processor import AudioProcessor
from audio.file_handler import AudioFileHandler

def test_single_file():
    """Test processing a single audio file"""
    
    # Test file path
    test_file = "/Users/alexthescott/Desktop/william crooks drumkit vol. 1/01 kicks/kick01-1.wav"
    
    print(f"Testing file: {test_file}")
    
    # Test file handler
    file_handler = AudioFileHandler()
    is_valid = file_handler.is_valid_audio_file(test_file)
    print(f"File valid: {is_valid}")
    
    if is_valid:
        # Test audio processor
        processor = AudioProcessor()
        
        settings = {
            'threshold': -50,  # More forgiving for natural decay
            'min_duration': 1000,  # Longer duration to avoid cutting natural decay
            'padding': 100,  # More padding to preserve natural sound
            'overwrite': False
        }
        
        print("Processing file...")
        success = processor.process_file(test_file, settings)
        print(f"Processing success: {success}")

if __name__ == "__main__":
    test_single_file() 