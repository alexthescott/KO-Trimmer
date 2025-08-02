"""
UI components for KO Trimmer

This module provides user interface components including:
- Main application window
- Audio preview functionality
- File management widgets
- Progress tracking
- Drag and drop functionality
- Settings and processing management
- Audio player components
- Common UI utilities
"""

from .main_window import MainWindow
from .main_window_refactored import MainWindowRefactored
from .audio_preview import AudioPreviewWidget, AudioPreviewDialog
from .audio_preview_simple import AudioPreviewSimple
from .audio_player import AudioPlayerWidget
from .combined_file_widget import CombinedFileWidget
from .file_panel import FilePanel
from .settings_panel import SettingsPanel
from .processing_manager import ProcessingManager
from .favorites_sidebar import FavoritesSidebar
from .welcome_dialog import WelcomeDialog
from .progress import ProcessingProgressWidget
from .drag_drop import DragDropWidget
from .ui_utils import UIUtils

__all__ = [
    'MainWindow',
    'MainWindowRefactored',
    'AudioPreviewWidget', 
    'AudioPreviewDialog',
    'AudioPreviewSimple',
    'AudioPlayerWidget',
    'CombinedFileWidget',
    'FilePanel',
    'SettingsPanel',
    'ProcessingManager',
    'FavoritesSidebar',
    'WelcomeDialog',
    'ProcessingProgressWidget',
    'DragDropWidget',
    'UIUtils'
] 