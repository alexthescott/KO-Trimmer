"""
Main audio processor for silence detection and trimming
"""

import os
import numpy as np
from pathlib import Path
from typing import Tuple, Optional, Dict, Any

import librosa
import soundfile as sf
from pydub import AudioSegment
from pydub.utils import make_chunks

from .silence_detector import SilenceDetector
from .file_handler import AudioFileHandler


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
            audio_data, sample_rate = self.load_audio(file_path, preserve_stereo)
            
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
            trimmed_audio = self.trim_audio(audio_data, silence_regions, settings, sample_rate)
            
            # Save the trimmed audio
            output_path = self.get_output_path(file_path, settings)
            success = self.save_audio(trimmed_audio, sample_rate, output_path)
            
            if success:
                print(f"Successfully processed: {file_path}")
                return True
            else:
                print(f"Failed to save processed file: {file_path}")
                return False
                
        except Exception as e:
            print(f"Error processing {file_path}: {e}")
            return False
            
    def load_audio(self, file_path: str, preserve_stereo: bool = True) -> Tuple[Optional[np.ndarray], int]:
        """
        Load audio file using appropriate method
        
        Args:
            file_path: Path to the audio file
            preserve_stereo: Whether to preserve stereo channels (True) or convert to mono (False)
            
        Returns:
            Tuple of (audio_data, sample_rate) or (None, 0) if failed
        """
        try:
            # Try librosa first (handles most formats)
            # Load with mono=False to preserve stereo channels, or mono=True to convert to mono
            audio_data, sample_rate = librosa.load(file_path, sr=None, mono=not preserve_stereo)
            
            return audio_data, sample_rate
        except Exception as e:
            print(f"librosa failed to load {file_path}: {e}")
            
            try:
                # Fallback to pydub (with FFmpeg warning suppression)
                import warnings
                with warnings.catch_warnings():
                    warnings.filterwarnings("ignore", category=RuntimeWarning)
                    audio_segment = AudioSegment.from_file(file_path)
                
                sample_rate = audio_segment.frame_rate
                
                # Convert to numpy array, preserving stereo channels
                samples = np.array(audio_segment.get_array_of_samples())
                
                # Reshape for stereo if needed
                if audio_segment.channels == 2 and preserve_stereo:
                    # For stereo, reshape to (samples, channels)
                    try:
                        samples = samples.reshape(-1, 2)
                    except ValueError as reshape_error:
                        print(f"Failed to reshape stereo audio for {file_path}: {reshape_error}")
                        print(f"Sample count: {len(samples)}, channels: {audio_segment.channels}")
                        # Fall back to mono conversion if reshape fails
                        samples = samples.reshape(-1, 1)
                elif audio_segment.channels == 2 and not preserve_stereo:
                    # Convert stereo to mono by taking the mean of both channels
                    samples = samples.reshape(-1, 2)
                    samples = np.mean(samples, axis=1)
                elif audio_segment.channels == 1:
                    # For mono, keep as 1D array
                    pass
                else:
                    # For other channel counts, keep as is
                    print(f"Warning: Unexpected channel count {audio_segment.channels} for {file_path}")
                    pass
                
                # Convert to float32 and normalize
                if audio_segment.sample_width == 1:
                    samples = samples.astype(np.float32) / 128.0
                elif audio_segment.sample_width == 2:
                    samples = samples.astype(np.float32) / 32768.0
                elif audio_segment.sample_width == 4:
                    samples = samples.astype(np.float32) / 2147483648.0
                    
                return samples, sample_rate
                
            except Exception as e2:
                print(f"pydub also failed to load {file_path}: {e2}")
                return None, 0
                
    def trim_audio(self, audio_data: np.ndarray, silence_regions: list, settings: Dict[str, Any], sample_rate: int) -> np.ndarray:
        """
        Trim audio based on silence detection
        
        Args:
            audio_data: Audio data as numpy array
            silence_regions: List of silence regions
            settings: Processing settings
            
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
        end_sample = min(len(audio_data), end_sample + padding_samples)
        
        if start_sample >= end_sample:
            return audio_data
            
        # Handle stereo audio properly
        if len(audio_data.shape) == 2:
            # Stereo audio - trim both channels
            return audio_data[start_sample:end_sample, :]
        else:
            # Mono audio
            return audio_data[start_sample:end_sample]
        
    def get_output_path(self, input_path: str, settings: Dict[str, Any]) -> str:
        """
        Determine output path for processed file
        
        Args:
            input_path: Input file path
            settings: Processing settings
            
        Returns:
            Output file path
        """
        input_path_obj = Path(input_path)
        
        if settings.get('overwrite', False):
            return input_path
        else:
            # Find the root directory (the top-level folder that was dragged in)
            # This assumes the root directory is the first directory in the path
            # that contains the original file
            root_dir = self._find_root_directory(input_path)
            
            if root_dir:
                # Create the new root directory name with stereo/mono suffix
                root_name = root_dir.name
                preserve_stereo = settings.get('preserve_stereo', True)
                if preserve_stereo:
                    new_root_name = f"{root_name}_trimmed_stereo"
                else:
                    new_root_name = f"{root_name}_trimmed_mono"
                new_root_path = root_dir.parent / new_root_name
                
                # Create the relative path from the root
                relative_path = input_path_obj.relative_to(root_dir)
                
                # Create the new output path maintaining folder structure
                # Add "trimmed" suffix to the filename
                filename = relative_path.name
                stem = relative_path.stem
                suffix = relative_path.suffix
                new_filename = f"{stem}_trimmed{suffix}"
                new_relative_path = relative_path.parent / new_filename
                
                output_path = new_root_path / new_relative_path
                
                # Ensure the output directory exists
                output_path.parent.mkdir(parents=True, exist_ok=True)
                
                return str(output_path)
            else:
                # Fallback to original behavior if we can't determine root
                preserve_stereo = settings.get('preserve_stereo', True)
                if preserve_stereo:
                    output_dir = input_path_obj.parent / "trimmed_stereo"
                else:
                    output_dir = input_path_obj.parent / "trimmed_mono"
                output_dir.mkdir(exist_ok=True)
                output_name = f"{input_path_obj.stem}_trimmed{input_path_obj.suffix}"
                return str(output_dir / output_name)
                
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
            # For example, if the path contains "drumkit", "samples", "kit", etc.
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
            # Check if the input file itself is already a processed file
            file_path_obj = Path(file_path)
            filename = file_path_obj.name.lower()
            
            # Check for common processed file indicators
            if any(indicator in filename for indicator in ['_trimmed', '_processed', '_optimized']):
                return True
            
            # Check if the output file already exists
            output_path = self.get_output_path(file_path, settings)
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
            
    def save_audio(self, audio_data: np.ndarray, sample_rate: int, output_path: str) -> bool:
        """
        Save audio data to file
        
        Args:
            audio_data: Audio data to save
            sample_rate: Sample rate
            output_path: Output file path
            
        Returns:
            bool: True if save was successful
        """
        try:
            # Ensure output directory exists
            output_path_obj = Path(output_path)
            output_path_obj.parent.mkdir(parents=True, exist_ok=True)
            
            # Save using soundfile (handles most formats)
            # Ensure the output directory exists
            output_dir = Path(output_path).parent
            output_dir.mkdir(parents=True, exist_ok=True)
            
            # soundfile expects (samples, channels) format
            if len(audio_data.shape) == 2:
                # Transpose from (channels, samples) to (samples, channels)
                audio_data = audio_data.T
            
            # Save the audio file
            sf.write(output_path, audio_data, sample_rate)
            return True
            
        except Exception as e:
            print(f"Failed to save audio: {e}")
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
            audio_data, sample_rate = self.load_audio(file_path)
            
            if audio_data is None:
                return {}
                
            duration = len(audio_data) / sample_rate
            file_size = os.path.getsize(file_path)
            
            return {
                'duration': duration,
                'sample_rate': sample_rate,
                'channels': 1 if len(audio_data.shape) == 1 else audio_data.shape[1],
                'file_size': file_size,
                'format': Path(file_path).suffix.lower(),
                'is_stereo': len(audio_data.shape) == 2
            }
            
        except Exception as e:
            print(f"Error getting audio info for {file_path}: {e}")
            return {} 