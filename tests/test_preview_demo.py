#!/usr/bin/env python3
"""
Demo script to test audio preview functionality with a real file
"""

import sys
from pathlib import Path

# Add the src directory to the Python path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

def demo_audio_preview():
    """Demo the audio preview functionality"""
    try:
        from PyQt6.QtWidgets import QApplication
        from ui.audio_preview import AudioPreviewDialog
        
        # Create QApplication
        app = QApplication(sys.argv)
        
        # Test with a real file (if available)
        test_file = "/Users/alexthescott/Desktop/william crooks drumkit vol. 1/01 kicks/kick01-1.wav"
        
        if not Path(test_file).exists():
            print(f"❌ Test file not found: {test_file}")
            print("Please update the test_file path to point to an existing audio file")
            return False
            
        # Process the file to create a trimmed version
        from audio.processor import AudioProcessor
        
        processor = AudioProcessor()
        settings = {
            'threshold': -50,
            'min_duration': 1000,
            'padding': 100,
            'overwrite': False
        }
        
        print(f"Processing file: {test_file}")
        success = processor.process_file(test_file, settings)
        
        if not success:
            print("❌ Failed to process test file")
            return False
            
        # Get the output path
        output_path = processor.get_output_path(test_file, settings)
        
        if not Path(output_path).exists():
            print(f"❌ Output file not found: {output_path}")
            return False
            
        print(f"✅ Successfully created trimmed file: {output_path}")
        
        # Show the preview dialog
        print("Opening audio preview dialog...")
        preview_dialog = AudioPreviewDialog(test_file, output_path)
        preview_dialog.show()
        
        # Run the application
        print("🎵 Audio preview dialog is now open!")
        print("You can play both the original and trimmed versions to compare them.")
        print("Close the dialog to exit.")
        
        return app.exec()
        
    except Exception as e:
        print(f"❌ Demo failed: {e}")
        return False

if __name__ == "__main__":
    print("🎵 Audio Preview Demo")
    print("=" * 30)
    print("This demo will:")
    print("1. Process a test audio file")
    print("2. Open the audio preview dialog")
    print("3. Allow you to compare original vs trimmed audio")
    print()
    
    success = demo_audio_preview()
    sys.exit(0 if success else 1) 