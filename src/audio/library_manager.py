"""
Centralized library manager for audio processing libraries
Uses singleton pattern to avoid repeated imports and improve performance
"""

import logging
from typing import Optional

logger = logging.getLogger(__name__)
# Set logging level to ERROR only for performance
logger.setLevel(logging.ERROR)


class LibraryManager:
    """Singleton manager for audio processing libraries"""
    
    _instance = None
    _numpy = None
    _librosa = None
    _scipy = None
    _soundfile = None
    _ffmpeg = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(LibraryManager, cls).__new__(cls)
        return cls._instance
    
    @classmethod
    def numpy(cls):
        """Get numpy instance (singleton)"""
        if cls._numpy is None:
            try:
                import numpy as np
                cls._numpy = np
            except ImportError as e:
                logger.error(f"Failed to import numpy: {e}")
                raise
        return cls._numpy
    
    @classmethod
    def librosa(cls):
        """Get librosa instance (singleton)"""
        if cls._librosa is None:
            try:
                import librosa
                cls._librosa = librosa
            except ImportError as e:
                logger.error(f"Failed to import librosa: {e}")
                raise
        return cls._librosa
    
    @classmethod
    def scipy(cls):
        """Get scipy instance (singleton)"""
        if cls._scipy is None:
            try:
                import scipy
                cls._scipy = scipy
            except ImportError as e:
                logger.error(f"Failed to import scipy: {e}")
                raise
        return cls._scipy
    
    @classmethod
    def soundfile(cls):
        """Get soundfile instance (singleton)"""
        if cls._soundfile is None:
            try:
                import soundfile as sf
                cls._soundfile = sf
            except ImportError as e:
                logger.error(f"Failed to import soundfile: {e}")
                raise
        return cls._soundfile
    
    @classmethod
    def ffmpeg(cls):
        """Get ffmpeg instance (singleton)"""
        if cls._ffmpeg is None:
            try:
                import ffmpeg
                cls._ffmpeg = ffmpeg
            except ImportError as e:
                logger.error(f"Failed to import ffmpeg: {e}")
                cls._ffmpeg = None
        return cls._ffmpeg
    
    @classmethod
    def is_ffmpeg_available(cls) -> bool:
        """Check if ffmpeg is available"""
        return cls.ffmpeg() is not None
    
    @classmethod
    def reset(cls):
        """Reset all library instances (for testing)"""
        cls._numpy = None
        cls._librosa = None
        cls._scipy = None
        cls._soundfile = None
        cls._ffmpeg = None


# Global instance
lib_manager = LibraryManager() 