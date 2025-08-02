"""
Audio utility functions for common operations
"""

import numpy as np
import librosa
import soundfile as sf
from typing import Tuple, Optional, Union
import warnings

# Import error handler
try:
    from utils.error_handler import handle_ffmpeg_warning, handle_pydub_error
except ImportError:
    # Fallback if error handler not available
    def handle_ffmpeg_warning():
        print("WARNING: FFmpeg not found - MP3 compression will use full quality")
    def handle_pydub_error(error, context=""):
        print(f"ERROR: Pydub error - {error} (Context: {context})")




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
            # Import pydub only when needed to avoid ffmpeg warnings at startup
            from pydub import AudioSegment
            
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
            handle_pydub_error(e, f"Failed to load {file_path}")
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
    def save_audio_file(audio_data: np.ndarray, sample_rate: int, output_path: str, bitrate: int = None) -> bool:
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
                        sf.write(output_path, audio_data, sample_rate)
                        return True
                    return success
                else:
                    sf.write(output_path, audio_data, sample_rate)
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
                            sf.write(output_path, audio_data, sample_rate)
                            return True
                        return success
                    else:
                        sf.write(output_path, audio_data, sample_rate)
                        return True
                else:
                    sf.write(output_path, audio_data, sample_rate)
                    return True
            else:
                # For other formats, save normally
                sf.write(output_path, audio_data, sample_rate)
                return True
        except Exception as e:
            # Don't show individual error dialogs - let the processing thread handle it
            print(f"Failed to save audio file {output_path}: {e}")
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
    
    @staticmethod
    def is_ffmpeg_available() -> bool:
        """Check if ffmpeg is available for bitrate compression"""
        import subprocess
        import sys
        import os
        
        # Check multiple possible ffmpeg locations
        ffmpeg_paths = [
            'ffmpeg',  # System PATH
            os.path.join(os.path.dirname(sys.executable), 'ffmpeg'),  # Bundled with app
            os.path.join(os.path.dirname(sys.executable), '..', 'ffmpeg'),  # Relative to app
            os.path.join(os.path.dirname(sys.executable), '..', '..', 'ffmpeg'),  # Two levels up
        ]
        
        for ffmpeg_path in ffmpeg_paths:
            try:
                result = subprocess.run([ffmpeg_path, '-version'], 
                                      capture_output=True, text=True, timeout=5)
                if result.returncode == 0:
                    return True
            except (subprocess.TimeoutExpired, FileNotFoundError, subprocess.SubprocessError):
                continue
        
        return False
    
    @staticmethod
    def get_ffmpeg_path() -> str:
        """Get the path to ffmpeg executable"""
        import subprocess
        import sys
        import os
        
        # Check multiple possible ffmpeg locations
        ffmpeg_paths = [
            'ffmpeg',  # System PATH
            os.path.join(os.path.dirname(sys.executable), 'ffmpeg'),  # Bundled with app
            os.path.join(os.path.dirname(sys.executable), '..', 'ffmpeg'),  # Relative to app
            os.path.join(os.path.dirname(sys.executable), '..', '..', 'ffmpeg'),  # Two levels up
            '/opt/homebrew/bin/ffmpeg',  # Homebrew on Apple Silicon
            '/usr/local/bin/ffmpeg',  # Homebrew on Intel
        ]
        
        for ffmpeg_path in ffmpeg_paths:
            try:
                result = subprocess.run([ffmpeg_path, '-version'], 
                                      capture_output=True, text=True, timeout=5)
                if result.returncode == 0:
                    return ffmpeg_path
            except (subprocess.TimeoutExpired, FileNotFoundError, subprocess.SubprocessError):
                continue
        
        # If no specific path found, try to find ffmpeg in PATH
        try:
            result = subprocess.run(['which', 'ffmpeg'], 
                                  capture_output=True, text=True, timeout=5)
            if result.returncode == 0:
                return result.stdout.strip()
        except:
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
    def _save_wav_with_reduced_sample_rate(audio_data: np.ndarray, original_sample_rate: int, 
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
                    resampled_audio = np.array(resampled_channels)
                else:
                    # Mono audio
                    resampled_audio = signal.resample(audio_data, int(len(audio_data) * ratio))
                
                # Save with reduced sample rate
                sf.write(output_path, resampled_audio.T if len(resampled_audio.shape) == 2 else resampled_audio, 
                        target_sample_rate)
            else:
                # No resampling needed
                sf.write(output_path, audio_data.T if len(audio_data.shape) == 2 else audio_data, 
                        original_sample_rate)
            
            return True
            
        except Exception as e:
            print(f"Failed to save WAV with reduced sample rate: {e}")
            return False
    
    @staticmethod
    def _save_with_bitrate(audio_data: np.ndarray, sample_rate: int, output_path: str, bitrate: int) -> bool:
        """
        Save audio with specific bitrate using pydub
        
        Args:
            audio_data: Audio data to save
            sample_rate: Sample rate
            output_path: Output file path
            bitrate: Target bitrate in kbps
            
        Returns:
            bool: True if save was successful
        """
        try:
            from pydub import AudioSegment
            import io
            
            # Ensure audio data is in the correct format for pydub
            # soundfile format is (samples, channels), pydub expects (channels, samples)
            if len(audio_data.shape) == 2:
                # Stereo - transpose to get (channels, samples)
                audio_data = audio_data.T
            else:
                # Mono - reshape to (1, samples)
                audio_data = audio_data.reshape(1, -1)
            
            # Convert to int16 format for pydub
            if audio_data.dtype != np.int16:
                # Normalize to [-32768, 32767] range
                audio_data = (audio_data * 32767).astype(np.int16)
            
            # Create AudioSegment from numpy array
            if audio_data.shape[0] == 2:
                # Stereo
                audio_segment = AudioSegment(
                    audio_data.tobytes(),
                    frame_rate=sample_rate,
                    sample_width=2,  # 16-bit
                    channels=2
                )
            else:
                # Mono
                audio_segment = AudioSegment(
                    audio_data.tobytes(),
                    frame_rate=sample_rate,
                    sample_width=2,  # 16-bit
                    channels=1
                )
            
            # Export with specified bitrate
            audio_segment.export(output_path, format="mp3", bitrate=f"{bitrate}k", 
                               codec="libmp3lame")
            return True
            
        except Exception as e:
            handle_pydub_error(e, f"Bitrate compression failed for {output_path}")
            return False 