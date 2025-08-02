"""
Audio utility functions for common operations
"""

import numpy as np
import librosa
import soundfile as sf
from pydub import AudioSegment
from typing import Tuple, Optional, Union
import warnings


class AudioUtils:
    """Utility class for common audio operations"""
    
    @staticmethod
    def load_audio_file(file_path: str, preserve_stereo: bool = True) -> Tuple[Optional[np.ndarray], int]:
        """
        Load audio file using the best available method
        
        Args:
            file_path: Path to the audio file
            preserve_stereo: Whether to preserve stereo channels
            
        Returns:
            Tuple of (audio_data, sample_rate) or (None, 0) if failed
        """
        try:
            # Try librosa first (handles most formats)
            audio_data, sample_rate = librosa.load(file_path, sr=None, mono=not preserve_stereo)
            return audio_data, sample_rate
        except Exception as e:
            print(f"librosa failed to load {file_path}: {e}")
            return AudioUtils._load_with_pydub(file_path, preserve_stereo)
    
    @staticmethod
    def _load_with_pydub(file_path: str, preserve_stereo: bool) -> Tuple[Optional[np.ndarray], int]:
        """Fallback loading using pydub"""
        try:
            with warnings.catch_warnings():
                warnings.filterwarnings("ignore", category=RuntimeWarning)
                audio_segment = AudioSegment.from_file(file_path)
            
            sample_rate = audio_segment.frame_rate
            samples = np.array(audio_segment.get_array_of_samples())
            
            # Handle stereo/mono conversion
            samples = AudioUtils._reshape_audio_samples(samples, audio_segment.channels, preserve_stereo)
            
            # Normalize samples
            samples = AudioUtils._normalize_samples(samples, audio_segment.sample_width)
            
            return samples, sample_rate
        except Exception as e:
            print(f"pydub also failed to load {file_path}: {e}")
            return None, 0
    
    @staticmethod
    def _reshape_audio_samples(samples: np.ndarray, channels: int, preserve_stereo: bool) -> np.ndarray:
        """Reshape audio samples based on channel count and stereo preference"""
        if channels == 2 and preserve_stereo:
            try:
                return samples.reshape(-1, 2)
            except ValueError:
                print(f"Failed to reshape stereo audio, falling back to mono")
                return samples.reshape(-1, 1)
        elif channels == 2 and not preserve_stereo:
            # Convert stereo to mono
            samples = samples.reshape(-1, 2)
            return np.mean(samples, axis=1)
        else:
            # Mono or other channel counts
            return samples
    
    @staticmethod
    def _normalize_samples(samples: np.ndarray, sample_width: int) -> np.ndarray:
        """Normalize samples based on bit depth"""
        normalization_factors = {
            1: 128.0,      # 8-bit
            2: 32768.0,    # 16-bit
            4: 2147483648.0  # 32-bit
        }
        
        factor = normalization_factors.get(sample_width, 32768.0)
        return samples.astype(np.float32) / factor
    
    @staticmethod
    def save_audio_file(audio_data: np.ndarray, sample_rate: int, output_path: str) -> bool:
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
            from pathlib import Path
            output_path_obj = Path(output_path)
            output_path_obj.parent.mkdir(parents=True, exist_ok=True)
            
            # soundfile expects (samples, channels) format
            if len(audio_data.shape) == 2:
                audio_data = audio_data.T
            
            sf.write(output_path, audio_data, sample_rate)
            return True
        except Exception as e:
            print(f"Failed to save audio: {e}")
            return False
    
    @staticmethod
    def get_audio_shape_info(audio_data: np.ndarray) -> dict:
        """Get information about audio data shape"""
        if len(audio_data.shape) == 2:
            return {
                'is_stereo': True,
                'channels': audio_data.shape[0],
                'samples': audio_data.shape[1],
                'duration_samples': audio_data.shape[1]
            }
        else:
            return {
                'is_stereo': False,
                'channels': 1,
                'samples': len(audio_data),
                'duration_samples': len(audio_data)
            }
    
    @staticmethod
    def trim_audio_data(audio_data: np.ndarray, start_sample: int, end_sample: int) -> np.ndarray:
        """
        Trim audio data to specified range
        
        Args:
            audio_data: Audio data as numpy array
            start_sample: Start sample index
            end_sample: End sample index
            
        Returns:
            Trimmed audio data
        """
        if len(audio_data.shape) == 2:
            # Stereo audio
            return audio_data[:, start_sample:end_sample]
        else:
            # Mono audio
            return audio_data[start_sample:end_sample]
    
    @staticmethod
    def calculate_energy_envelope(audio_data: np.ndarray, frame_length: int = 2048, hop_length: int = 512) -> np.ndarray:
        """
        Calculate energy envelope using librosa RMS
        
        Args:
            audio_data: Audio data as numpy array
            frame_length: Frame length for RMS calculation
            hop_length: Hop length for RMS calculation
            
        Returns:
            Energy envelope as numpy array
        """
        if len(audio_data.shape) == 2:
            # Stereo audio - calculate RMS across both channels
            rms = librosa.feature.rms(y=audio_data, frame_length=frame_length, hop_length=hop_length)
            rms = np.max(rms, axis=0).flatten()
        else:
            # Mono audio
            rms = librosa.feature.rms(y=audio_data, frame_length=frame_length, hop_length=hop_length)[0]
        
        # Interpolate to match original audio length
        shape_info = AudioUtils.get_audio_shape_info(audio_data)
        original_length = shape_info['duration_samples']
        rms_length = len(rms)
        
        # Create time points for interpolation
        rms_times = np.linspace(0, original_length, rms_length)
        original_times = np.arange(original_length)
        
        # Interpolate RMS values to match original audio length
        energy = np.interp(original_times, rms_times, rms)
        
        return energy 