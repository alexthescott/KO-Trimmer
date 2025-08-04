"""
Audio processing modules for KO Trimmer

This module provides audio processing functionality including:
- Audio file loading and validation
- Silence detection and trimming
- File handling and path management
- Common audio utilities
"""

# Lazy imports to avoid startup issues
def get_processor():
    from .processor import AudioProcessor
    return AudioProcessor

def get_silence_detector():
    from .silence_detector import SilenceDetector
    return SilenceDetector

def get_file_handler():
    from .file_handler import AudioFileHandler
    return AudioFileHandler

__all__ = ['get_processor', 'get_silence_detector', 'get_file_handler'] 