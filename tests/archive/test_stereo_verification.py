#!/usr/bin/env python3
"""
Test to verify stereo audio preservation throughout the processing pipeline
"""

import sys
import os
from pathlib import Path

# Add the src directory to the Python path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

def test_stereo_preservation_pipeline():
    """Test the entire stereo preservation pipeline"""
    try:
        from audio.processor import AudioProcessor
        
        print("Testing stereo preservation pipeline...")
        
        processor = AudioProcessor()
        
        # Test with a stereo file
        test_file = "/Users/alexthescott/Desktop/william crooks drumkit vol. 1/02 snares/snare01.wav"
        
        if not os.path.exists(test_file):
            print(f"Test file not found: {test_file}")
            return False
        
        print(f"Testing with file: {test_file}")
        
        # Step 1: Load audio and check if it's stereo
        print("\n1. Loading audio...")
        audio_data, sample_rate = processor.load_audio(test_file)
        
        if audio_data is None:
            print("❌ Failed to load audio data")
            return False
        
        # Check if audio is stereo
        # librosa returns (channels, samples) format
        is_stereo = len(audio_data.shape) == 2 and audio_data.shape[0] == 2
        channels = audio_data.shape[0] if len(audio_data.shape) == 2 else 1
        
        print(f"   Audio shape: {audio_data.shape}")
        print(f"   Is stereo: {is_stereo}")
        print(f"   Channels: {channels}")
        print(f"   Sample rate: {sample_rate}")
        
        if is_stereo and channels == 2:
            print("✅ Input audio is stereo")
            return True
        else:
            print("❌ Input audio is not stereo")
            return False
        
        # Step 2: Test silence detection with stereo
        print("\n2. Testing silence detection...")
        from audio.silence_detector import SilenceDetector
        detector = SilenceDetector()
        
        settings = {
            'threshold': -50,
            'min_duration': 1000,
            'padding': 100
        }
        
        silence_regions = detector.detect_silence(audio_data, sample_rate, settings)
        print(f"   Found {len(silence_regions)} silence regions")
        
        # Step 3: Test trimming with stereo
        print("\n3. Testing audio trimming...")
        trimmed_audio = processor.trim_audio(audio_data, silence_regions, settings, sample_rate)
        
        trimmed_is_stereo = len(trimmed_audio.shape) == 2
        trimmed_channels = trimmed_audio.shape[1] if trimmed_is_stereo else 1
        
        print(f"   Trimmed audio shape: {trimmed_audio.shape}")
        print(f"   Trimmed is stereo: {trimmed_is_stereo}")
        print(f"   Trimmed channels: {trimmed_channels}")
        
        if not trimmed_is_stereo or trimmed_channels != 2:
            print("❌ Trimmed audio lost stereo channels")
            return False
        
        # Step 4: Test full processing pipeline
        print("\n4. Testing full processing pipeline...")
        settings['overwrite'] = False
        success = processor.process_file(test_file, settings)
        
        if not success:
            print("❌ Processing failed")
            return False
        
        # Step 5: Check the output file
        print("\n5. Checking output file...")
        output_path = processor.get_output_path(test_file, settings)
        
        if not os.path.exists(output_path):
            print("❌ Output file not created")
            return False
        
        # Load the output file and check if it's still stereo
        output_audio, output_sr = processor.load_audio(output_path)
        
        if output_audio is None:
            print("❌ Failed to load output audio")
            return False
        
        output_is_stereo = len(output_audio.shape) == 2
        output_channels = output_audio.shape[1] if output_is_stereo else 1
        
        print(f"   Output audio shape: {output_audio.shape}")
        print(f"   Output is stereo: {output_is_stereo}")
        print(f"   Output channels: {output_channels}")
        
        if output_is_stereo and output_channels == 2:
            print("✅ Stereo audio preserved throughout entire pipeline!")
            return True
        else:
            print("❌ Output was converted to mono")
            return False
            
    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_mono_preservation():
    """Test that mono audio stays mono"""
    try:
        from audio.processor import AudioProcessor
        
        print("Testing mono preservation...")
        
        processor = AudioProcessor()
        
        # Test with a mono file
        test_file = "/Users/alexthescott/Desktop/william crooks drumkit vol. 1/01 kicks/kick01_mono.wav"
        
        if not os.path.exists(test_file):
            print(f"Test file not found: {test_file}")
            return False
        
        print(f"Testing with mono file: {test_file}")
        
        # Load audio and check if it's mono
        audio_data, sample_rate = processor.load_audio(test_file)
        
        if audio_data is None:
            print("❌ Failed to load audio data")
            return False
        
        # Check if audio is mono
        # librosa returns (channels, samples) format
        is_mono = len(audio_data.shape) == 1 or (len(audio_data.shape) == 2 and audio_data.shape[0] == 1)
        channels = audio_data.shape[0] if len(audio_data.shape) == 2 else 1
        
        print(f"   Audio shape: {audio_data.shape}")
        print(f"   Is mono: {is_mono}")
        print(f"   Channels: {channels}")
        print(f"   Sample rate: {sample_rate}")
        
        if is_mono and channels == 1:
            print("✅ Input audio is mono")
            return True
        else:
            print("❌ Input audio is not mono")
            return False
        
        # Process the file
        settings = {
            'threshold': -50,
            'min_duration': 1000,
            'padding': 100,
            'overwrite': False
        }
        
        success = processor.process_file(test_file, settings)
        
        if not success:
            print("❌ Processing failed")
            return False
        
        # Check the output file
        output_path = processor.get_output_path(test_file, settings)
        
        if not os.path.exists(output_path):
            print("❌ Output file not created")
            return False
        
        # Load the output file and check if it's still mono
        output_audio, output_sr = processor.load_audio(output_path)
        
        if output_audio is None:
            print("❌ Failed to load output audio")
            return False
        
        output_is_mono = len(output_audio.shape) == 1
        output_channels = 1 if output_is_mono else output_audio.shape[1]
        
        print(f"   Output audio shape: {output_audio.shape}")
        print(f"   Output is mono: {output_is_mono}")
        print(f"   Output channels: {output_channels}")
        
        if output_is_mono and output_channels == 1:
            print("✅ Mono audio preserved throughout pipeline!")
            return True
        else:
            print("❌ Output was converted to stereo")
            return False
            
    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """Run stereo preservation tests"""
    print("Testing Stereo/Mono Audio Preservation")
    print("=" * 45)
    
    tests = [
        ("Stereo Preservation Pipeline", test_stereo_preservation_pipeline),
        ("Mono Preservation", test_mono_preservation),
    ]
    
    passed = 0
    total = len(tests)
    
    for test_name, test_func in tests:
        print(f"\n🧪 {test_name}:")
        if test_func():
            passed += 1
            print(f"✅ {test_name} PASSED")
        else:
            print(f"❌ {test_name} FAILED")
    
    print(f"\n📊 Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All stereo/mono preservation tests passed!")
        return True
    else:
        print("⚠️  Some stereo/mono preservation tests failed")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1) 