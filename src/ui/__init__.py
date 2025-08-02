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

from .audio_preview import AudioPreviewWidget, AudioPreviewDialog
from .audio_preview_simple import AudioPreviewSimple
from .audio_player import AudioPlayerWidget
from .combined_file_widget import CombinedFileWidget



from .favorites_sidebar import FavoritesSidebar
from .welcome_dialog import WelcomeDialog
from .progress import ProcessingProgressWidget
from .drag_drop import DragDropWidget
from .ui_utils import UIUtils

__all__ = [
    'MainWindow',
    'AudioPreviewWidget', 
    'AudioPreviewDialog',
    'AudioPreviewSimple',
    'AudioPlayerWidget',
    'CombinedFileWidget',



    'FavoritesSidebar',
    'WelcomeDialog',
    'ProcessingProgressWidget',
    'DragDropWidget',
    'UIUtils'
] 