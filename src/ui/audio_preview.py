"""
Audio preview dialog for comparing original and trimmed audio files
"""

import os
from pathlib import Path
from typing import Optional

from PyQt6.QtWidgets import (
    QDialog, QVBoxLayout, QHBoxLayout, QPushButton, QLabel, 
    QProgressBar, QGroupBox, QGridLayout, QSlider
)
from PyQt6.QtCore import Qt, QTimer, pyqtSignal
from PyQt6.QtMultimedia import QMediaPlayer, QAudioOutput
from PyQt6.QtCore import QUrl

from utils.icon_manager import set_dialog_icon


class AudioPreviewDialog(QDialog):
    """Dialog for previewing original vs trimmed audio files"""
    
    def __init__(self, original_file: str, trimmed_file: str, parent=None):
        super().__init__(parent)
        self.original_file = original_file
        self.trimmed_file = trimmed_file
        
        # Initialize media players
        self.original_player = QMediaPlayer()
        self.trimmed_player = QMediaPlayer()
        
        # Audio outputs
        self.original_audio_output = QAudioOutput()
        self.trimmed_audio_output = QAudioOutput()
        
        # Connect players to outputs
        self.original_player.setAudioOutput(self.original_audio_output)
        self.trimmed_player.setAudioOutput(self.trimmed_audio_output)
        
        # Set volume
        self.original_audio_output.setVolume(50)
        self.trimmed_audio_output.setVolume(50)
        
        # Timer for updating progress bars
        self.update_timer = QTimer()
        self.update_timer.timeout.connect(self.update_progress)
        self.update_timer.start(100)  # Update every 100ms
        
        self.init_ui()
        self.load_files()
        
    def showEvent(self, event):
        """Handle dialog show event"""
        super().showEvent(event)
        # Reload files when dialog is shown
        self.load_files()
        
    def reload_files(self):
        """Force reload the audio files"""
        self.load_files()
        
    def init_ui(self):
        """Initialize the user interface"""
        self.setWindowTitle("Audio Preview - Original vs Trimmed")
        self.setMinimumSize(600, 400)
        
        # Set dialog icon
        set_dialog_icon(self)
        
        layout = QVBoxLayout(self)
        
        # File info section
        info_group = QGroupBox("File Information")
        info_layout = QGridLayout(info_group)
        
        # Original file info
        original_path = Path(self.original_file)
        trimmed_path = Path(self.trimmed_file)
        
        info_layout.addWidget(QLabel("Original File:"), 0, 0)
        info_layout.addWidget(QLabel(original_path.name), 0, 1)
        
        info_layout.addWidget(QLabel("Trimmed File:"), 1, 0)
        info_layout.addWidget(QLabel(trimmed_path.name), 1, 1)
        
        # File sizes
        if original_path.exists():
            original_size = original_path.stat().st_size
            info_layout.addWidget(QLabel(f"Original Size: {original_size:,} bytes"), 0, 2)
        
        if trimmed_path.exists():
            trimmed_size = trimmed_path.stat().st_size
            info_layout.addWidget(QLabel(f"Trimmed Size: {trimmed_size:,} bytes"), 1, 2)
            
            if original_path.exists():
                reduction = (1 - trimmed_size / original_size) * 100
                info_layout.addWidget(QLabel(f"Reduction: {reduction:.1f}%"), 2, 2)
        
        layout.addWidget(info_group)
        
        # Original audio controls
        original_group = QGroupBox("Original Audio")
        original_layout = QVBoxLayout(original_group)
        
        # Original controls
        original_controls = QHBoxLayout()
        self.original_play_btn = QPushButton("▶ Play")
        self.original_pause_btn = QPushButton("⏸ Pause")
        self.original_stop_btn = QPushButton("⏹ Stop")
        self.original_restart_btn = QPushButton("🔄 Restart")
        
        original_controls.addWidget(self.original_play_btn)
        original_controls.addWidget(self.original_pause_btn)
        original_controls.addWidget(self.original_stop_btn)
        original_controls.addWidget(self.original_restart_btn)
        original_controls.addStretch()
        
        # Original progress
        self.original_progress = QProgressBar()
        self.original_progress.setRange(0, 100)
        self.original_progress.setValue(0)
        
        # Original duration label
        self.original_duration_label = QLabel("Duration: --:--")
        
        original_layout.addLayout(original_controls)
        original_layout.addWidget(self.original_progress)
        original_layout.addWidget(self.original_duration_label)
        
        layout.addWidget(original_group)
        
        # Trimmed audio controls
        trimmed_group = QGroupBox("Trimmed Audio")
        trimmed_layout = QVBoxLayout(trimmed_group)
        
        # Trimmed controls
        trimmed_controls = QHBoxLayout()
        self.trimmed_play_btn = QPushButton("▶ Play")
        self.trimmed_pause_btn = QPushButton("⏸ Pause")
        self.trimmed_stop_btn = QPushButton("⏹ Stop")
        self.trimmed_restart_btn = QPushButton("🔄 Restart")
        
        trimmed_controls.addWidget(self.trimmed_play_btn)
        trimmed_controls.addWidget(self.trimmed_pause_btn)
        trimmed_controls.addWidget(self.trimmed_stop_btn)
        trimmed_controls.addWidget(self.trimmed_restart_btn)
        trimmed_controls.addStretch()
        
        # Trimmed progress
        self.trimmed_progress = QProgressBar()
        self.trimmed_progress.setRange(0, 100)
        self.trimmed_progress.setValue(0)
        
        # Trimmed duration label
        self.trimmed_duration_label = QLabel("Duration: --:--")
        
        trimmed_layout.addLayout(trimmed_controls)
        trimmed_layout.addWidget(self.trimmed_progress)
        trimmed_layout.addWidget(self.trimmed_duration_label)
        
        layout.addWidget(trimmed_group)
        
        # Close button
        close_btn = QPushButton("Close")
        close_btn.clicked.connect(self.close)
        layout.addWidget(close_btn)
        
        # Connect signals
        self.connect_signals()
        
    def connect_signals(self):
        """Connect button signals to slots"""
        # Original controls
        self.original_play_btn.clicked.connect(self.play_original)
        self.original_pause_btn.clicked.connect(self.pause_original)
        self.original_stop_btn.clicked.connect(self.stop_original)
        self.original_restart_btn.clicked.connect(self.restart_original)
        
        # Trimmed controls
        self.trimmed_play_btn.clicked.connect(self.play_trimmed)
        self.trimmed_pause_btn.clicked.connect(self.pause_trimmed)
        self.trimmed_stop_btn.clicked.connect(self.stop_trimmed)
        self.trimmed_restart_btn.clicked.connect(self.restart_trimmed)
        
        # Player state changes
        self.original_player.mediaStatusChanged.connect(self.on_original_status_changed)
        self.trimmed_player.mediaStatusChanged.connect(self.on_trimmed_status_changed)
        
        # Playback state changes
        self.original_player.playbackStateChanged.connect(self.on_original_playback_state_changed)
        self.trimmed_player.playbackStateChanged.connect(self.on_trimmed_playback_state_changed)
        
    def load_files(self):
        """Load the audio files into the players"""
        try:
            # Reset players first
            self.reset_players()
            
            # Load original file
            if os.path.exists(self.original_file):
                self.original_player.setSource(QUrl.fromLocalFile(self.original_file))
                print(f"Loaded original file: {self.original_file}")
            else:
                print(f"Original file not found: {self.original_file}")
                
            # Load trimmed file
            if os.path.exists(self.trimmed_file):
                self.trimmed_player.setSource(QUrl.fromLocalFile(self.trimmed_file))
                print(f"Loaded trimmed file: {self.trimmed_file}")
            else:
                print(f"Trimmed file not found: {self.trimmed_file}")
                
        except Exception as e:
            print(f"Error loading audio files: {e}")
            
    def reset_players(self):
        """Reset both media players to initial state"""
        # Stop both players
        self.original_player.stop()
        self.trimmed_player.stop()
        
        # Reset progress bars
        self.original_progress.setValue(0)
        self.trimmed_progress.setValue(0)
        
        # Reset duration labels
        self.original_duration_label.setText("Duration: --:--")
        self.trimmed_duration_label.setText("Duration: --:--")
        
        # Reset button states
        self.original_play_btn.setEnabled(True)
        self.original_pause_btn.setEnabled(False)
        self.trimmed_play_btn.setEnabled(True)
        self.trimmed_pause_btn.setEnabled(False)
        
        # Clear sources
        self.original_player.setSource(QUrl())
        self.trimmed_player.setSource(QUrl())
            
    def play_original(self):
        """Play the original audio"""
        if self.original_player.mediaStatus() == QMediaPlayer.MediaStatus.LoadedMedia:
            # If we're at the end, reset to beginning
            if self.original_player.position() >= self.original_player.duration() - 100:  # Within 100ms of end
                self.original_player.setPosition(0)
            self.original_player.play()
        else:
            # If media is not loaded, try to reload
            self.load_files()
            
    def pause_original(self):
        """Pause the original audio"""
        self.original_player.pause()
        
    def stop_original(self):
        """Stop the original audio"""
        self.original_player.stop()
        self.original_progress.setValue(0)
        
    def restart_original(self):
        """Restart the original audio from the beginning"""
        self.original_player.setPosition(0)
        self.original_player.play()
        self.original_progress.setValue(0)
        
    def play_trimmed(self):
        """Play the trimmed audio"""
        if self.trimmed_player.mediaStatus() == QMediaPlayer.MediaStatus.LoadedMedia:
            # If we're at the end, reset to beginning
            if self.trimmed_player.position() >= self.trimmed_player.duration() - 100:  # Within 100ms of end
                self.trimmed_player.setPosition(0)
            self.trimmed_player.play()
        else:
            # If media is not loaded, try to reload
            self.load_files()
            
    def pause_trimmed(self):
        """Pause the trimmed audio"""
        self.trimmed_player.pause()
        
    def stop_trimmed(self):
        """Stop the trimmed audio"""
        self.trimmed_player.stop()
        self.trimmed_progress.setValue(0)
        
    def restart_trimmed(self):
        """Restart the trimmed audio from the beginning"""
        self.trimmed_player.setPosition(0)
        self.trimmed_player.play()
        self.trimmed_progress.setValue(0)
        
    def update_progress(self):
        """Update progress bars"""
        # Update original progress
        if self.original_player.isPlaying():
            position = self.original_player.position()
            duration = self.original_player.duration()
            if duration > 0:
                progress = int((position / duration) * 100)
                self.original_progress.setValue(progress)
                
                # Update duration label
                pos_sec = position // 1000
                dur_sec = duration // 1000
                self.original_duration_label.setText(f"Duration: {pos_sec//60:02d}:{pos_sec%60:02d} / {dur_sec//60:02d}:{dur_sec%60:02d}")
                
        # Update trimmed progress
        if self.trimmed_player.isPlaying():
            position = self.trimmed_player.position()
            duration = self.trimmed_player.duration()
            if duration > 0:
                progress = int((position / duration) * 100)
                self.trimmed_progress.setValue(progress)
                
                # Update duration label
                pos_sec = position // 1000
                dur_sec = duration // 1000
                self.trimmed_duration_label.setText(f"Duration: {pos_sec//60:02d}:{pos_sec%60:02d} / {dur_sec//60:02d}:{dur_sec%60:02d}")
                
    def on_original_status_changed(self, status):
        """Handle original player status changes"""
        if status == QMediaPlayer.MediaStatus.EndOfMedia:
            # Reset to beginning for replay
            self.original_player.setPosition(0)
            self.original_play_btn.setEnabled(True)
            self.original_pause_btn.setEnabled(False)
            self.original_progress.setValue(0)
            self.original_duration_label.setText("Duration: --:--")
        elif status == QMediaPlayer.MediaStatus.LoadedMedia:
            # Media loaded, enable play button
            self.original_play_btn.setEnabled(True)
            self.original_pause_btn.setEnabled(False)
        elif status == QMediaPlayer.MediaStatus.InvalidMedia:
            # Media failed to load, disable buttons
            self.original_play_btn.setEnabled(False)
            self.original_pause_btn.setEnabled(False)
            
    def on_trimmed_status_changed(self, status):
        """Handle trimmed player status changes"""
        if status == QMediaPlayer.MediaStatus.EndOfMedia:
            # Reset to beginning for replay
            self.trimmed_player.setPosition(0)
            self.trimmed_play_btn.setEnabled(True)
            self.trimmed_pause_btn.setEnabled(False)
            self.trimmed_progress.setValue(0)
            self.trimmed_duration_label.setText("Duration: --:--")
        elif status == QMediaPlayer.MediaStatus.LoadedMedia:
            # Media loaded, enable play button
            self.trimmed_play_btn.setEnabled(True)
            self.trimmed_pause_btn.setEnabled(False)
        elif status == QMediaPlayer.MediaStatus.InvalidMedia:
            # Media failed to load, disable buttons
            self.trimmed_play_btn.setEnabled(False)
            self.trimmed_pause_btn.setEnabled(False)
            
    def on_original_playback_state_changed(self, state):
        """Handle original player playback state changes"""
        if state == QMediaPlayer.PlaybackState.PlayingState:
            self.original_play_btn.setEnabled(False)
            self.original_pause_btn.setEnabled(True)
        elif state == QMediaPlayer.PlaybackState.PausedState:
            self.original_play_btn.setEnabled(True)
            self.original_pause_btn.setEnabled(False)
        elif state == QMediaPlayer.PlaybackState.StoppedState:
            self.original_play_btn.setEnabled(True)
            self.original_pause_btn.setEnabled(False)
            
    def on_trimmed_playback_state_changed(self, state):
        """Handle trimmed player playback state changes"""
        if state == QMediaPlayer.PlaybackState.PlayingState:
            self.trimmed_play_btn.setEnabled(False)
            self.trimmed_pause_btn.setEnabled(True)
        elif state == QMediaPlayer.PlaybackState.PausedState:
            self.trimmed_play_btn.setEnabled(True)
            self.trimmed_pause_btn.setEnabled(False)
        elif state == QMediaPlayer.PlaybackState.StoppedState:
            self.trimmed_play_btn.setEnabled(True)
            self.trimmed_pause_btn.setEnabled(False)
            
    def closeEvent(self, event):
        """Handle dialog close event"""
        # Stop all playback and reset
        self.reset_players()
        self.update_timer.stop()
        super().closeEvent(event) 