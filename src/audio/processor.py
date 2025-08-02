"""
Main audio processor for silence detection and trimming
"""

import os
import numpy as np
from pathlib import Path
from typing import Tuple, Optional, Dict, Any

from .silence_detector import SilenceDetector
from .file_handler import AudioFileHandler
from .audio_utils import AudioUtils


class AudioProcessor:
    """Main audio processing class"""
    
    def __init__(self):
        self.silence_detector = SilenceDetector()
        self.file_handler = AudioFileHandler()
        
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
                print(f"Failed to load audio file: {file_path}")
                return False
                
            # Detect silence regions
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
            success = AudioUtils.save_audio_file(trimmed_audio, sample_rate, output_path)
            
            if success:
                print(f"Successfully processed: {file_path}")
                return True
            else:
                print(f"Failed to save processed file: {file_path}")
                return False
                
        except Exception as e:
            print(f"Error processing {file_path}: {e}")
            return False
            
    def _trim_audio(self, audio_data: np.ndarray, silence_regions: list, settings: Dict[str, Any], sample_rate: int) -> np.ndarray:
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
            
            # Get the root directory that was originally dragged in
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
        suffix = "_trimmed_stereo" if preserve_stereo else "_trimmed_mono"
        
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
                'is_stereo': shape_info['is_stereo']
            }
            
        except Exception as e:
            print(f"Error getting audio info for {file_path}: {e}")
            return {} 