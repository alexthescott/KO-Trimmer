"""
Favorites sidebar for KO Trimmer
"""

import os
from pathlib import Path
from typing import List, Optional, Dict

from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QPushButton,
    QListWidget, QListWidgetItem, QFileDialog, QMessageBox,
    QGroupBox, QMenu, QInputDialog
)
from PyQt6.QtCore import Qt, pyqtSignal
from PyQt6.QtGui import QIcon, QAction

from utils.icon_manager import show_information, show_warning


class FavoritesSidebar(QWidget):
    """Sidebar widget for favorite directories"""
    
    favorite_selected = pyqtSignal(str)  # Emits selected directory path
    favorites_changed = pyqtSignal(list)  # Emits updated favorites list
    
    def __init__(self, parent=None):
        super().__init__(parent)
        self.favorites = []  # List of dicts: [{"path": "...", "display_name": "..."}]
        self.init_ui()
        
    def init_ui(self):
        """Initialize the favorites sidebar UI"""
        layout = QVBoxLayout(self)
        layout.setContentsMargins(5, 5, 5, 5)
        
        # Header
        header_layout = QHBoxLayout()
        
        title = QLabel("Favorites")
        title.setStyleSheet("font-weight: bold; font-size: 14px; color: #2c3e50;")
        header_layout.addWidget(title)
        
        # Add button
        self.add_btn = QPushButton("+")
        self.add_btn.setMaximumSize(24, 24)
        self.add_btn.setStyleSheet("""
            QPushButton {
                background-color: #27ae60;
                color: white;
                border: none;
                border-radius: 12px;
                font-weight: bold;
                font-size: 16px;
            }
            QPushButton:hover {
                background-color: #2ecc71;
            }
        """)
        self.add_btn.clicked.connect(self.add_favorite)
        header_layout.addWidget(self.add_btn)
        
        layout.addLayout(header_layout)
        
        # Favorites list
        self.favorites_list = QListWidget()
        self.favorites_list.setContextMenuPolicy(Qt.ContextMenuPolicy.CustomContextMenu)
        self.favorites_list.customContextMenuRequested.connect(self.show_context_menu)
        self.favorites_list.itemDoubleClicked.connect(self.on_favorite_double_clicked)
        layout.addWidget(self.favorites_list)
        
        # Empty state
        self.empty_label = QLabel("No favorites yet.\nClick + to add directories!")
        self.empty_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.empty_label.setStyleSheet("color: #7f8c8d; font-style: italic; padding: 20px;")
        self.empty_label.setWordWrap(True)
        layout.addWidget(self.empty_label)
        
        # Update visibility
        self.update_empty_state()
        
    def set_favorites(self, favorites: List[Dict[str, str]]):
        """Set the list of favorite directories with display names"""
        self.favorites = favorites.copy()
        self.refresh_list()
        
    def get_favorites(self) -> List[Dict[str, str]]:
        """Get the current list of favorite directories with display names"""
        return self.favorites.copy()
        
    def get_favorite_paths(self) -> List[str]:
        """Get just the paths from favorites (for backward compatibility)"""
        return [f["path"] for f in self.favorites]
        
    def refresh_list(self):
        """Refresh the favorites list display"""
        self.favorites_list.clear()
        
        for favorite in self.favorites:
            path = favorite.get("path", "")
            if os.path.exists(path):
                item = QListWidgetItem()
                
                # Use custom display name if available, otherwise generate one
                display_name = favorite.get("display_name", "")
                if not display_name:
                    display_name = self._create_display_name(path)
                
                item.setText(display_name)
                item.setToolTip(path)  # Full path in tooltip
                item.setData(Qt.ItemDataRole.UserRole, path)
                
                # Add folder icon
                item.setIcon(self.style().standardIcon(self.style().StandardPixmap.SP_DirIcon))
                
                self.favorites_list.addItem(item)
        
        self.update_empty_state()
        
    def update_empty_state(self):
        """Update the empty state visibility"""
        has_favorites = self.favorites_list.count() > 0
        self.empty_label.setVisible(not has_favorites)
        
    def add_favorite(self):
        """Add a new favorite directory"""
        directory = QFileDialog.getExistingDirectory(
            self,
            "Select Directory to Add to Favorites",
            str(Path.home()),
            QFileDialog.Option.ShowDirsOnly
        )
        
        if directory:
            # Check if already exists
            if any(f["path"] == directory for f in self.favorites):
                show_information(self, "Already Added", "This directory is already in your favorites!")
                return
            
            # Add to favorites with empty display name (will be auto-generated)
            self.favorites.append({"path": directory, "display_name": ""})
            self.refresh_list()
            self.favorites_changed.emit(self.favorites)
            
    def remove_favorite(self, directory: str):
        """Remove a favorite directory"""
        self.favorites = [f for f in self.favorites if f["path"] != directory]
        self.refresh_list()
        self.favorites_changed.emit(self.favorites)
            
    def rename_favorite(self, directory: str):
        """Rename a favorite directory display name"""
        # Find the current favorite
        favorite = next((f for f in self.favorites if f["path"] == directory), None)
        if not favorite:
            return
            
        # Get current display name or generate one
        current_name = favorite.get("display_name", "")
        if not current_name:
            current_name = self._create_display_name(directory)
        
        new_name, ok = QInputDialog.getText(
            self,
            "Rename Favorite",
            "Enter a display name for this directory:",
            text=current_name
        )
        
        if ok and new_name.strip():
            # Update the display name
            favorite["display_name"] = new_name.strip()
            self.refresh_list()
            self.favorites_changed.emit(self.favorites)
            
    def show_context_menu(self, position):
        """Show context menu for favorites list"""
        item = self.favorites_list.itemAt(position)
        if not item:
            return
            
        directory = item.data(Qt.ItemDataRole.UserRole)
        
        menu = QMenu(self)
        
        # Show full path as menu title
        menu.setTitle(f"📁 {directory}")
        
        # Open action
        open_action = QAction("Open in Finder", self)
        open_action.triggered.connect(lambda: self.open_in_finder(directory))
        menu.addAction(open_action)
        
        menu.addSeparator()
        
        # Rename action
        rename_action = QAction("Rename", self)
        rename_action.triggered.connect(lambda: self.rename_favorite(directory))
        menu.addAction(rename_action)
        
        # Remove action
        remove_action = QAction("Remove from Favorites", self)
        remove_action.triggered.connect(lambda: self.remove_favorite(directory))
        menu.addAction(remove_action)
        
        menu.exec(self.favorites_list.mapToGlobal(position))
        
    def open_in_finder(self, directory: str):
        """Open directory in Finder"""
        import subprocess
        try:
            subprocess.run(["open", directory])
        except Exception as e:
            show_warning(self, "Error", f"Could not open directory: {e}")
            
    def _create_display_name(self, directory: str) -> str:
        """Create a descriptive display name for a directory"""
        path_obj = Path(directory)
        
        # If it's in the user's home directory, show a relative path
        try:
            relative_path = path_obj.relative_to(Path.home())
            if len(str(relative_path).split('/')) <= 2:
                # For shallow paths, show the full relative path
                return f"📁 {relative_path}"
            else:
                # For deeper paths, show parent/name
                parts = str(relative_path).split('/')
                if len(parts) >= 2:
                    return f"📁 {parts[-2]}/{parts[-1]}"
                else:
                    return f"📁 {path_obj.name}"
        except ValueError:
            # If not in home directory, show parent/name
            try:
                return f"📁 {path_obj.parent.name}/{path_obj.name}"
            except:
                return f"📁 {path_obj.name}"
    
    def on_favorite_double_clicked(self, item):
        """Handle double-click on favorite item"""
        directory = item.data(Qt.ItemDataRole.UserRole)
        self.favorite_selected.emit(directory) 