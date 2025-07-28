#!/usr/bin/env python3
"""
Test the new output path logic
"""

import sys
from pathlib import Path

# Add the src directory to the Python path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from audio.processor import AudioProcessor

def test_output_paths():
    """Test the output path generation"""
    
    processor = AudioProcessor()
    
    # Test file paths
    test_files = [
        "/Users/alexthescott/Desktop/william crooks drumkit vol. 1/01 kicks/kick01-1.wav",
        "/Users/alexthescott/Desktop/william crooks drumkit vol. 1/02 snares/snare01-1.wav",
        "/Users/alexthescott/Desktop/william crooks drumkit vol. 1/03 hats & cymbals/hat01-1.wav"
    ]
    
    settings = {
        'overwrite': False
    }
    
    print("Testing output path generation:")
    print("=" * 50)
    
    for file_path in test_files:
        output_path = processor.get_output_path(file_path, settings)
        print(f"Input:  {file_path}")
        print(f"Output: {output_path}")
        print()
        
    # Test root directory detection
    print("Testing root directory detection:")
    print("=" * 50)
    
    for file_path in test_files:
        root_dir = processor._find_root_directory(file_path)
        print(f"File: {file_path}")
        print(f"Root: {root_dir}")
        print()

if __name__ == "__main__":
    test_output_paths() 