#!/usr/bin/env python3
"""
Compare old vs new settings for cymbal crash
"""

import sys
from pathlib import Path

# Add the src directory to the Python path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from audio.processor import AudioProcessor

def test_cymbal_comparison():
    """Compare old vs new settings for cymbal crash"""
    
    test_file = "/Users/alexthescott/Desktop/william crooks drumkit vol. 1/03 hats & cymbals/crash-1.wav"
    
    print(f"Comparing settings for: {test_file}")
    print("=" * 60)
    
    processor = AudioProcessor()
    
    # Old aggressive settings
    old_settings = {
        'threshold': -40,
        'min_duration': 500,
        'padding': 50,
        'overwrite': False
    }
    
    # New forgiving settings
    new_settings = {
        'threshold': -50,
        'min_duration': 1000,
        'padding': 100,
        'overwrite': False
    }
    
    print("OLD SETTINGS (Aggressive):")
    print(f"  Threshold: {old_settings['threshold']} dB")
    print(f"  Min Duration: {old_settings['min_duration']} ms")
    print(f"  Padding: {old_settings['padding']} ms")
    
    # Test with old settings
    old_output = processor.get_output_path(test_file, old_settings)
    if Path(old_output).exists():
        Path(old_output).unlink()  # Remove if exists
    
    success_old = processor.process_file(test_file, old_settings)
    if success_old and Path(old_output).exists():
        old_size = Path(old_output).stat().st_size
        print(f"  Result: {old_size:,} bytes")
    
    print("\nNEW SETTINGS (Forgiving):")
    print(f"  Threshold: {new_settings['threshold']} dB")
    print(f"  Min Duration: {new_settings['min_duration']} ms")
    print(f"  Padding: {new_settings['padding']} ms")
    
    # Test with new settings
    new_output = processor.get_output_path(test_file, new_settings)
    if Path(new_output).exists():
        Path(new_output).unlink()  # Remove if exists
    
    success_new = processor.process_file(test_file, new_settings)
    if success_new and Path(new_output).exists():
        new_size = Path(new_output).stat().st_size
        print(f"  Result: {new_size:,} bytes")
    
    # Compare results
    if success_old and success_new and Path(old_output).exists() and Path(new_output).exists():
        original_size = Path(test_file).stat().st_size
        old_reduction = (1 - old_size / original_size) * 100
        new_reduction = (1 - new_size / original_size) * 100
        difference = new_size - old_size
        
        print(f"\nCOMPARISON:")
        print(f"  Original: {original_size:,} bytes")
        print(f"  Old settings reduction: {old_reduction:.1f}%")
        print(f"  New settings reduction: {new_reduction:.1f}%")
        print(f"  Difference: {difference:,} bytes ({difference/1024:.1f} KB)")
        print(f"  New settings preserve: {difference/1024:.1f} KB more audio")

if __name__ == "__main__":
    test_cymbal_comparison() 