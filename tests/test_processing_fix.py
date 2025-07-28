#!/usr/bin/env python3
"""
Test to verify that processing works correctly after stereo fixes
"""

import sys
import os
from pathlib import Path

# Add the src directory to the Python path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

def test_single_file_processing():
    """Test processing a single file to see if it works"""
    try:
        from audio.processor import AudioProcessor
        
        print("Testing single file processing...")
        
        processor = AudioProcessor()
        
        # Test with a file that was failing
        test_file = "/Users/alexthescott/Desktop/william crooks drumkit vol. 1/05 basses (in G)/bass01.wav"
        
        if not os.path.exists(test_file):
            print(f"Test file not found: {test_file}")
            return False
        
        print(f"Testing with file: {test_file}")
        
        # Test file handler
        from audio.file_handler import AudioFileHandler
        file_handler = AudioFileHandler()
        is_valid = file_handler.is_valid_audio_file(test_file)
        print(f"File valid: {is_valid}")
        
        if not is_valid:
            print("❌ File validation failed")
            return False
        
        # Test audio loading
        print("Testing audio loading...")
        audio_data, sample_rate = processor.load_audio(test_file)
        
        if audio_data is None:
            print("❌ Failed to load audio data")
            return False
        
        print(f"✅ Audio loaded successfully")
        print(f"   Shape: {audio_data.shape}")
        print(f"   Sample rate: {sample_rate}")
        print(f"   Is stereo: {len(audio_data.shape) == 2}")
        
        # Test silence detection
        print("Testing silence detection...")
        from audio.silence_detector import SilenceDetector
        detector = SilenceDetector()
        
        settings = {
            'threshold': -50,
            'min_duration': 1000,
            'padding': 100
        }
        
        silence_regions = detector.detect_silence(audio_data, sample_rate, settings)
        print(f"✅ Silence detection successful")
        print(f"   Found {len(silence_regions)} silence regions")
        
        # Test audio trimming
        print("Testing audio trimming...")
        trimmed_audio = processor.trim_audio(audio_data, silence_regions, settings, sample_rate)
        
        print(f"✅ Audio trimming successful")
        print(f"   Original shape: {audio_data.shape}")
        print(f"   Trimmed shape: {trimmed_audio.shape}")
        
        # Test full processing
        print("Testing full processing...")
        settings['overwrite'] = False
        success = processor.process_file(test_file, settings)
        
        if success:
            print("✅ Full processing successful!")
            return True
        else:
            print("❌ Full processing failed")
            return False
            
    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """Run the processing test"""
    print("Testing Processing Fixes")
    print("=" * 25)
    
    if test_single_file_processing():
        print("\n🎉 Processing test passed!")
        return True
    else:
        print("\n❌ Processing test failed!")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1) 