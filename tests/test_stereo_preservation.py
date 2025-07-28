#!/usr/bin/env python3
"""
Test stereo preservation in audio processing
"""

import sys
import os
from pathlib import Path

# Add the src directory to the Python path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

def test_stereo_loading():
    """Test that stereo audio is loaded correctly"""
    try:
        from audio.processor import AudioProcessor
        
        print("Testing stereo audio loading...")
        
        processor = AudioProcessor()
        
        # Test with a stereo file (you'll need to provide a real path)
        test_file = "/Users/alexthescott/Desktop/MF DOOM Drumkit/Open Hats/2 Oh -hotel.wav"
        
        if not os.path.exists(test_file):
            print(f"Test file not found: {test_file}")
            return False
        
        # Load audio and check if it's stereo
        audio_data, sample_rate = processor.load_audio(test_file)
        
        if audio_data is None:
            print("❌ Failed to load audio data")
            return False
        
        # Check if audio is stereo
        is_stereo = len(audio_data.shape) == 2
        channels = audio_data.shape[1] if is_stereo else 1
        
        print(f"Audio shape: {audio_data.shape}")
        print(f"Is stereo: {is_stereo}")
        print(f"Channels: {channels}")
        print(f"Sample rate: {sample_rate}")
        
        if is_stereo and channels == 2:
            print("✅ Stereo audio loaded correctly")
            return True
        else:
            print("❌ Audio was converted to mono")
            return False
            
    except Exception as e:
        print(f"❌ Test failed: {e}")
        return False

def test_stereo_processing():
    """Test that stereo audio is processed correctly"""
    try:
        from audio.processor import AudioProcessor
        
        print("Testing stereo audio processing...")
        
        processor = AudioProcessor()
        
        # Test with a stereo file
        test_file = "/Users/alexthescott/Desktop/MF DOOM Drumkit/Open Hats/2 Oh -hotel.wav"
        
        if not os.path.exists(test_file):
            print(f"Test file not found: {test_file}")
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
        
        # Load the output file and check if it's still stereo
        output_audio, output_sr = processor.load_audio(output_path)
        
        if output_audio is None:
            print("❌ Failed to load output audio")
            return False
        
        output_is_stereo = len(output_audio.shape) == 2
        output_channels = output_audio.shape[1] if output_is_stereo else 1
        
        print(f"Output audio shape: {output_audio.shape}")
        print(f"Output is stereo: {output_is_stereo}")
        print(f"Output channels: {output_channels}")
        
        if output_is_stereo and output_channels == 2:
            print("✅ Stereo audio preserved in output")
            return True
        else:
            print("❌ Output was converted to mono")
            return False
            
    except Exception as e:
        print(f"❌ Test failed: {e}")
        return False

def test_stereo_energy_calculation():
    """Test that energy calculation works with stereo audio"""
    try:
        from audio.silence_detector import SilenceDetector
        from audio.processor import AudioProcessor
        
        print("Testing stereo energy calculation...")
        
        processor = AudioProcessor()
        detector = SilenceDetector()
        
        # Test with a stereo file
        test_file = "/Users/alexthescott/Desktop/MF DOOM Drumkit/Open Hats/2 Oh -hotel.wav"
        
        if not os.path.exists(test_file):
            print(f"Test file not found: {test_file}")
            return False
        
        # Load stereo audio
        audio_data, sample_rate = processor.load_audio(test_file)
        
        if audio_data is None:
            print("❌ Failed to load audio data")
            return False
        
        # Calculate energy from stereo audio
        energy = detector.calculate_energy(audio_data)
        
        print(f"Audio shape: {audio_data.shape}")
        print(f"Energy shape: {energy.shape}")
        print(f"Energy min: {energy.min():.6f}")
        print(f"Energy max: {energy.max():.6f}")
        
        if len(energy.shape) == 1 and len(energy) > 0:
            print("✅ Energy calculation successful for stereo audio")
            return True
        else:
            print("❌ Energy calculation failed")
            return False
            
    except Exception as e:
        print(f"❌ Test failed: {e}")
        return False

def main():
    """Run all stereo preservation tests"""
    print("Testing Stereo Audio Preservation")
    print("=" * 40)
    
    tests = [
        ("Stereo Loading", test_stereo_loading),
        ("Stereo Processing", test_stereo_processing),
        ("Stereo Energy Calculation", test_stereo_energy_calculation),
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
        print("🎉 All stereo preservation tests passed!")
        return True
    else:
        print("⚠️  Some stereo preservation tests failed")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1) 