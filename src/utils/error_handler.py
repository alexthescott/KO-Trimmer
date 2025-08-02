"""
Error handling utilities for TrimVibe
"""

import sys
import traceback
from typing import Optional, Callable
from PyQt6.QtWidgets import QMessageBox, QApplication
from PyQt6.QtCore import QObject, pyqtSignal


class ErrorHandler(QObject):
    """Centralized error handler that can display errors in the UI"""
    
    error_occurred = pyqtSignal(str, str)  # title, message
    warning_occurred = pyqtSignal(str, str)  # title, message
    
    def __init__(self):
        super().__init__()
        self._error_callback: Optional[Callable] = None
        
    def set_error_callback(self, callback: Callable[[str, str], None]):
        """Set a callback function to handle error display"""
        self._error_callback = callback
        
    def handle_error(self, title: str, message: str, show_dialog: bool = True):
        """Handle an error with optional UI display"""
        # Always log to console
        print(f"ERROR [{title}]: {message}")
        
        # Emit signal for thread-safe UI updates
        self.error_occurred.emit(title, message)
        
        # Show in UI if callback is set (thread-safe)
        if self._error_callback:
            # Use signal to ensure callback runs on main thread
            try:
                from PyQt6.QtCore import QTimer
                # Use QTimer to defer the callback to the main thread
                timer = QTimer()
                timer.singleShot(0, lambda: self._error_callback(title, message))
            except:
                # Fallback to direct call if timer fails
                self._error_callback(title, message)
        elif show_dialog:
            # Fallback to message box (thread-safe)
            try:
                app = QApplication.instance()
                if app:
                    # Use QTimer to defer dialog to main thread
                    from PyQt6.QtCore import QTimer
                    timer = QTimer()
                    timer.singleShot(0, lambda: QMessageBox.critical(None, title, message))
            except:
                pass  # Don't crash if UI isn't available
                
    def handle_warning(self, title: str, message: str, show_dialog: bool = False):
        """Handle a warning with optional UI display"""
        # Always log to console
        print(f"WARNING [{title}]: {message}")
        
        # Emit signal for thread-safe UI updates
        self.warning_occurred.emit(title, message)
        
        # Show in UI if callback is set and show_dialog is True
        if self._error_callback and show_dialog:
            # Use QTimer to defer the callback to the main thread
            try:
                from PyQt6.QtCore import QTimer
                timer = QTimer()
                timer.singleShot(0, lambda: self._error_callback(title, message))
            except:
                # Fallback to direct call if timer fails
                self._error_callback(title, message)
        elif show_dialog:
            # Fallback to message box (thread-safe)
            try:
                app = QApplication.instance()
                if app:
                    # Use QTimer to defer dialog to main thread
                    from PyQt6.QtCore import QTimer
                    timer = QTimer()
                    timer.singleShot(0, lambda: QMessageBox.warning(None, title, message))
            except:
                pass  # Don't crash if UI isn't available


# Global error handler instance
error_handler = ErrorHandler()


def handle_ffmpeg_warning():
    """Handle ffmpeg not found warning"""
    # Check if ffmpeg is actually available
    import subprocess
    try:
        result = subprocess.run(['ffmpeg', '-version'], 
                              capture_output=True, text=True, timeout=5)
        if result.returncode == 0:
            # FFmpeg is available, this might be a false alarm
            error_handler.handle_warning(
                "FFmpeg Warning",
                "FFmpeg is installed but pydub couldn't find it. MP3 compression will use full quality.\n\n"
                "This is usually harmless - the app will still work correctly.",
                show_dialog=False
            )
        else:
            # FFmpeg is not available
            error_handler.handle_warning(
                "FFmpeg Not Found",
                "FFmpeg is not installed on your system. MP3 compression will use full quality instead.\n\n"
                "To enable MP3 compression, install FFmpeg:\n"
                "• macOS: brew install ffmpeg\n"
                "• Windows: Download from https://ffmpeg.org/\n"
                "• Linux: sudo apt install ffmpeg",
                show_dialog=False
            )
    except:
        # Can't check ffmpeg, assume it's not available
        error_handler.handle_warning(
            "FFmpeg Not Found",
            "FFmpeg is not installed on your system. MP3 compression will use full quality instead.\n\n"
            "To enable MP3 compression, install FFmpeg:\n"
            "• macOS: brew install ffmpeg\n"
            "• Windows: Download from https://ffmpeg.org/\n"
            "• Linux: sudo apt install ffmpeg",
            show_dialog=False
        )


def handle_pydub_error(error: Exception, context: str = ""):
    """Handle pydub-related errors"""
    error_handler.handle_error(
        "Audio Processing Error",
        f"Failed to process audio file: {str(error)}\n\n"
        f"Context: {context}\n\n"
        "This might be due to:\n"
        "• Missing FFmpeg for MP3 compression\n"
        "• Unsupported audio format\n"
        "• Corrupted audio file"
    )


def handle_audio_load_error(file_path: str, error: Exception):
    """Handle audio file loading errors"""
    error_handler.handle_error(
        "Audio File Error",
        f"Failed to load audio file: {file_path}\n\n"
        f"Error: {str(error)}\n\n"
        "Please check that:\n"
        "• The file exists and is not corrupted\n"
        "• The file format is supported (WAV, MP3, FLAC, etc.)\n"
        "• You have permission to read the file"
    )


def handle_processing_error(file_path: str, error: Exception):
    """Handle audio processing errors"""
    error_handler.handle_error(
        "Processing Error",
        f"Failed to process file: {file_path}\n\n"
        f"Error: {str(error)}\n\n"
        "The file will be skipped and processing will continue."
    )


def setup_error_handling():
    """Setup global error handling"""
    # Redirect stderr to capture unhandled errors
    class ErrorRedirector:
        def write(self, text):
            if text.strip():
                error_handler.handle_warning("System Warning", text.strip(), show_dialog=False)
        
        def flush(self):
            pass
    
    # Only redirect if we're in a GUI context
    try:
        app = QApplication.instance()
        if app:
            sys.stderr = ErrorRedirector()
    except:
        pass  # Don't crash if not in GUI context 