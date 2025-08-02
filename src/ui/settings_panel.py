"""
Settings panel component for KO Trimmer
"""

from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QGroupBox,
    QSpinBox, QDoubleSpinBox, QCheckBox, QPushButton, QLineEdit
)
from PyQt6.QtCore import Qt, pyqtSignal
from PyQt6.QtGui import QMouseEvent

from .ui_utils import UIUtils


class SettingsPanel(QWidget):
    """Settings panel for audio processing configuration"""
    
    settings_changed = pyqtSignal()  # Emitted when settings change
    
    def __init__(self):
        super().__init__()
        self.custom_output_directory = None
        self.init_ui()
        
    def init_ui(self):
        """Initialize the settings panel UI"""
        layout = QVBoxLayout(self)
        
        # Settings group
        settings_group = UIUtils.create_group_box("Silence Detection Settings")
        settings_layout = QVBoxLayout(settings_group)
        
        # Silence threshold
        threshold_layout = QHBoxLayout()
        threshold_layout.addWidget(QLabel("Silence Threshold (dB):"))
        self.threshold_spin = QDoubleSpinBox()
        self.threshold_spin.setRange(-60, 0)
        self.threshold_spin.setValue(-50)  # More forgiving for natural decay
        self.threshold_spin.setSuffix(" dB")
        self.threshold_spin.valueChanged.connect(self.on_settings_changed)
        threshold_layout.addWidget(self.threshold_spin)
        settings_layout.addLayout(threshold_layout)
        
        # Minimum silence duration
        duration_layout = QHBoxLayout()
        duration_layout.addWidget(QLabel("Min Silence Duration (ms):"))
        self.duration_spin = QSpinBox()
        self.duration_spin.setRange(100, 10000)
        self.duration_spin.setValue(1000)  # Longer duration to avoid cutting natural decay
        self.duration_spin.setSuffix(" ms")
        self.duration_spin.valueChanged.connect(self.on_settings_changed)
        duration_layout.addWidget(self.duration_spin)
        settings_layout.addLayout(duration_layout)
        
        # Padding
        padding_layout = QHBoxLayout()
        padding_layout.addWidget(QLabel("Padding (ms):"))
        self.padding_spin = QSpinBox()
        self.padding_spin.setRange(0, 1000)
        self.padding_spin.setValue(20)  # Reduced padding for tighter trimming
        self.padding_spin.setSuffix(" ms")
        self.padding_spin.valueChanged.connect(self.on_settings_changed)
        padding_layout.addWidget(self.padding_spin)
        settings_layout.addLayout(padding_layout)
        
        # Options
        options_layout = QVBoxLayout()
        
        # Stereo preservation
        self.preserve_stereo_check = QCheckBox("Preserve Stereo")
        self.preserve_stereo_check.setChecked(True)
        self.preserve_stereo_check.stateChanged.connect(self.on_settings_changed)
        options_layout.addWidget(self.preserve_stereo_check)
        
        # Overwrite option
        self.overwrite_check = QCheckBox("Overwrite Original Files")
        self.overwrite_check.setChecked(False)
        self.overwrite_check.stateChanged.connect(self.on_overwrite_changed)
        options_layout.addWidget(self.overwrite_check)
        
        settings_layout.addLayout(options_layout)
        layout.addWidget(settings_group)
        
        # Output directory group
        output_group = UIUtils.create_group_box("Output Directory")
        output_layout = QVBoxLayout(output_group)
        
        # Output directory display
        self.output_dir_label = QLineEdit()
        self.output_dir_label.setReadOnly(True)
        self.output_dir_label.setPlaceholderText("Default: Create _trimmed folders")
        self.output_dir_label.mousePressEvent = self.on_output_dir_click
        output_layout.addWidget(self.output_dir_label)
        
        # Output directory buttons
        output_buttons_layout = QHBoxLayout()
        
        self.change_output_btn = UIUtils.create_styled_button("Change Output Dir")
        self.change_output_btn.clicked.connect(self.change_output_directory)
        output_buttons_layout.addWidget(self.change_output_btn)
        
        self.reset_output_btn = UIUtils.create_styled_button("Reset")
        self.reset_output_btn.clicked.connect(self.reset_output_directory)
        output_buttons_layout.addWidget(self.reset_output_btn)
        
        output_layout.addLayout(output_buttons_layout)
        layout.addWidget(output_group)
        
        # Processing controls
        controls_group = UIUtils.create_group_box("Processing Controls")
        controls_layout = QVBoxLayout(controls_group)
        
        # Process button
        self.process_btn = UIUtils.create_styled_button("Process Files", primary=True)
        self.process_btn.setEnabled(False)
        controls_layout.addWidget(self.process_btn)
        
        # Stop button
        self.stop_btn = UIUtils.create_styled_button("Stop Processing")
        self.stop_btn.setEnabled(False)
        controls_layout.addWidget(self.stop_btn)
        
        layout.addWidget(controls_group)
        
        # Progress widget
        from .progress import ProcessingProgressWidget
        self.progress_widget = ProcessingProgressWidget()
        layout.addWidget(self.progress_widget)
        
        # Update output directory display
        self.update_output_directory_display()
        
    def get_settings(self) -> dict:
        """Get current processing settings"""
        return {
            'threshold': self.threshold_spin.value(),
            'min_duration': self.duration_spin.value(),
            'padding': self.padding_spin.value(),
            'preserve_stereo': self.preserve_stereo_check.isChecked(),
            'overwrite': self.overwrite_check.isChecked(),
            'custom_output_dir': self.custom_output_directory
        }
        
    def set_settings(self, settings: dict):
        """Set processing settings"""
        self.threshold_spin.setValue(settings.get('threshold', -50))
        self.duration_spin.setValue(settings.get('min_duration', 1000))
        self.padding_spin.setValue(settings.get('padding', 20))
        self.preserve_stereo_check.setChecked(settings.get('preserve_stereo', True))
        self.overwrite_check.setChecked(settings.get('overwrite', False))
        self.custom_output_directory = settings.get('custom_output_dir')
        self.update_output_directory_display()
        
    def on_settings_changed(self):
        """Handle settings changes"""
        self.settings_changed.emit()
        
    def on_overwrite_changed(self, checked: bool):
        """Handle overwrite checkbox changes"""
        self.on_settings_changed()
        
    def on_output_dir_click(self, event: QMouseEvent):
        """Handle output directory label click"""
        self.change_output_directory()
        
    def change_output_directory(self):
        """Change the custom output directory"""
        from PyQt6.QtWidgets import QFileDialog
        from pathlib import Path
        
        directory = QFileDialog.getExistingDirectory(
            self,
            "Select Custom Output Directory",
            str(Path.home()),
            QFileDialog.Option.ShowDirsOnly
        )
        
        if directory:
            self.custom_output_directory = directory
            self.update_output_directory_display()
            self.on_settings_changed()
            
    def reset_output_directory(self):
        """Reset to default output directory behavior"""
        self.custom_output_directory = None
        self.update_output_directory_display()
        self.on_settings_changed()
        
    def update_output_directory_display(self):
        """Update the output directory display"""
        if self.custom_output_directory:
            self.output_dir_label.setText(self.custom_output_directory)
        else:
            self.output_dir_label.setText("Default: Create _trimmed folders")
            
    def set_process_button_enabled(self, enabled: bool):
        """Enable or disable the process button"""
        self.process_btn.setEnabled(enabled)
        
    def set_stop_button_enabled(self, enabled: bool):
        """Enable or disable the stop button"""
        self.stop_btn.setEnabled(enabled) 