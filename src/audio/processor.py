"""
Main audio processor for silence detection and trimming
"""

import os
import time
from pathlib import Path
from typing import Tuple, Optional, Dict, Any, List

# Import library manager
from .library_manager import lib_manager

# Import components
from .silence_detector import SilenceDetector
from .file_handler import AudioFileHandler
from .audio_utils import AudioUtils

# Import error handler
try:
    from ..utils.error_handler import handle_processing_error, handle_audio_load_error
except ImportError:
    # Fallback if error handler not available
    def handle_processing_error(file_path, error):
        print(f"ERROR processing {file_path}: {error}")
    def handle_audio_load_error(file_path, error):
        print(f"ERROR loading {file_path}: {error}")


class AudioProcessor:
    """Main audio processing class"""
    
    def __init__(self):
        self.silence_detector = SilenceDetector()
        self.file_handler = AudioFileHandler()
        # Track the root directory at point of invocation
        self.processed_files = []  # Track processed files for this invocation
        
        # Timing variables
        self.session_start_time = None
        self.session_end_time = None
        self.file_start_time = None
        self.file_end_time = None
        self.total_files_processed = 0
        self.total_processing_time = 0.0
        
        # Track files longer than 20 seconds
        self.files_longer_than_20s = []
        
    def start_processing_session(self, file_paths: List[str], settings: Dict[str, Any]):
        """
        Initialize a processing session with unified output structure
        
        Args:
            file_paths: List of files to be processed
            settings: Processing settings
        """
        try:
            # Start timing the session
            self.session_start_time = time.time()
            self.total_files_processed = 0
            self.total_processing_time = 0.0
            
            # Reset tracking for files longer than 20 seconds
            self.files_longer_than_20s = []
            
            print(f"⏱️  Starting processing session with {len(file_paths)} files...")
            
            # Find the common root directory for all files
            if file_paths:
                # Use the first file to determine the invocation root
                first_file = Path(file_paths[0])
                self.invocation_root = self._find_root_directory(str(first_file))
                
                # If no common root found, use the directory of the first file
                if not self.invocation_root:
                    self.invocation_root = first_file.parent
                    
                # Create the unified output directory
                if self.invocation_root:
                    root_name = self.invocation_root.name
                    new_root_name = f"{root_name}_trimmed"
                    self.unified_output_dir = self.invocation_root.parent / new_root_name
                    self.unified_output_dir.mkdir(parents=True, exist_ok=True)
                else:
                    # Fallback: create in the same directory as first file
                    self.unified_output_dir = first_file.parent / "trimmed_output"
                    self.unified_output_dir.mkdir(parents=True, exist_ok=True)
                    
        except Exception as e:
            print(f"Error starting processing session: {e}")
            # Reset to safe defaults
            self.session_start_time = time.time()
            self.total_files_processed = 0
            self.total_processing_time = 0.0
            self.files_longer_than_20s = []
        
    def process_file(self, file_path: str, settings: Dict[str, Any]) -> bool:
        """
        Process a single audio file
        
        Args:
            file_path: Path to the audio file
            settings: Processing settings dictionary
            
        Returns:
            bool: True if processing was successful
        """
        try:
            # Start timing this file
            self.file_start_time = time.time()
            
            # Check if file is already processed
            if self.is_already_processed(file_path, settings):
                print(f"Skipping already processed file: {file_path}")
                return True
                
            # Validate file
            if not self.file_handler.is_valid_audio_file(file_path):
                print(f"Invalid audio file: {file_path}")
                return False
                
            # Load audio file
            preserve_stereo = settings.get('preserve_stereo', True)
            audio_data, sample_rate = AudioUtils.load_audio_file(file_path, preserve_stereo)
            
            if audio_data is None:
                print(f"Failed to load audio data from {file_path}")
                return False
                
            # Check for KO II compatibility (20-second limit) during processing
            audio_info = self.get_audio_info(file_path)
            is_longer_than_20s = False
            if audio_info and audio_info.get('duration', 0) > 20:
                is_longer_than_20s = True
                print(f"⚠️  File longer than 20 seconds: {file_path} ({audio_info['duration']:.1f}s)")
                # Track this file for the final popup
                self.files_longer_than_20s.append({
                    'filename': os.path.basename(file_path),
                    'duration': audio_info['duration'],
                    'path': file_path
                })
                
            # Always detect silence regions and trim
            silence_regions = self.silence_detector.detect_silence(
                audio_data, 
                sample_rate, 
                settings
            )
            
            # Trim audio based on silence detection
            trimmed_audio = self._trim_audio(audio_data, silence_regions, settings, sample_rate)
            
            # Save the trimmed audio
            custom_output_dir = settings.get('custom_output_dir')
            output_path = self._get_output_path(file_path, settings, custom_output_dir)
            
            # Add underscore prefix for files longer than 20 seconds
            if is_longer_than_20s:
                output_path_obj = Path(output_path)
                new_filename = f"_{output_path_obj.name}"
                output_path = str(output_path_obj.parent / new_filename)
                print(f"📝 Added underscore prefix for long file: {output_path}")
            
            bitrate = settings.get('bitrate', 320)  # Default to 320 if not specified
            success = AudioUtils.save_audio_file(trimmed_audio, sample_rate, output_path, bitrate)
            
            if success:
                # End timing and log results
                self.file_end_time = time.time()
                file_processing_time = self.file_end_time - self.file_start_time
                self.total_files_processed += 1
                self.total_processing_time += file_processing_time
                
                print(f"✅ Successfully processed: {file_path} ({file_processing_time:.3f}s)")
                return True
            else:
                print(f"❌ Failed to save processed file: {file_path}")
                return False
                
        except Exception as e:
            print(f"❌ Error processing {file_path}: {e}")
            return False
            
    def process_files_batch(self, file_paths: List[str], settings: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process files in batch mode without UI updates for maximum performance
        
        Args:
            file_paths: List of files to process
            settings: Processing settings
            
        Returns:
            Dict with batch processing results
        """
        start_time = time.time()
        total_files = len(file_paths)
        processed_files = 0
        failed_files = 0
        errors = []
        
        print(f"🚀 Starting batch processing of {total_files} files...")
        
        # Initialize processing session
        self.start_processing_session(file_paths, settings)
        
        # Process files in batch without individual timing
        for i, file_path in enumerate(file_paths, 1):
            try:
                # Process file without individual timing
                success = self._process_file_internal(file_path, settings)
                
                if success:
                    processed_files += 1
                    # Print progress every 10 files
                    if i % 10 == 0 or i == total_files:
                        elapsed = time.time() - start_time
                        rate = i / elapsed if elapsed > 0 else 0
                        print(f"  📊 Progress: {i}/{total_files} ({rate:.1f} files/sec)")
                else:
                    failed_files += 1
                    errors.append(f"Failed to process: {file_path}")
                    
            except Exception as e:
                failed_files += 1
                errors.append(f"Error processing {file_path}: {e}")
        
        # End timing
        end_time = time.time()
        total_time = end_time - start_time
        
        results = {
            'total_files': total_files,
            'processed_files': processed_files,
            'failed_files': failed_files,
            'total_time': total_time,
            'avg_time_per_file': total_time / total_files if total_files > 0 else 0,
            'files_per_second': total_files / total_time if total_time > 0 else 0,
            'errors': errors
        }
        
        print(f"\n" + "="*60)
        print(f"📊 BATCH PROCESSING COMPLETE")
        print(f"="*60)
        print(f"⏱️  Total time: {total_time:.2f} seconds")
        print(f"📁 Files processed: {processed_files}/{total_files}")
        print(f"📈 Average time per file: {results['avg_time_per_file']:.3f} seconds")
        print(f"🚀 Files per second: {results['files_per_second']:.1f}")
        print(f"="*60)
        
        return results
    
    def _process_file_internal(self, file_path: str, settings: Dict[str, Any]) -> bool:
        """
        Internal file processing without timing overhead
        
        Args:
            file_path: Path to the audio file
            settings: Processing settings
            
        Returns:
            bool: True if processing was successful
        """
        try:
            # Check if file is already processed
            if self.is_already_processed(file_path, settings):
                return True
                
            # Validate file
            if not self.file_handler.is_valid_audio_file(file_path):
                return False
                
            # Load audio file
            preserve_stereo = settings.get('preserve_stereo', True)
            audio_data, sample_rate = AudioUtils.load_audio_file(file_path, preserve_stereo)
            
            if audio_data is None:
                return False
                
            # Always detect silence regions and trim
            silence_regions = self.silence_detector.detect_silence(
                audio_data, 
                sample_rate, 
                settings
            )
            
            # Trim audio based on silence detection
            trimmed_audio = self._trim_audio(audio_data, silence_regions, settings, sample_rate)
            
            # Save the trimmed audio
            custom_output_dir = settings.get('custom_output_dir')
            output_path = self._get_output_path(file_path, settings, custom_output_dir)
            
            # Add underscore prefix for files longer than 20 seconds
            audio_info = self.get_audio_info(file_path)
            is_longer_than_20s = False
            if audio_info and audio_info.get('duration', 0) > 20:
                is_longer_than_20s = True
                output_path_obj = Path(output_path)
                new_filename = f"_{output_path_obj.name}"
                output_path = str(output_path_obj.parent / new_filename)
                print(f"📝 Added underscore prefix for long file: {output_path}")
            
            bitrate = settings.get('bitrate', 320)  # Default to 320 if not specified
            success = AudioUtils.save_audio_file(trimmed_audio, sample_rate, output_path, bitrate)
            
            return success
                
        except Exception as e:
            return False
        
    def _trim_audio(self, audio_data, silence_regions: list, settings: Dict[str, Any], sample_rate: int):
        """
        Trim audio based on silence detection
        
        Args:
            audio_data: Audio data as numpy array
            silence_regions: List of silence regions
            settings: Processing settings
            sample_rate: Sample rate
            
        Returns:
            Trimmed audio data
        """
        if not silence_regions:
            return audio_data
            
        # For drum samples, we typically want to trim silence from the end
        # The silence regions show where silence starts
        if len(silence_regions) == 1:
            # Single silence region - trim from the start of silence
            silence_start = silence_regions[0]['start']
            end_sample = silence_start
            start_sample = 0
        else:
            # Multiple silence regions - keep the first non-silent part
            start_sample = 0
            end_sample = silence_regions[0]['start']
        
        # Add padding
        padding_samples = int(settings.get('padding', 50) * 0.001 * sample_rate)  # Convert ms to samples
        start_sample = max(0, start_sample - padding_samples)
        
        # Get the correct length for the audio data
        shape_info = AudioUtils.get_audio_shape_info(audio_data)
        audio_length = shape_info['duration_samples']
            
        end_sample = min(audio_length, end_sample + padding_samples)
        
        if start_sample >= end_sample:
            return audio_data
            
        # Use utility function for trimming
        return AudioUtils.trim_audio_data(audio_data, start_sample, end_sample)
        
    def _get_output_path(self, input_path: str, settings: dict, custom_output_dir: str = None) -> str:
        """Get the output path for a processed file"""
        try:
            input_path_obj = Path(input_path)
            
            # If custom output directory is provided, use it
            if custom_output_dir:
                return self._build_custom_output_path(input_path_obj, custom_output_dir, settings)
            
            # Use unified output structure if available
            if hasattr(self, 'unified_output_dir') and self.unified_output_dir:
                return self._build_unified_output_path(input_path_obj, settings)
            
            # Fallback to original behavior
            root_dir = self._find_root_directory(input_path)
            
            if root_dir:
                return self._build_standard_output_path(input_path_obj, root_dir, settings)
            else:
                return self._build_fallback_output_path(input_path_obj, settings)
                
        except Exception as e:
            print(f"Error getting output path: {e}")
            return None
    
    def _build_custom_output_path(self, input_path_obj: Path, custom_output_dir: str, settings: dict) -> str:
        """Build output path for custom output directory"""
        custom_output_path = Path(custom_output_dir)
        custom_output_path.mkdir(parents=True, exist_ok=True)
        
        # Get the relative path from the root directory
        root_dir = self._find_root_directory(str(input_path_obj))
        if root_dir:
            relative_path = input_path_obj.relative_to(root_dir)
            output_path = custom_output_path / relative_path
        else:
            # Fallback: use just the filename
            output_path = custom_output_path / input_path_obj.name
        
        # Create the output directory
        output_dir = output_path.parent
        output_dir.mkdir(parents=True, exist_ok=True)
        
        return self._add_filename_suffix(output_path, settings)
    
    def _build_unified_output_path(self, input_path_obj: Path, settings: dict) -> str:
        """Build output path using unified output structure"""
        try:
            if not hasattr(self, 'unified_output_dir') or not self.unified_output_dir:
                # Fallback to standard path
                root_dir = self._find_root_directory(str(input_path_obj))
                if root_dir:
                    return self._build_standard_output_path(input_path_obj, root_dir, settings)
                else:
                    return self._build_fallback_output_path(input_path_obj, settings)
            
            # Get the relative path from the invocation root
            if self.invocation_root:
                try:
                    relative_path = input_path_obj.relative_to(self.invocation_root)
                    output_path = self.unified_output_dir / relative_path
                except ValueError:
                    # If file is not under the invocation root, use just the filename
                    output_path = self.unified_output_dir / input_path_obj.name
            else:
                # Fallback: use just the filename
                output_path = self.unified_output_dir / input_path_obj.name
            
            # Create the output directory
            output_dir = output_path.parent
            output_dir.mkdir(parents=True, exist_ok=True)
            
            return self._add_filename_suffix(output_path, settings)
            
        except Exception as e:
            print(f"Error building unified output path: {e}")
            # Fallback to standard path
            root_dir = self._find_root_directory(str(input_path_obj))
            if root_dir:
                return self._build_standard_output_path(input_path_obj, root_dir, settings)
            else:
                return self._build_fallback_output_path(input_path_obj, settings)
    
    def _build_standard_output_path(self, input_path_obj: Path, root_dir: Path, settings: dict) -> str:
        """Build output path for standard processing"""
        # Create the root trimmed directory path
        root_name = root_dir.name
        new_root_name = f"{root_name}_trimmed"
        new_root_path = root_dir.parent / new_root_name
        
        # Create the new root directory if it doesn't exist
        new_root_path.mkdir(parents=True, exist_ok=True)
        
        # Get the relative path from the root
        relative_path = input_path_obj.relative_to(root_dir)
        
        # Create the output path
        output_path = new_root_path / relative_path
        
        # Create the output directory
        output_dir = output_path.parent
        output_dir.mkdir(parents=True, exist_ok=True)
        
        return self._add_filename_suffix(output_path, settings)
    
    def _build_fallback_output_path(self, input_path_obj: Path, settings: dict) -> str:
        """Build fallback output path in same directory as input"""
        output_dir = input_path_obj.parent
        output_dir.mkdir(parents=True, exist_ok=True)
        
        return self._add_filename_suffix(input_path_obj, settings)
    
    def _add_filename_suffix(self, path: Path, settings: dict) -> str:
        """Add appropriate suffix to filename based on settings"""
        preserve_stereo = settings.get('preserve_stereo', True)
        bitrate = settings.get('bitrate', 320)
        
        # Build suffix based on settings
        suffix_parts = ["_trimmed"]
        
        if not preserve_stereo:
            suffix_parts.append("mono")
        else:
            suffix_parts.append("stereo")
        
        # Add compression info
        if bitrate != 320:
            if path.suffix.lower() == '.mp3':
                suffix_parts.append(f"{bitrate}k")
            elif path.suffix.lower() == '.wav':
                # For WAV files, show sample rate reduction
                target_sample_rate = AudioUtils._get_target_sample_rate(bitrate)
                if target_sample_rate < 44100:  # Only show if reduced from standard
                    suffix_parts.append(f"{target_sample_rate}Hz")
        
        suffix = "_".join(suffix_parts)
        
        # Add suffix before extension
        stem = path.stem
        extension = path.suffix
        new_filename = f"{stem}{suffix}{extension}"
        
        return str(path.parent / new_filename)
    
    def clear_output_directories(self, file_paths: list, settings: dict, custom_output_dir: str = None):
        """Clear output directories before processing to overwrite with new content"""
        try:
            # Get unique output directories for all files
            output_dirs = set()
            
            for file_path in file_paths:
                output_path = self._get_output_path(file_path, settings, custom_output_dir)
                if output_path:
                    output_dir = Path(output_path).parent
                    output_dirs.add(str(output_dir))
            
            # Clear each unique output directory
            import shutil
            for output_dir in output_dirs:
                output_path = Path(output_dir)
                if output_path.exists():
                    shutil.rmtree(output_path)
                    print(f"Cleared output directory: {output_dir}")
                    
        except Exception as e:
            print(f"Error clearing output directories: {e}")
                
    def _find_root_directory(self, file_path: str) -> Optional[Path]:
        """
        Find the root directory that was originally dragged in
        
        Args:
            file_path: Path to the file being processed
            
        Returns:
            Path to the root directory, or None if not found
        """
        try:
            file_path_obj = Path(file_path)
            
            # Look for common patterns that indicate this is a root directory
            path_parts = file_path_obj.parts
            
            # Check if any part of the path looks like a root directory
            for i, part in enumerate(path_parts):
                if any(keyword in part.lower() for keyword in ['drumkit', 'kit', 'samples', 'vol', 'pack']):
                    # This looks like a root directory
                    root_path = Path(*path_parts[:i+1])
                    if root_path.exists() and root_path.is_dir():
                        return root_path
            
            # If no obvious root found, use the first directory that contains multiple audio files
            current_dir = file_path_obj.parent
            while current_dir.parent != current_dir:  # Not at filesystem root
                # Check if this directory contains multiple audio files
                audio_files = list(current_dir.glob("*.wav")) + list(current_dir.glob("*.mp3"))
                if len(audio_files) > 1:
                    return current_dir
                current_dir = current_dir.parent
            
            return None
            
        except Exception:
            return None
    
    def is_already_processed(self, file_path: str, settings: Dict[str, Any]) -> bool:
        """
        Check if a file has already been processed with the current settings
        
        Args:
            file_path: Path to the input file
            settings: Current processing settings
            
        Returns:
            bool: True if file is already processed
        """
        try:
            # If overwrite is enabled, always process
            if settings.get('overwrite', False):
                return False
            
            # Check if the input file itself is already a processed file
            file_path_obj = Path(file_path)
            filename = file_path_obj.name.lower()
            
            # Check for common processed file indicators
            if any(indicator in filename for indicator in ['_trimmed', '_processed', '_optimized']):
                return True
            
            # Check if the output file already exists
            custom_output_dir = settings.get('custom_output_dir')
            output_path = self._get_output_path(file_path, settings, custom_output_dir)
            if Path(output_path).exists():
                return True
            
            # Check if the file is in a directory that looks like it's already processed
            parent_dir = file_path_obj.parent.name.lower()
            if any(indicator in parent_dir for indicator in ['_trimmed', '_processed', '_optimized']):
                return True
            
            # Check if the file is in a subdirectory of a processed directory
            for parent in file_path_obj.parents:
                if any(indicator in parent.name.lower() for indicator in ['_trimmed', '_processed', '_optimized']):
                    return True
            
            return False
            
        except Exception:
            return False
            
    def get_audio_info(self, file_path: str) -> Dict[str, Any]:
        """
        Get information about an audio file
        
        Args:
            file_path: Path to the audio file
            
        Returns:
            Dictionary with audio information
        """
        try:
            audio_data, sample_rate = AudioUtils.load_audio_file(file_path)
            
            if audio_data is None:
                return {}
                
            shape_info = AudioUtils.get_audio_shape_info(audio_data)
            duration = shape_info['duration_samples'] / sample_rate
            file_size = os.path.getsize(file_path)
            
            return {
                'duration': duration,
                'sample_rate': sample_rate,
                'channels': shape_info['channels'],
                'file_size': file_size,
                'format': Path(file_path).suffix.lower(),
                'is_stereo': shape_info['is_stereo'],
                'ko_ii_compatible': duration <= 20
            }
            
        except Exception as e:
            print(f"Error getting audio info for {file_path}: {e}")
            return {}
            
    def check_ko_ii_compatibility(self, file_path: str) -> Dict[str, Any]:
        """
        Check if a file is compatible with KO II (20-second limit)
        
        Args:
            file_path: Path to the audio file
            
        Returns:
            Dictionary with compatibility information
        """
        audio_info = self.get_audio_info(file_path)
        if not audio_info:
            return {'compatible': False, 'error': 'Could not read audio file'}
            
        duration = audio_info['duration']
        compatible = duration <= 20
        
        return {
            'compatible': compatible,
            'duration_seconds': duration,
            'filename': os.path.basename(file_path),
            'warning_message': f"File '{os.path.basename(file_path)}' is {duration:.1f} seconds long. "
                              f"The KO II has a 20-second sample length limitation." if not compatible else None
        }
    
    def end_processing_session(self) -> Dict[str, Any]:
        """
        End the processing session and return timing statistics
        
        Returns:
            Dict with timing statistics and files longer than 20 seconds
        """
        if self.session_start_time is None:
            return {
                'total_time': 0,
                'files_processed': 0,
                'avg_time_per_file': 0,
                'files_per_second': 0,
                'files_longer_than_20s': []
            }
        
        self.session_end_time = time.time()
        total_session_time = self.session_end_time - self.session_start_time
        
        avg_time_per_file = self.total_processing_time / self.total_files_processed if self.total_files_processed > 0 else 0
        files_per_second = self.total_files_processed / total_session_time if total_session_time > 0 else 0
        
        print(f"\n" + "="*60)
        print(f"📊 PROCESSING SESSION COMPLETE")
        print(f"="*60)
        print(f"⏱️  Total session time: {total_session_time:.2f} seconds")
        print(f"📁 Files processed: {self.total_files_processed}")
        print(f"📈 Average time per file: {avg_time_per_file:.3f} seconds")
        print(f"🚀 Files per second: {files_per_second:.1f}")
        print(f"⚡ Total processing time: {self.total_processing_time:.2f} seconds")
        
        # Report files longer than 20 seconds
        if self.files_longer_than_20s:
            print(f"⚠️  Files longer than 20 seconds: {len(self.files_longer_than_20s)}")
            for file_info in self.files_longer_than_20s:
                print(f"   • {file_info['filename']} ({file_info['duration']:.1f}s)")
        
        print(f"="*60)
        
        return {
            'total_time': total_session_time,
            'files_processed': self.total_files_processed,
            'avg_time_per_file': avg_time_per_file,
            'files_per_second': files_per_second,
            'total_processing_time': self.total_processing_time,
            'files_longer_than_20s': self.files_longer_than_20s
        } 