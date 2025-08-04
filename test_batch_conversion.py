#!/usr/bin/env python3
"""
Batch conversion test for TrimVibe
Processes all audio files in William Crooks drumkit and measures conversion time to 128kbps
"""

import os
import time
import shutil
from pathlib import Path
from typing import List, Dict, Any
import subprocess

# Import TrimVibe components
from src.audio.library_manager import lib_manager
from src.audio.audio_utils import AudioUtils
from src.audio.processor import AudioProcessor


class BatchConversionTest:
    """Test class for batch audio conversion performance"""
    
    def __init__(self):
        self.source_dir = Path("/Users/alexthescott/Desktop/william_crooks_drumkits1-3")
        self.output_dir = Path("test_output_128kbps")
        self.target_bitrate = 128
        self.stats = {
            'total_files': 0,
            'processed_files': 0,
            'failed_files': 0,
            'total_size_before': 0,
            'total_size_after': 0,
            'start_time': None,
            'end_time': None,
            'errors': []
        }
    
    def setup(self):
        """Setup test environment"""
        print("🔧 Setting up batch conversion test...")
        
        # Create output directory
        if self.output_dir.exists():
            shutil.rmtree(self.output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        # Verify source directory exists
        if not self.source_dir.exists():
            raise FileNotFoundError(f"Source directory not found: {self.source_dir}")
        
        # Get all WAV files
        wav_files = list(self.source_dir.rglob("*.wav"))
        self.stats['total_files'] = len(wav_files)
        
        print(f"📁 Found {self.stats['total_files']} WAV files to process")
        print(f"🎯 Target bitrate: {self.target_bitrate}kbps")
        print(f"📂 Output directory: {self.output_dir}")
        
        return wav_files
    
    def get_file_size(self, file_path: Path) -> int:
        """Get file size in bytes"""
        try:
            return file_path.stat().st_size
        except:
            return 0
    
    def process_single_file(self, input_path: Path) -> Dict[str, Any]:
        """Process a single audio file"""
        try:
            # Create output path maintaining directory structure
            relative_path = input_path.relative_to(self.source_dir)
            output_path = self.output_dir / relative_path.with_suffix('.mp3')
            
            # Create output directory
            output_path.parent.mkdir(parents=True, exist_ok=True)
            
            # Get original file size
            original_size = self.get_file_size(input_path)
            
            # Process the file using AudioUtils
            audio_data, sample_rate = AudioUtils.load_audio_file(str(input_path), preserve_stereo=True)
            
            if audio_data is None:
                return {
                    'success': False,
                    'error': 'Failed to load audio file',
                    'input_path': str(input_path),
                    'original_size': original_size,
                    'output_size': 0
                }
            
            # Save with 128kbps compression
            success = AudioUtils.save_audio_file(
                audio_data, 
                sample_rate, 
                str(output_path), 
                bitrate=self.target_bitrate
            )
            
            if success:
                output_size = self.get_file_size(output_path)
                return {
                    'success': True,
                    'input_path': str(input_path),
                    'output_path': str(output_path),
                    'original_size': original_size,
                    'output_size': output_size,
                    'compression_ratio': original_size / output_size if output_size > 0 else 0
                }
            else:
                return {
                    'success': False,
                    'error': 'Failed to save audio file',
                    'input_path': str(input_path),
                    'original_size': original_size,
                    'output_size': 0
                }
                
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'input_path': str(input_path),
                'original_size': self.get_file_size(input_path),
                'output_size': 0
            }
    
    def run_test(self):
        """Run the batch conversion test"""
        print("\n🚀 Starting batch conversion test...")
        print("=" * 60)
        
        # Setup
        wav_files = self.setup()
        
        # Start timing
        self.stats['start_time'] = time.time()
        
        # Process files
        for i, file_path in enumerate(wav_files, 1):
            print(f"Processing {i}/{self.stats['total_files']}: {file_path.name}")
            
            result = self.process_single_file(file_path)
            
            if result['success']:
                self.stats['processed_files'] += 1
                self.stats['total_size_before'] += result['original_size']
                self.stats['total_size_after'] += result['output_size']
                
                # Print progress with compression info
                compression_ratio = result['compression_ratio']
                print(f"  ✅ Success - Compression: {compression_ratio:.1f}x")
            else:
                self.stats['failed_files'] += 1
                self.stats['errors'].append(result)
                print(f"  ❌ Failed - {result['error']}")
        
        # End timing
        self.stats['end_time'] = time.time()
        
        # Print results
        self.print_results()
    
    def print_results(self):
        """Print test results"""
        print("\n" + "=" * 60)
        print("📊 BATCH CONVERSION TEST RESULTS")
        print("=" * 60)
        
        # Timing
        total_time = self.stats['end_time'] - self.stats['start_time']
        avg_time_per_file = total_time / self.stats['total_files'] if self.stats['total_files'] > 0 else 0
        
        print(f"⏱️  Total processing time: {total_time:.2f} seconds")
        print(f"📈 Average time per file: {avg_time_per_file:.3f} seconds")
        print(f"🚀 Files per second: {self.stats['total_files'] / total_time:.1f}")
        
        # File statistics
        print(f"\n📁 File Statistics:")
        print(f"   Total files: {self.stats['total_files']}")
        print(f"   Successfully processed: {self.stats['processed_files']}")
        print(f"   Failed: {self.stats['failed_files']}")
        print(f"   Success rate: {(self.stats['processed_files'] / self.stats['total_files'] * 100):.1f}%")
        
        # Size statistics
        if self.stats['total_size_before'] > 0:
            total_size_before_mb = self.stats['total_size_before'] / (1024 * 1024)
            total_size_after_mb = self.stats['total_size_after'] / (1024 * 1024)
            overall_compression = self.stats['total_size_before'] / self.stats['total_size_after']
            
            print(f"\n💾 Size Statistics:")
            print(f"   Original total size: {total_size_before_mb:.1f} MB")
            print(f"   Compressed total size: {total_size_after_mb:.1f} MB")
            print(f"   Overall compression ratio: {overall_compression:.1f}x")
            print(f"   Space saved: {total_size_before_mb - total_size_after_mb:.1f} MB")
        
        # Performance metrics
        if self.stats['total_size_before'] > 0:
            mb_per_second = (self.stats['total_size_before'] / (1024 * 1024)) / total_time
            print(f"\n⚡ Performance Metrics:")
            print(f"   Processing speed: {mb_per_second:.1f} MB/second")
        
        # Error summary
        if self.stats['errors']:
            print(f"\n❌ Errors ({len(self.stats['errors'])}):")
            for error in self.stats['errors'][:5]:  # Show first 5 errors
                print(f"   - {error['input_path']}: {error['error']}")
            if len(self.stats['errors']) > 5:
                print(f"   ... and {len(self.stats['errors']) - 5} more errors")
        
        print("\n" + "=" * 60)
    
    def cleanup(self):
        """Clean up test files"""
        if self.output_dir.exists():
            shutil.rmtree(self.output_dir)
            print(f"🧹 Cleaned up test output directory: {self.output_dir}")


def main():
    """Main test function"""
    print("🎵 TrimVibe Batch Conversion Performance Test")
    print("Converting William Crooks Drumkit to 128kbps MP3")
    print("=" * 60)
    
    # Check if ffmpeg is available
    if not AudioUtils.is_ffmpeg_available():
        print("❌ FFmpeg not available. Please install ffmpeg for MP3 compression.")
        print("   macOS: brew install ffmpeg")
        return
    
    print("✅ FFmpeg available for MP3 compression")
    
    # Create and run test
    test = BatchConversionTest()
    
    try:
        test.run_test()
    except KeyboardInterrupt:
        print("\n⏹️  Test interrupted by user")
    except Exception as e:
        print(f"\n❌ Test failed with error: {e}")
    finally:
        # Ask if user wants to keep test files
        response = input("\n🧹 Clean up test files? (y/n): ").lower().strip()
        if response in ['y', 'yes']:
            test.cleanup()
        else:
            print(f"📁 Test files preserved in: {test.output_dir}")


if __name__ == "__main__":
    main() 