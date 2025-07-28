"""
Silence detection algorithms for audio processing
"""

import numpy as np
from typing import List, Dict, Any
import librosa


class SilenceDetector:
    """Class for detecting silence regions in audio"""
    
    def __init__(self):
        self.supported_formats = {'.wav', '.mp3', '.flac', '.aiff', '.m4a', '.ogg'}
        
    def detect_silence(self, audio_data: np.ndarray, sample_rate: int, settings: Dict[str, Any]) -> List[Dict[str, int]]:
        """
        Detect silence regions in audio data
        
        Args:
            audio_data: Audio data as numpy array
            sample_rate: Sample rate of the audio
            settings: Detection settings
            
        Returns:
            List of silence regions with start and end sample indices
        """
        # Get settings with defaults
        threshold_db = settings.get('threshold', -40)
        min_duration_ms = settings.get('min_duration', 500)
        
        # Convert threshold from dB to linear scale
        threshold_linear = 10 ** (threshold_db / 20)
        
        # Convert minimum duration from ms to samples
        min_duration_samples = int(min_duration_ms * sample_rate / 1000)
        
        # Calculate audio energy
        energy = self.calculate_energy(audio_data)
        
        # Find silence regions
        silence_regions = self.find_silence_regions(
            energy, 
            threshold_linear, 
            min_duration_samples
        )
        
        return silence_regions
        
    def calculate_energy(self, audio_data: np.ndarray) -> np.ndarray:
        """
        Calculate energy envelope of audio data
        
        Args:
            audio_data: Audio data as numpy array
            
        Returns:
            Energy envelope as numpy array
        """
        # Use librosa's RMS energy calculation
        frame_length = 2048
        hop_length = 512
        
        # Calculate RMS energy
        rms = librosa.feature.rms(
            y=audio_data, 
            frame_length=frame_length, 
            hop_length=hop_length
        )[0]
        
        # Interpolate to match original audio length
        original_length = len(audio_data)
        rms_length = len(rms)
        
        # Create time points for interpolation
        rms_times = np.linspace(0, original_length, rms_length)
        original_times = np.arange(original_length)
        
        # Interpolate RMS values to match original audio length
        energy = np.interp(original_times, rms_times, rms)
        
        return energy
        
    def find_silence_regions(self, energy: np.ndarray, threshold: float, min_duration_samples: int) -> List[Dict[str, int]]:
        """
        Find silence regions based on energy threshold
        
        Args:
            energy: Energy envelope
            threshold: Energy threshold (linear scale)
            min_duration_samples: Minimum silence duration in samples
            
        Returns:
            List of silence regions
        """
        # Find samples below threshold
        silence_mask = energy < threshold
        
        # Find transitions between silence and non-silence
        transitions = np.diff(silence_mask.astype(int))
        
        # Find start and end indices of silence regions
        silence_starts = np.where(transitions == 1)[0] + 1
        silence_ends = np.where(transitions == -1)[0]
        
        # Handle edge cases
        if silence_mask[0]:
            silence_starts = np.concatenate([[0], silence_starts])
        if silence_mask[-1]:
            silence_ends = np.concatenate([silence_ends, [len(energy) - 1]])
            
        # Create silence regions
        silence_regions = []
        for start, end in zip(silence_starts, silence_ends):
            duration = end - start + 1
            
            if duration >= min_duration_samples:
                silence_regions.append({
                    'start': start,
                    'end': end,
                    'duration': duration
                })
                
        return silence_regions
        
    def detect_leading_trailing_silence(self, audio_data: np.ndarray, sample_rate: int, settings: Dict[str, Any]) -> Dict[str, int]:
        """
        Detect leading and trailing silence specifically
        
        Args:
            audio_data: Audio data as numpy array
            sample_rate: Sample rate of the audio
            settings: Detection settings
            
        Returns:
            Dictionary with start and end sample indices
        """
        # Get silence regions
        silence_regions = self.detect_silence(audio_data, sample_rate, settings)
        
        if not silence_regions:
            return {'start': 0, 'end': len(audio_data) - 1}
            
        # Find the first and last non-silent regions
        # The first silence region ends where audio starts
        # The last silence region starts where audio ends
        audio_start = silence_regions[0]['end'] + 1
        audio_end = silence_regions[-1]['start'] - 1
        
        return {
            'start': audio_start,
            'end': audio_end
        }
        
    def analyze_audio_characteristics(self, audio_data: np.ndarray, sample_rate: int) -> Dict[str, Any]:
        """
        Analyze audio characteristics for better silence detection
        
        Args:
            audio_data: Audio data as numpy array
            sample_rate: Sample rate of the audio
            
        Returns:
            Dictionary with audio characteristics
        """
        # Calculate basic statistics
        rms = np.sqrt(np.mean(audio_data**2))
        peak = np.max(np.abs(audio_data))
        
        # Calculate spectral centroid (brightness)
        spectral_centroid = librosa.feature.spectral_centroid(y=audio_data, sr=sample_rate)[0]
        avg_spectral_centroid = np.mean(spectral_centroid)
        
        # Calculate zero crossing rate
        zero_crossing_rate = librosa.feature.zero_crossing_rate(audio_data)[0]
        avg_zero_crossing_rate = np.mean(zero_crossing_rate)
        
        return {
            'rms': rms,
            'peak': peak,
            'dynamic_range_db': 20 * np.log10(peak / (rms + 1e-10)),
            'spectral_centroid': avg_spectral_centroid,
            'zero_crossing_rate': avg_zero_crossing_rate
        }
        
    def adaptive_threshold(self, audio_data: np.ndarray, sample_rate: int, base_threshold_db: float) -> float:
        """
        Calculate adaptive threshold based on audio characteristics
        
        Args:
            audio_data: Audio data as numpy array
            sample_rate: Sample rate of the audio
            base_threshold_db: Base threshold in dB
            
        Returns:
            Adaptive threshold in linear scale
        """
        # Analyze audio characteristics
        characteristics = self.analyze_audio_characteristics(audio_data, sample_rate)
        
        # Adjust threshold based on dynamic range
        dynamic_range = characteristics['dynamic_range_db']
        
        # If dynamic range is low, lower the threshold
        if dynamic_range < 20:
            adjustment_db = -10
        elif dynamic_range > 40:
            adjustment_db = 5
        else:
            adjustment_db = 0
            
        # Apply adjustment
        adjusted_threshold_db = base_threshold_db + adjustment_db
        
        # Convert to linear scale
        threshold_linear = 10 ** (adjusted_threshold_db / 20)
        
        return threshold_linear 