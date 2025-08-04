"""
Welcome dialog for KO Trimmer
"""

import os
from pathlib import Path
from typing import List, Dict, Optional

from PyQt6.QtWidgets import (
    QDialog, QVBoxLayout, QHBoxLayout, QLabel, QPushButton,
    QListWidget, QListWidgetItem, QFileDialog, QMessageBox,
    QGroupBox, QTextEdit, QCheckBox
)
from PyQt6.QtCore import Qt, pyqtSignal
from PyQt6.QtGui import QIcon, QPixmap

from ..utils.icon_manager import show_information
from .ui_utils import UIUtils


class WelcomeDialog(QDialog):
    """Welcome dialog shown on first launch"""
    
    favorites_selected = pyqtSignal(list)  # Emits list of favorite paths
    
    def __init__(self, parent=None):
        super().__init__(parent)
        self.favorites = []
        self.init_ui()
        
    def init_ui(self):
        """Initialize the welcome dialog UI"""
        self.setWindowTitle("Welcome to KO Trimmer! 🥊")
        self.setMinimumSize(600, 500)
        self.setModal(True)
        
        # Set window icon
        icon_path = Path(__file__).parent / "images" / "Knockout.png"
        if icon_path.exists():
            self.setWindowIcon(QIcon(str(icon_path)))
        
        layout = QVBoxLayout(self)
        
        # Welcome header
        header_layout = QHBoxLayout()
        
        # App icon
        if icon_path.exists():
            icon_label = QLabel()
            pixmap = QPixmap(str(icon_path))
            icon_label.setPixmap(pixmap.scaled(64, 64, Qt.AspectRatioMode.KeepAspectRatio))
            header_layout.addWidget(icon_label)
        
        # Welcome text
        welcome_text = UIUtils.create_styled_label("Welcome to KO Trimmer!", 24, True, "#2c3e50")
        header_layout.addWidget(welcome_text)
        header_layout.addStretch()
        
        layout.addLayout(header_layout)
        
        # Description
        description = UIUtils.create_styled_label(
            "KO Trimmer helps you optimize audio samples for the Teenage Engineering KO II sampler "
            "by automatically trimming silence from your audio files. This maximizes the limited "
            "64MB memory capacity of the KO II.\n\n"
            "Let's set up your favorite directories for quick access!",
            14, False, "#34495e"
        )
        description.setWordWrap(True)
        description.setStyleSheet("font-size: 14px; color: #34495e; margin: 10px;")
        layout.addWidget(description)
        
        # Favorites section
        favorites_group = UIUtils.create_group_box("Favorite Directories")
        favorites_layout = QVBoxLayout(favorites_group)
        
        # Favorites list
        self.favorites_list = QListWidget()
        self.favorites_list.setMaximumHeight(200)
        favorites_layout.addWidget(self.favorites_list)
        
        # Favorites buttons
        favorites_buttons_layout = QHBoxLayout()
        
        self.add_favorite_btn = UIUtils.create_styled_button("Add Directory")
        self.add_favorite_btn.clicked.connect(self.add_favorite_directory)
        favorites_buttons_layout.addWidget(self.add_favorite_btn)
        
        self.remove_favorite_btn = UIUtils.create_styled_button("Remove Selected")
        self.remove_favorite_btn.clicked.connect(self.remove_favorite_directory)
        favorites_buttons_layout.addWidget(self.remove_favorite_btn)
        
        favorites_layout.addLayout(favorites_buttons_layout)
        layout.addWidget(favorites_group)
        
        # Quick start section
        quick_start_group = UIUtils.create_group_box("Quick Start")
        quick_start_layout = QVBoxLayout(quick_start_group)
        
        quick_start_text = QTextEdit()
        quick_start_text.setMaximumHeight(120)
        quick_start_text.setReadOnly(True)
        quick_start_text.setHtml("""
        <h4>How to use KO Trimmer:</h4>
        <ol>
        <li><b>Drag & Drop:</b> Drag audio files or folders into the main window</li>
        <li><b>Adjust Settings:</b> Fine-tune silence detection parameters</li>
        <li><b>Process:</b> Click "Process Files" to trim silence</li>
        <li><b>Preview:</b> Right-click files to compare original vs trimmed audio</li>
        <li><b>Export:</b> Choose to overwrite or save to new directory</li>
        </ol>
        """)
        quick_start_layout.addWidget(quick_start_text)
        layout.addWidget(quick_start_group)
        
        # Options
        options_layout = QHBoxLayout()
        
        self.show_welcome_check = QCheckBox("Show welcome screen on startup")
        self.show_welcome_check.setChecked(True)
        options_layout.addWidget(self.show_welcome_check)
        
        options_layout.addStretch()
        
        # Action buttons
        action_layout = QHBoxLayout()
        
        self.skip_btn = UIUtils.create_styled_button("Skip for Now")
        self.skip_btn.clicked.connect(self.skip_setup)
        action_layout.addWidget(self.skip_btn)
        
        action_layout.addStretch()
        
        self.get_started_btn = UIUtils.create_styled_button("Get Started!", primary=True)
        self.get_started_btn.clicked.connect(self.accept)
        action_layout.addWidget(self.get_started_btn)
        
        layout.addLayout(options_layout)
        layout.addLayout(action_layout)
        
    def add_favorite_directory(self):
        """Add a favorite directory"""
        directory = QFileDialog.getExistingDirectory(
            self,
            "Select Favorite Directory",
            str(Path.home()),
            QFileDialog.Option.ShowDirsOnly
        )
        
        if directory:
            # Check if directory already exists
            for i in range(self.favorites_list.count()):
                if self.favorites_list.item(i).data(Qt.ItemDataRole.UserRole) == directory:
                    show_information(self, "Already Added", "This directory is already in your favorites!")
                    return
            
            # Add to list
            item = QListWidgetItem()
            display_name = UIUtils.create_display_name(directory)
            item.setText(display_name)
            item.setToolTip(directory)
            item.setData(Qt.ItemDataRole.UserRole, directory)
            self.favorites_list.addItem(item)
            self.favorites.append({"path": directory, "display_name": ""})
    
    def remove_favorite_directory(self):
        """Remove selected favorite directory"""
        current_item = self.favorites_list.currentItem()
        if current_item:
            directory = current_item.data(Qt.ItemDataRole.UserRole)
            self.favorites = [f for f in self.favorites if f["path"] != directory]
            self.favorites_list.takeItem(self.favorites_list.row(current_item))
    
    def skip_setup(self):
        """Skip the welcome setup"""
        self.favorites = []  # Empty list of dicts
        self.accept()
    
    def get_favorites(self) -> List[Dict[str, str]]:
        """Get the list of favorite directories with display names"""
        return self.favorites.copy()
    
    def set_favorites(self, favorites: List[Dict[str, str]]):
        """Set the list of favorite directories with display names"""
        self.favorites = favorites.copy()
        self.refresh_favorites_list()
    
    def refresh_favorites_list(self):
        """Refresh the favorites list display"""
        self.favorites_list.clear()
        for favorite in self.favorites:
            path = favorite.get("path", "")
            if os.path.exists(path):
                item = QListWidgetItem()
                # Use custom display name if available, otherwise generate one
                display_name = favorite.get("display_name", "")
                if not display_name:
                    display_name = UIUtils.create_display_name(path)
                item.setText(display_name)
                item.setToolTip(path)
                item.setData(Qt.ItemDataRole.UserRole, path)
                self.favorites_list.addItem(item)
    
    def should_show_welcome(self) -> bool:
        """Check if welcome screen should be shown on startup"""
        return self.show_welcome_check.isChecked() 