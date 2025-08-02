"""
Refactored main window for KO Trimmer application
"""

import os
from pathlib import Path
from typing import List, Dict, Any

from PyQt6.QtWidgets import (
    QMainWindow, QWidget, QVBoxLayout, QHBoxLayout, 
    QSplitter, QMenuBar
)
from PyQt6.QtCore import Qt
from PyQt6.QtGui import QAction

from .favorites_sidebar import FavoritesSidebar
from .file_panel import FilePanel
from .settings_panel import SettingsPanel
from .processing_manager import ProcessingManager
from .welcome_dialog import WelcomeDialog
from utils.settings_manager import SettingsManager
from utils.icon_manager import get_app_icon


class MainWindowRefactored(QMainWindow):
    """Refactored main application window using component modules"""
    
    def __init__(self):
        super().__init__()
        self.settings_manager = SettingsManager()
        self.favorites = []
        self.init_ui()
        self.setup_connections()
        self.load_settings()
        self.show_welcome_if_needed()
        
    def init_ui(self):
        """Initialize the user interface"""
        self.setWindowTitle("KO Trimmer - Audio Silence Trimmer")
        self.setMinimumSize(900, 600)
        self.resize(900, 600)
        self.setWindowIconText("KO Trimmer")
        
        # Set window properties for better macOS integration
        self.setWindowFlags(self.windowFlags() | Qt.WindowType.WindowTitleHint)
        self.setObjectName("KO Trimmer")
        self.setWindowIcon(get_app_icon())
        
        # Create menu bar
        self.create_menu_bar()
        
        # Create central widget
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        
        # Create main layout
        main_layout = QHBoxLayout(central_widget)
        
        # Create splitter for resizable panels
        self.splitter = QSplitter(Qt.Orientation.Horizontal)
        main_layout.addWidget(self.splitter)
        
        # Left panel - Favorites sidebar
        self.favorites_sidebar = FavoritesSidebar()
        self.splitter.addWidget(self.favorites_sidebar)
        
        # Center panel - File management
        self.file_panel = FilePanel()
        self.splitter.addWidget(self.file_panel)
        
        # Right panel - Settings and controls
        self.settings_panel = SettingsPanel()
        self.splitter.addWidget(self.settings_panel)
        
        # Set splitter proportions
        self.splitter.setSizes([200, 400, 300])
        
        # Initially hide the right panel until files are added
        self.settings_panel.hide()
        self.splitter.setSizes([200, 400, 0])
        
        # Create processing manager
        self.processing_manager = ProcessingManager(
            self.settings_panel, 
            self.settings_panel.progress_widget
        )
        
    def create_menu_bar(self):
        """Create the menu bar with undo functionality"""
        menubar = self.menuBar()
        
        # Edit menu
        edit_menu = menubar.addMenu("Edit")
        
        # Undo action
        self.undo_action = QAction("Undo", self)
        self.undo_action.setShortcut("Ctrl+Z")
        self.undo_action.setEnabled(False)
        self.undo_action.triggered.connect(self.undo_last_action)
        edit_menu.addAction(self.undo_action)
        
    def setup_connections(self):
        """Setup signal connections between components"""
        # Favorites sidebar connections
        self.favorites_sidebar.favorite_selected.connect(self.on_favorite_selected)
        self.favorites_sidebar.favorites_changed.connect(self.on_favorites_changed)
        
        # File panel connections
        self.file_panel.files_changed.connect(self.on_files_changed)
        self.file_panel.file_selected.connect(self.on_file_selected)
        
        # Settings panel connections
        self.settings_panel.settings_changed.connect(self.on_settings_changed)
        self.settings_panel.process_btn.clicked.connect(self.process_files)
        self.settings_panel.stop_btn.clicked.connect(self.stop_processing)
        
    def on_files_changed(self):
        """Handle file list changes"""
        has_files = self.file_panel.has_files()
        self.settings_panel.set_process_button_enabled(has_files)
        
        # Show/hide settings panel based on whether there are files
        if has_files:
            self.settings_panel.show()
            self.splitter.setSizes([200, 400, 300])
        else:
            self.settings_panel.hide()
            self.splitter.setSizes([200, 400, 0])
            
    def on_file_selected(self, file_path: str):
        """Handle file selection"""
        # Could be used for auto-preview or other features
        pass
        
    def on_settings_changed(self):
        """Handle settings changes"""
        # Save settings when they change
        self.save_settings()
        
    def process_files(self):
        """Process the current file list"""
        file_paths = self.file_panel.get_file_paths()
        self.processing_manager.process_files(file_paths)
        
    def stop_processing(self):
        """Stop the current processing operation"""
        self.processing_manager.stop_processing()
        
    def on_favorite_selected(self, directory: str):
        """Handle favorite directory selection"""
        # Scan the directory and add files to the list
        self.processing_manager.scan_directory(directory)
        
        # For now, we'll need to connect the scan results to the file panel
        # This would require extending the processing manager to emit signals
        
    def on_favorites_changed(self, favorites: List[Dict[str, str]]):
        """Handle favorites list changes"""
        self.favorites = favorites
        self.save_settings()
        
    def undo_last_action(self):
        """Undo the last action"""
        # This could be implemented to track and undo file operations
        pass
        
    def load_settings(self):
        """Load application settings"""
        try:
            settings = self.settings_manager.load_settings()
            
            # Load favorites
            self.favorites = settings.get('favorites', [])
            self.favorites_sidebar.set_favorites(self.favorites)
            
            # Load processing settings
            processing_settings = settings.get('processing_settings', {})
            self.settings_panel.set_settings(processing_settings)
            
        except Exception as e:
            print(f"Error loading settings: {e}")
            
    def save_settings(self):
        """Save application settings"""
        try:
            settings = {
                'favorites': self.favorites,
                'processing_settings': self.settings_panel.get_settings()
            }
            self.settings_manager.save_settings(settings)
        except Exception as e:
            print(f"Error saving settings: {e}")
            
    def show_welcome_if_needed(self):
        """Show welcome dialog if needed"""
        try:
            settings = self.settings_manager.load_settings()
            show_welcome = settings.get('show_welcome', True)
            
            if show_welcome:
                welcome_dialog = WelcomeDialog(self)
                welcome_dialog.favorites_selected.connect(self.on_welcome_favorites_selected)
                
                if welcome_dialog.exec():
                    # User completed welcome setup
                    self.favorites = welcome_dialog.get_favorites()
                    self.favorites_sidebar.set_favorites(self.favorites)
                    
                    # Save settings
                    settings['show_welcome'] = welcome_dialog.should_show_welcome()
                    self.settings_manager.save_settings(settings)
                    
        except Exception as e:
            print(f"Error showing welcome dialog: {e}")
            
    def on_welcome_favorites_selected(self, favorites: List[Dict[str, str]]):
        """Handle favorites selected in welcome dialog"""
        self.favorites = favorites
        self.favorites_sidebar.set_favorites(favorites)
        
    def closeEvent(self, event):
        """Handle application close event"""
        self.save_settings()
        event.accept() 