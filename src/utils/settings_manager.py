"""
Settings manager for KO Trimmer
"""

import json
import os
from pathlib import Path
from typing import List, Dict, Any

from PyQt6.QtCore import QSettings


class SettingsManager:
    """Manages application settings and preferences"""
    
    def __init__(self):
        self.settings = QSettings("KO Trimmer", "KO Trimmer")
        self.favorites_file = self._get_favorites_file_path()
        
    def _get_favorites_file_path(self) -> Path:
        """Get the path to the favorites file"""
        app_data_dir = Path.home() / "Library" / "Application Support" / "KO Trimmer"
        app_data_dir.mkdir(parents=True, exist_ok=True)
        return app_data_dir / "favorites.json"
        
    def save_favorites(self, favorites: List[Dict[str, str]]):
        """Save favorites to file with custom display names"""
        try:
            with open(self.favorites_file, 'w') as f:
                json.dump(favorites, f, indent=2)
        except Exception as e:
            print(f"Error saving favorites: {e}")
            
    def load_favorites(self) -> List[Dict[str, str]]:
        """Load favorites from file with custom display names"""
        try:
            if self.favorites_file.exists():
                with open(self.favorites_file, 'r') as f:
                    favorites = json.load(f)
                    
                    # Handle legacy format (list of strings)
                    if favorites and isinstance(favorites[0], str):
                        # Convert old format to new format
                        favorites = [{"path": path, "display_name": ""} for path in favorites]
                    
                    # Filter out non-existent directories
                    return [f for f in favorites if os.path.exists(f.get("path", ""))]
        except Exception as e:
            print(f"Error loading favorites: {e}")
        return []
        
    def save_show_welcome(self, show: bool):
        """Save whether to show welcome screen on startup"""
        self.settings.setValue("show_welcome", show)
        
    def load_show_welcome(self) -> bool:
        """Load whether to show welcome screen on startup"""
        return self.settings.value("show_welcome", True, type=bool)
        
    def save_processing_settings(self, settings: Dict[str, Any]):
        """Save processing settings"""
        self.settings.setValue("processing_settings", settings)
        
    def load_processing_settings(self) -> Dict[str, Any]:
        """Load processing settings"""
        default_settings = {
            'threshold': -40,
            'min_duration': 1000,
            'padding': 20,
            'overwrite': False,
            'preserve_stereo': True
        }
        return self.settings.value("processing_settings", default_settings, type=dict)
        
    def save_window_geometry(self, geometry: bytes):
        """Save window geometry"""
        self.settings.setValue("window_geometry", geometry)
        
    def load_window_geometry(self) -> bytes:
        """Load window geometry"""
        try:
            return self.settings.value("window_geometry", b"", type=bytes)
        except TypeError:
            # If the stored value is not bytes, return empty bytes
            return b""
        
    def save_window_state(self, state: bytes):
        """Save window state"""
        self.settings.setValue("window_state", state)
        
    def load_window_state(self) -> bytes:
        """Load window state"""
        try:
            return self.settings.value("window_state", b"", type=bytes)
        except TypeError:
            # If the stored value is not bytes, return empty bytes
            return b"" 