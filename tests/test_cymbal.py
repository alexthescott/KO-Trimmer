#!/usr/bin/env python3
"""
Test the new settings with a cymbal crash
"""

import sys
from pathlib import Path

# Add the src directory to the Python path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from audio.processor import AudioProcessor

def test_cymbal():
    """Test processing a cymbal crash with new settings"""
    
    # Test with a cymbal crash file
    test_file = "/Users/alexthescott/Desktop/william crooks drumkit vol. 1/03 hats & cymbals/crash-1.wav"
    
    print(f"Testing cymbal crash with new settings: {test_file}")
    
    # Test file handler
    from audio.file_handler import AudioFileHandler
    file_handler = AudioFileHandler()
    is_valid = file_handler.is_valid_audio_file(test_file)
    print(f"File valid: {is_valid}")
    
    if is_valid:
        # Test audio processor with new settings
        processor = AudioProcessor()
        
        # New more forgiving settings
        settings = {
            'threshold': -50,  # More forgiving for natural decay
            'min_duration': 1000,  # Longer duration to avoid cutting natural decay
            'padding': 100,  # More padding to preserve natural sound
            'overwrite': False
        }
        
        print("Processing cymbal crash with new settings...")
        success = processor.process_file(test_file, settings)
        print(f"Processing success: {success}")
        
        if success:
            # Check the output file size
            output_path = processor.get_output_path(test_file, settings)
            if Path(output_path).exists():
                original_size = Path(test_file).stat().st_size
                trimmed_size = Path(output_path).stat().st_size
                reduction = (1 - trimmed_size / original_size) * 100
                print(f"Original size: {original_size:,} bytes")
                print(f"Trimmed size: {trimmed_size:,} bytes")
                print(f"Reduction: {reduction:.1f}%")

if __name__ == "__main__":
    test_cymbal() 