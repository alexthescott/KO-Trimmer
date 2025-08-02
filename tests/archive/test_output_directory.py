#!/usr/bin/env python3
"""
Test the output directory display
"""

import sys
from pathlib import Path

# Add the src directory to the Python path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from audio.processor import AudioProcessor

def test_output_directory():
    """Test the output directory path generation"""
    
    # Test with a file from the drumkit
    test_file = "/Users/alexthescott/Desktop/william crooks drumkit vol. 1/05 basses (in G)/bass01-1.wav"
    
    print(f"Testing output directory for: {test_file}")
    
    processor = AudioProcessor()
    
    # Get settings
    settings = {
        'threshold': -50,
        'min_duration': 1000,
        'padding': 100,
        'overwrite': False
    }
    
    # Test the root directory detection
    root_dir = processor._find_root_directory(test_file)
    print(f"Root directory: {root_dir}")
    
    if root_dir:
        # Create the root trimmed directory path
        root_name = root_dir.name
        new_root_name = f"{root_name}_trimmed"
        new_root_path = root_dir.parent / new_root_name
        print(f"Root trimmed directory: {new_root_path}")
        
        # Also test the full output path
        output_path = processor.get_output_path(test_file, settings)
        print(f"Full output path: {output_path}")
        
        # Show the difference
        from pathlib import Path
        output_dir = Path(output_path).parent
        print(f"Output directory (current): {output_dir}")
        print(f"Root directory (should be): {new_root_path}")
        
        print(f"\n✅ Root directory should be: {new_root_path}")
        print(f"❌ Current shows: {output_dir}")

if __name__ == "__main__":
    test_output_directory() 