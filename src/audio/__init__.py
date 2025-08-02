"""
Audio processing modules for KO Trimmer

This module provides audio processing functionality including:
- Audio file loading and validation
- Silence detection and trimming
- File handling and path management
- Common audio utilities
"""

from .processor import AudioProcessor
from .silence_detector import SilenceDetector
from .file_handler import AudioFileHandler
from .audio_utils import AudioUtils

__all__ = ['AudioProcessor', 'SilenceDetector', 'AudioFileHandler', 'AudioUtils'] 