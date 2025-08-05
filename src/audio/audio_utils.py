"""
Audio utilities for loading, processing, and saving audio files
"""

import os
import sys
import logging
from typing import Tuple, Optional
import warnings

# Configure logging - console only for simplicity and performance
logging.basicConfig(
    level=logging.ERROR,  # Only ERROR level for performance
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger(__name__)

from typing import Tuple, Optional, Union
import subprocess

# Import library manager
from .library_manager import lib_manager

# Import error handler
try:
    from ..utils.error_handler import handle_ffmpeg_warning, handle_ffmpeg_error, handle_pydub_error
except ImportError:
    # Fallback if error handler not available
    def handle_ffmpeg_warning():
        print("WARNING: FFmpeg not found - MP3 compression will use full quality")
    def handle_ffmpeg_error(error, context=""):
        print(f"ERROR: FFmpeg error - {error} (Context: {context})")
    def handle_pydub_error(error, context=""):
        print(f"ERROR: Pydub error - {error} (Context: {context})")




class AudioUtils:
    """Utility class for common audio operations"""
    
    @staticmethod
    def load_audio_file(file_path: str, preserve_stereo: bool = True) -> Tuple:
        """
        Load audio file using the best available method
        
        Args:
            file_path: Path to the audio file
            preserve_stereo: Whether to preserve stereo channels
            
        Returns:
            Tuple of (audio_data, sample_rate) or (None, 0) if failed
        """
        # Check if we're in a bundled environment - more robust detection
        import sys
        import os
        
        # Multiple ways to detect bundled environment
        is_bundled = (
            hasattr(sys, '_MEIPASS') or 
            '.app' in sys.executable or 
            'Contents/MacOS' in sys.executable or
            os.path.basename(sys.executable) == 'KO Trimmer'
        )
        
        # Try librosa first (handles most formats)
        try:
            audio_data, sample_rate = lib_manager.librosa().load(file_path, sr=None, mono=not preserve_stereo)
            return audio_data, sample_rate
        except Exception as e:
            logger.error(f"librosa failed to load {file_path}: {e}")
            print(f"librosa failed to load {file_path}: {e}")
            return AudioUtils._load_with_soundfile(file_path, preserve_stereo)
    

    
    @staticmethod
    def _load_with_soundfile(file_path: str, preserve_stereo: bool) -> Tuple:
        """Fallback loading using soundfile for problematic formats"""
        try:
            audio_data, sample_rate = sf.read(file_path)
            
            # Convert to list format for bundled environment
            if len(audio_data.shape) == 2:
                # Stereo - convert to list of lists
                samples = []
                for i in range(audio_data.shape[0]):
                    samples.append([float(audio_data[i, 0]), float(audio_data[i, 1])])
            else:
                # Mono - convert to flat list
                samples = [float(sample) for sample in audio_data]
            
            # Handle stereo/mono conversion
            if not preserve_stereo and len(audio_data.shape) == 2:
                mono_samples = []
                for sample_pair in samples:
                    avg_sample = (sample_pair[0] + sample_pair[1]) / 2
                    mono_samples.append(avg_sample)
                samples = mono_samples
            return samples, sample_rate
        except Exception as e:
            logger.error(f"soundfile failed to load {file_path}: {e}")
            return AudioUtils._load_with_pure_python(file_path, preserve_stereo)
    
    @staticmethod
    def _load_with_pure_python(file_path: str, preserve_stereo: bool) -> Tuple:
        """Pure Python WAV file parser as final fallback"""
        try:
            import struct
            import wave
            
            with wave.open(file_path, 'rb') as wav_file:
                # Get WAV file properties
                channels = wav_file.getnchannels()
                sample_width = wav_file.getsampwidth()
                sample_rate = wav_file.getframerate()
                n_frames = wav_file.getnframes()
                
                # Read all frames
                raw_data = wav_file.readframes(n_frames)
                
                # Convert raw bytes to samples based on sample width
                samples = []
                if sample_width == 2:  # 16-bit
                    format_string = f'<{n_frames * channels}h'
                    raw_samples = struct.unpack(format_string, raw_data)
                elif sample_width == 4:  # 32-bit
                    format_string = f'<{n_frames * channels}i'
                    raw_samples = struct.unpack(format_string, raw_data)
                else:  # 8-bit or other
                    raw_samples = list(raw_data)
                
                # Convert to float and normalize
                max_value = 2**(sample_width * 8 - 1) - 1
                
                if channels == 2 and preserve_stereo:
                    # Stereo - convert to list of [left, right] pairs
                    samples = []
                    for i in range(0, len(raw_samples), 2):
                        if i + 1 < len(raw_samples):
                            left = float(raw_samples[i]) / max_value
                            right = float(raw_samples[i + 1]) / max_value
                            samples.append([left, right])
                        else:
                            # Handle odd number of samples
                            left = float(raw_samples[i]) / max_value
                            samples.append([left, 0.0])
                elif channels == 2 and not preserve_stereo:
                    # Stereo to mono - average channels
                    samples = []
                    for i in range(0, len(raw_samples), 2):
                        if i + 1 < len(raw_samples):
                            left = float(raw_samples[i]) / max_value
                            right = float(raw_samples[i + 1]) / max_value
                            avg = (left + right) / 2.0
                            samples.append(avg)
                        else:
                            # Handle odd number of samples
                            left = float(raw_samples[i]) / max_value
                            samples.append(left)
                else:
                    # Mono - convert to flat list
                    samples = [float(sample) / max_value for sample in raw_samples]
                
                return samples, sample_rate
                
        except Exception as e:
            logger.error(f"Pure Python parser failed to load {file_path}: {e}")
            handle_pydub_error(e, f"Failed to load {file_path}")
            return None, 0
    

    

    
    @staticmethod
    def save_audio_file(audio_data, sample_rate: int, output_path: str, bitrate: int = None) -> bool:
        """
        Save audio data to file
        
        Args:
            audio_data: Audio data to save
            sample_rate: Sample rate
            output_path: Output file path
            bitrate: Target bitrate in kbps (for MP3 compression)
            
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
            
            # Handle different file formats
            file_ext = output_path.lower().split('.')[-1]
            
            if file_ext == 'mp3':
                # For MP3 files, use bitrate compression if specified
                if bitrate and bitrate < 320:
                    success = AudioUtils._save_with_bitrate(audio_data, sample_rate, output_path, bitrate)
                    if not success:
                        # Fallback to normal save if bitrate compression fails
                        handle_ffmpeg_warning()  # Show warning about ffmpeg
                        lib_manager.soundfile().write(output_path, audio_data, sample_rate)
                        return True
                    return success
                else:
                    lib_manager.soundfile().write(output_path, audio_data, sample_rate)
                    return True
            elif file_ext == 'wav':
                # For WAV files, use sample rate reduction for size reduction
                if bitrate and bitrate < 320:
                    # Convert bitrate to approximate sample rate reduction
                    target_sample_rate = AudioUtils._get_target_sample_rate(bitrate)
                    if target_sample_rate < sample_rate:
                        success = AudioUtils._save_wav_with_reduced_sample_rate(
                            audio_data, sample_rate, output_path, target_sample_rate
                        )
                        if not success:
                            handle_pydub_error(Exception("Sample rate reduction failed"), f"WAV file processing failed for {output_path}")
                            lib_manager.soundfile().write(output_path, audio_data, sample_rate)
                            return True
                        return success
                    else:
                        lib_manager.soundfile().write(output_path, audio_data, sample_rate)
                        return True
                else:
                    lib_manager.soundfile().write(output_path, audio_data, sample_rate)
                    return True
            else:
                # For other formats, save normally
                lib_manager.soundfile().write(output_path, audio_data, sample_rate)
                return True
        except Exception as e:
            # Don't show individual error dialogs - let the processing thread handle it
            print(f"Failed to save audio file {output_path}: {e}")
            return False
    
    @staticmethod
    def get_audio_shape_info(audio_data) -> dict:
        """Get information about audio data shape"""
        # Handle both numpy arrays and Python lists
        if hasattr(audio_data, 'shape'):
            # Numpy array
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
        else:
            # Python list - check if it's stereo (list of lists) or mono (flat list)
            if audio_data and isinstance(audio_data[0], list):
                # Stereo (list of lists)
                return {
                    'is_stereo': True,
                    'channels': 2,
                    'samples': len(audio_data),
                    'duration_samples': len(audio_data)
                }
            else:
                # Mono (flat list)
                return {
                    'is_stereo': False,
                    'channels': 1,
                    'samples': len(audio_data),
                    'duration_samples': len(audio_data)
                }
    
    @staticmethod
    def trim_audio_data(audio_data, start_sample: int, end_sample: int):
        """
        Trim audio data to specified range
        
        Args:
            audio_data: Audio data as numpy array or Python list
            start_sample: Start sample index
            end_sample: End sample index
            
        Returns:
            Trimmed audio data
        """
        # Handle both numpy arrays and Python lists
        if hasattr(audio_data, 'shape'):
            # Numpy array
            if len(audio_data.shape) == 2:
                # Stereo audio
                return audio_data[:, start_sample:end_sample]
            else:
                # Mono audio
                return audio_data[start_sample:end_sample]
        else:
            # Python list
            if audio_data and isinstance(audio_data[0], list):
                # Stereo (list of lists)
                return audio_data[start_sample:end_sample]
            else:
                # Mono (flat list)
                return audio_data[start_sample:end_sample]
    
    @staticmethod
    def calculate_energy_envelope(audio_data, frame_length: int = 2048, hop_length: int = 512):
        """
        Calculate energy envelope using librosa RMS or simple RMS for bundled environment
        
        Args:
            audio_data: Audio data as numpy array or Python list
            frame_length: Frame length for RMS calculation
            hop_length: Hop length for RMS calculation
            
        Returns:
            Energy envelope as numpy array or list
        """
        # Check if we're in a bundled environment
        import sys
        is_bundled = hasattr(sys, '_MEIPASS')
        
        if is_bundled:
            # Use simple RMS calculation for bundled environment
            return AudioUtils._calculate_simple_energy_envelope(audio_data, frame_length, hop_length)
        else:
            # Use librosa RMS for development environment
            np = lib_manager.numpy()
            if hasattr(audio_data, 'shape') and len(audio_data.shape) == 2:
                # Stereo audio - calculate RMS across both channels
                rms = lib_manager.librosa().feature.rms(y=audio_data, frame_length=frame_length, hop_length=hop_length)
                rms = np.max(rms, axis=0).flatten()
            else:
                # Mono audio
                rms = lib_manager.librosa().feature.rms(y=audio_data, frame_length=frame_length, hop_length=hop_length)[0]
            
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
    
    @staticmethod
    def _calculate_simple_energy_envelope(audio_data, frame_length: int = 2048, hop_length: int = 512):
        """
        Calculate simple energy envelope without numpy/librosa for bundled environment
        
        Args:
            audio_data: Audio data as Python list
            frame_length: Frame length for RMS calculation
            hop_length: Hop length for RMS calculation
            
        Returns:
            Energy envelope as list
        """
        # Get audio shape info
        shape_info = AudioUtils.get_audio_shape_info(audio_data)
        total_samples = shape_info['duration_samples']
        
        # Calculate RMS for each frame
        energy = []
        for i in range(0, total_samples, hop_length):
            end_idx = min(i + frame_length, total_samples)
            
            # Extract frame samples
            if shape_info['is_stereo']:
                # Stereo - average both channels
                frame_samples = []
                for j in range(i, end_idx):
                    if j < len(audio_data) and len(audio_data[j]) == 2:
                        # Average left and right channels
                        avg_sample = (audio_data[j][0] + audio_data[j][1]) / 2
                        frame_samples.append(avg_sample)
                    else:
                        frame_samples.append(0)
            else:
                # Mono
                frame_samples = audio_data[i:end_idx]
            
            # Calculate RMS for this frame
            if frame_samples:
                # Simple RMS calculation
                sum_squares = sum(sample * sample for sample in frame_samples)
                rms = (sum_squares / len(frame_samples)) ** 0.5
                energy.append(rms)
            else:
                energy.append(0)
        
        # Interpolate to match original audio length
        energy_length = len(energy)
        if energy_length > 1:
            # Simple linear interpolation
            interpolated_energy = []
            for i in range(total_samples):
                # Map sample index to energy index
                energy_idx = (i * (energy_length - 1)) / (total_samples - 1)
                energy_idx = min(energy_idx, energy_length - 1)
                
                # Linear interpolation
                idx_floor = int(energy_idx)
                idx_ceil = min(idx_floor + 1, energy_length - 1)
                frac = energy_idx - idx_floor
                
                if idx_floor == idx_ceil:
                    interpolated_energy.append(energy[idx_floor])
                else:
                    interpolated_value = energy[idx_floor] * (1 - frac) + energy[idx_ceil] * frac
                    interpolated_energy.append(interpolated_value)
            
            return interpolated_energy
        else:
            # Single energy value - repeat for all samples
            return [energy[0] if energy else 0] * total_samples
    
    @staticmethod
    def is_ffmpeg_available() -> bool:
        """Check if ffmpeg is available for bitrate compression using ffmpeg-python"""
        if not lib_manager.is_ffmpeg_available():
            return False
        
        # Check if ffmpeg binary is available in system PATH
        try:
            result = subprocess.run(['ffmpeg', '-version'], 
                                  capture_output=True, text=True, timeout=5)
            return result.returncode == 0
        except (subprocess.TimeoutExpired, FileNotFoundError, subprocess.SubprocessError):
            return False
    
    @staticmethod
    def get_ffmpeg_path() -> str:
        """Get the path to ffmpeg executable using system PATH"""
        if not lib_manager.is_ffmpeg_available():
            return 'ffmpeg'  # Fallback
        
        # Check system PATH for ffmpeg
        try:
            result = subprocess.run(['which', 'ffmpeg'], 
                                  capture_output=True, text=True, timeout=5)
            if result.returncode == 0:
                return result.stdout.strip()
        except (subprocess.TimeoutExpired, FileNotFoundError, subprocess.SubprocessError):
            pass
        
        return 'ffmpeg'  # Fallback to system PATH
    
    @staticmethod
    def _get_target_sample_rate(bitrate: int) -> int:
        """
        Convert bitrate to approximate target sample rate for WAV files
        
        Args:
            bitrate: Target bitrate in kbps
            
        Returns:
            Target sample rate in Hz
        """
        # Approximate mapping: 320kbps ≈ 44.1kHz, 192kbps ≈ 44.1kHz, 128kbps ≈ 22kHz, 64kbps ≈ 11kHz
        if bitrate >= 192:
            return 44100  # High quality - keep original sample rate
        elif bitrate >= 128:
            return 22050  # Medium quality - half sample rate
        elif bitrate >= 96:
            return 16000  # Lower quality - reduced sample rate
        elif bitrate >= 64:
            return 11025  # Low quality - quarter sample rate
        else:
            return 8000   # Minimum reasonable sample rate
    
    @staticmethod
    def _save_wav_with_reduced_sample_rate(audio_data, original_sample_rate: int, 
                                          output_path: str, target_sample_rate: int) -> bool:
        """
        Save WAV file with reduced sample rate for size reduction
        
        Args:
            audio_data: Audio data to save
            original_sample_rate: Original sample rate
            output_path: Output file path
            target_sample_rate: Target sample rate
            
        Returns:
            bool: True if save was successful
        """
        try:
            from scipy import signal
            
            # Resample audio to target sample rate
            if original_sample_rate != target_sample_rate:
                # Calculate resampling ratio
                ratio = target_sample_rate / original_sample_rate
                
                # Resample using scipy
                if len(audio_data.shape) == 2:
                    # Stereo audio
                    resampled_channels = []
                    for channel in audio_data:
                        resampled_channel = signal.resample(channel, int(len(channel) * ratio))
                        resampled_channels.append(resampled_channel)
                    np = lib_manager.numpy()
                    resampled_audio = np.array(resampled_channels)
                else:
                    # Mono audio
                    resampled_audio = signal.resample(audio_data, int(len(audio_data) * ratio))
                
                # Ensure audio data is in the correct format for soundfile
                # soundfile expects (samples, channels) format
                if len(resampled_audio.shape) == 2 and resampled_audio.shape[0] == 2:
                    # If we have (channels, samples), transpose to (samples, channels)
                    resampled_audio = resampled_audio.T
                
                # Save with reduced sample rate
                lib_manager.soundfile().write(output_path, resampled_audio, target_sample_rate)
            else:
                # No resampling needed
                # Ensure audio data is in the correct format for soundfile
                if len(audio_data.shape) == 2 and audio_data.shape[0] == 2:
                    # If we have (channels, samples), transpose to (samples, channels)
                    audio_data = audio_data.T
                
                lib_manager.soundfile().write(output_path, audio_data, original_sample_rate)
            
            return True
            
        except Exception as e:
            print(f"Failed to save WAV with reduced sample rate: {e}")
            return False
    
    @staticmethod
    def _save_with_bitrate(audio_data, sample_rate: int, output_path: str, bitrate: int) -> bool:
        """
        Save audio with specific bitrate using ffmpeg-python
        
        Args:
            audio_data: Audio data to save
            sample_rate: Sample rate
            output_path: Output file path
            bitrate: Target bitrate in kbps
            
        Returns:
            bool: True if save was successful
        """
        if not lib_manager.is_ffmpeg_available():
            handle_ffmpeg_error("ffmpeg-python not available", f"Bitrate compression failed for {output_path}")
            return False
        
        try:
            import os
            import tempfile
            
            np = lib_manager.numpy()
            # Ensure audio data is in the correct format for soundfile
            # soundfile expects (samples, channels) format
            if len(audio_data.shape) == 2 and audio_data.shape[0] == 2:
                # If we have (channels, samples), transpose to (samples, channels)
                audio_data = audio_data.T
            
            # Convert to float32 for soundfile
            if audio_data.dtype != np.float32:
                audio_data = audio_data.astype(np.float32)
            
            # Save audio data to temporary WAV file first
            with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_wav:
                temp_wav_path = temp_wav.name
            
            # Save as WAV using soundfile
            sf = lib_manager.soundfile()
            sf.write(temp_wav_path, audio_data, sample_rate)
            
            # Use ffmpeg-python to encode with specified bitrate
            (
                lib_manager.ffmpeg()
                .input(temp_wav_path)
                .output(output_path, format='mp3', audio_bitrate=f"{bitrate}k", 
                       codec='libmp3lame')
                .run(overwrite_output=True, capture_stdout=True, capture_stderr=True)
            )
            
            # Clean up temporary file
            os.unlink(temp_wav_path)
            return True
            
        except Exception as e:
            handle_ffmpeg_error(e, f"Bitrate compression failed for {output_path}")
            return False 