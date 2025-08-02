"""
Audio preview dialog for comparing original and trimmed audio files
"""

import os
from pathlib import Path
from typing import Optional

from PyQt6.QtWidgets import (
    QDialog, QVBoxLayout, QHBoxLayout, QPushButton, QLabel, 
    QProgressBar, QGroupBox, QGridLayout, QSlider, QWidget
)
from PyQt6.QtCore import Qt, QTimer, pyqtSignal
from PyQt6.QtMultimedia import QMediaPlayer, QAudioOutput
from PyQt6.QtCore import QUrl

from utils.icon_manager import set_dialog_icon


class AudioPreviewWidget(QWidget):
    """Embedded widget for previewing original vs trimmed audio files"""
    
    # Signal emitted when preview is closed
    preview_closed = pyqtSignal()
    
    def __init__(self, parent=None):
        super().__init__(parent)
        self.original_file = None
        self.trimmed_file = None
        
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
        self.connect_signals()
        
    def init_ui(self):
        """Initialize the user interface"""
        layout = QVBoxLayout(self)
        layout.setContentsMargins(10, 10, 10, 10)
        
        # File info section
        info_group = QGroupBox("Audio Preview")
        info_layout = QGridLayout(info_group)
        
        # Original file info
        self.original_file_label = QLabel("Original File: None")
        self.trimmed_file_label = QLabel("Trimmed File: None")
        self.original_size_label = QLabel("Original Size: --")
        self.trimmed_size_label = QLabel("Trimmed Size: --")
        self.reduction_label = QLabel("Reduction: --")
        
        info_layout.addWidget(self.original_file_label, 0, 0)
        info_layout.addWidget(self.original_size_label, 0, 1)
        info_layout.addWidget(self.trimmed_file_label, 1, 0)
        info_layout.addWidget(self.trimmed_size_label, 1, 1)
        info_layout.addWidget(self.reduction_label, 2, 0, 1, 2)
        
        layout.addWidget(info_group)
        
        # Audio controls section
        controls_group = QGroupBox("Playback Controls")
        controls_layout = QVBoxLayout(controls_group)
        
        # Original audio controls
        original_layout = QHBoxLayout()
        original_layout.addWidget(QLabel("Original:"))
        
        self.play_original_btn = QPushButton("Play")
        self.play_original_btn.clicked.connect(self.play_original)
        original_layout.addWidget(self.play_original_btn)
        
        self.pause_original_btn = QPushButton("Pause")
        self.pause_original_btn.clicked.connect(self.pause_original)
        original_layout.addWidget(self.pause_original_btn)
        
        self.stop_original_btn = QPushButton("Stop")
        self.stop_original_btn.clicked.connect(self.stop_original)
        original_layout.addWidget(self.stop_original_btn)
        
        self.restart_original_btn = QPushButton("Restart")
        self.restart_original_btn.clicked.connect(self.restart_original)
        original_layout.addWidget(self.restart_original_btn)
        
        self.original_duration_label = QLabel("Duration: --:--")
        original_layout.addWidget(self.original_duration_label)
        
        controls_layout.addLayout(original_layout)
        
        # Trimmed audio controls
        trimmed_layout = QHBoxLayout()
        trimmed_layout.addWidget(QLabel("Trimmed:"))
        
        self.play_trimmed_btn = QPushButton("Play")
        self.play_trimmed_btn.clicked.connect(self.play_trimmed)
        trimmed_layout.addWidget(self.play_trimmed_btn)
        
        self.pause_trimmed_btn = QPushButton("Pause")
        self.pause_trimmed_btn.clicked.connect(self.pause_trimmed)
        trimmed_layout.addWidget(self.pause_trimmed_btn)
        
        self.stop_trimmed_btn = QPushButton("Stop")
        self.stop_trimmed_btn.clicked.connect(self.stop_trimmed)
        trimmed_layout.addWidget(self.stop_trimmed_btn)
        
        self.restart_trimmed_btn = QPushButton("Restart")
        self.restart_trimmed_btn.clicked.connect(self.restart_trimmed)
        trimmed_layout.addWidget(self.restart_trimmed_btn)
        
        self.trimmed_duration_label = QLabel("Duration: --:--")
        trimmed_layout.addWidget(self.trimmed_duration_label)
        
        controls_layout.addLayout(trimmed_layout)
        
        # Progress bars
        progress_layout = QVBoxLayout()
        
        self.original_progress = QProgressBar()
        self.original_progress.setRange(0, 100)
        self.original_progress.setValue(0)
        progress_layout.addWidget(QLabel("Original Progress:"))
        progress_layout.addWidget(self.original_progress)
        
        self.trimmed_progress = QProgressBar()
        self.trimmed_progress.setRange(0, 100)
        self.trimmed_progress.setValue(0)
        progress_layout.addWidget(QLabel("Trimmed Progress:"))
        progress_layout.addWidget(self.trimmed_progress)
        
        controls_layout.addLayout(progress_layout)
        
        # Close button
        self.close_btn = QPushButton("Close Preview")
        self.close_btn.clicked.connect(self.close_preview)
        controls_layout.addWidget(self.close_btn)
        
        layout.addWidget(controls_group)
        
        # Initially hide the widget
        self.hide()
        
    def connect_signals(self):
        """Connect all the signals"""
        # Connect playback state changes (these are more reliable)
        self.original_player.playbackStateChanged.connect(self.on_original_playback_state_changed)
        self.trimmed_player.playbackStateChanged.connect(self.on_trimmed_playback_state_changed)
        
        # Try to connect media status changes (may not be available in all PyQt6 versions)
        try:
            self.original_player.mediaStatusChanged.connect(self.on_original_status_changed)
            self.trimmed_player.mediaStatusChanged.connect(self.on_trimmed_status_changed)
        except AttributeError:
            # If mediaStatusChanged is not available, skip it
            pass
        
    def load_files(self, original_file: str, trimmed_file: str):
        """Load audio files for preview"""
        self.original_file = original_file
        self.trimmed_file = trimmed_file
        
        # Update file info
        original_path = Path(original_file)
        trimmed_path = Path(trimmed_file)
        
        self.original_file_label.setText(f"Original File: {original_path.name}")
        self.trimmed_file_label.setText(f"Trimmed File: {trimmed_path.name}")
        
        # File sizes with more detailed information
        if original_path.exists():
            original_size = original_path.stat().st_size
            self.original_size_label.setText(f"Original Size: {original_size:,} bytes")
            
            # Get original file duration for context
            try:
                import librosa
                original_duration, sample_rate = librosa.load(str(original_path), sr=None, mono=False)
                
                # Show total duration for original file (including silence)
                if len(original_duration.shape) == 2:
                    total_duration = original_duration.shape[1] / sample_rate
                else:
                    total_duration = len(original_duration) / sample_rate
                
                self.original_size_label.setText(f"Original Size: {original_size:,} bytes ({total_duration:.2f}s total)")
            except Exception as e:
                print(f"Error loading original file duration: {e}")
                self.original_size_label.setText(f"Original Size: {original_size:,} bytes")
        
        if trimmed_path.exists():
            trimmed_size = trimmed_path.stat().st_size
            self.trimmed_size_label.setText(f"Trimmed Size: {trimmed_size:,} bytes")
            
            # Get trimmed file duration - the trimmed file IS the content duration
            try:
                import librosa
                trimmed_duration, sample_rate = librosa.load(str(trimmed_path), sr=None, mono=False)
                
                # Calculate the actual duration of the trimmed file
                if len(trimmed_duration.shape) == 2:
                    # Stereo: shape is (channels, samples)
                    content_duration = trimmed_duration.shape[1] / sample_rate
                else:
                    # Mono: shape is (samples,)
                    content_duration = len(trimmed_duration) / sample_rate
                
                self.trimmed_size_label.setText(f"Trimmed Size: {trimmed_size:,} bytes ({content_duration:.2f}s content)")
            except Exception as e:
                print(f"Error loading trimmed file duration: {e}")
                self.trimmed_size_label.setText(f"Trimmed Size: {trimmed_size:,} bytes")
            
            if original_path.exists():
                reduction = (1 - trimmed_size / original_size) * 100
                if reduction > 0.1:  # Only show reduction if it's significant
                    self.reduction_label.setText(f"Reduction: {reduction:.1f}%")
                elif reduction < -0.1:  # Show if file got larger
                    self.reduction_label.setText(f"Increase: {abs(reduction):.1f}%")
                else:
                    # Check if files are identical (no trimming occurred)
                    if abs(reduction) < 0.01:  # Less than 0.01% difference
                        self.reduction_label.setText("No trimming needed (no silence detected)")
                        # When no trimming occurred, show same duration type for both
                        try:
                            import librosa
                            original_duration, sample_rate = librosa.load(str(original_path), sr=None, mono=False)
                            if len(original_duration.shape) == 2:
                                total_duration = original_duration.shape[1] / sample_rate
                            else:
                                total_duration = len(original_duration) / sample_rate
                            
                            # Update both labels to show total duration when no trimming occurred
                            self.original_size_label.setText(f"Original Size: {original_size:,} bytes ({total_duration:.2f}s total)")
                            self.trimmed_size_label.setText(f"Trimmed Size: {trimmed_size:,} bytes ({total_duration:.2f}s total)")
                        except Exception as e:
                            print(f"Error updating duration labels: {e}")
                    else:
                        self.reduction_label.setText(f"No significant change ({reduction:.1f}%)")
        
        # Load audio files
        self.original_player.setSource(QUrl.fromLocalFile(original_file))
        self.trimmed_player.setSource(QUrl.fromLocalFile(trimmed_file))
        
        print(f"Loaded original file: {original_file}")
        print(f"Loaded trimmed file: {trimmed_file}")
        
    def reset_players(self):
        """Reset both players to beginning"""
        self.original_player.setPosition(0)
        self.trimmed_player.setPosition(0)
        self.original_progress.setValue(0)
        self.trimmed_progress.setValue(0)
        
    def play_original(self):
        """Play the original audio"""
        self.trimmed_player.stop()
        self.original_player.play()
        
    def pause_original(self):
        """Pause the original audio"""
        self.original_player.pause()
        
    def stop_original(self):
        """Stop the original audio"""
        self.original_player.stop()
        self.original_progress.setValue(0)
        
    def restart_original(self):
        """Restart the original audio"""
        self.original_player.setPosition(0)
        self.original_player.play()
        
    def play_trimmed(self):
        """Play the trimmed audio"""
        self.original_player.stop()
        self.trimmed_player.play()
        
    def pause_trimmed(self):
        """Pause the trimmed audio"""
        self.trimmed_player.pause()
        
    def stop_trimmed(self):
        """Stop the trimmed audio"""
        self.trimmed_player.stop()
        self.trimmed_progress.setValue(0)
        
    def restart_trimmed(self):
        """Restart the trimmed audio"""
        self.trimmed_player.setPosition(0)
        self.trimmed_player.play()
        
    def update_progress(self):
        """Update progress bars"""
        if self.original_player.isAvailable():
            duration = self.original_player.duration()
            if duration > 0:
                position = self.original_player.position()
                progress = int((position / duration) * 100)
                self.original_progress.setValue(progress)
                
                # Update duration label
                minutes = position // 60000
                seconds = (position % 60000) // 1000
                self.original_duration_label.setText(f"Duration: {minutes:02d}:{seconds:02d}")
        
        if self.trimmed_player.isAvailable():
            duration = self.trimmed_player.duration()
            if duration > 0:
                position = self.trimmed_player.position()
                progress = int((position / duration) * 100)
                self.trimmed_progress.setValue(progress)
                
                # Update duration label
                minutes = position // 60000
                seconds = (position % 60000) // 1000
                self.trimmed_duration_label.setText(f"Duration: {minutes:02d}:{seconds:02d}")
                
    def on_original_status_changed(self, status):
        """Handle original player status changes"""
        if status == QMediaPlayer.MediaStatus.LoadedMedia:
            print("Original file loaded successfully")
        elif status == QMediaPlayer.MediaStatus.InvalidMedia:
            print("Failed to load original file")
            
    def on_trimmed_status_changed(self, status):
        """Handle trimmed player status changes"""
        if status == QMediaPlayer.MediaStatus.LoadedMedia:
            print("Trimmed file loaded successfully")
        elif status == QMediaPlayer.MediaStatus.InvalidMedia:
            print("Failed to load trimmed file")
            
    def on_original_playback_state_changed(self, state):
        """Handle original player playback state changes"""
        if state == QMediaPlayer.PlaybackState.PlayingState:
            self.play_original_btn.setEnabled(False)
            self.pause_original_btn.setEnabled(True)
            self.stop_original_btn.setEnabled(True)
        else:
            self.play_original_btn.setEnabled(True)
            self.pause_original_btn.setEnabled(False)
            self.stop_original_btn.setEnabled(False)
            
    def on_trimmed_playback_state_changed(self, state):
        """Handle trimmed player playback state changes"""
        if state == QMediaPlayer.PlaybackState.PlayingState:
            self.play_trimmed_btn.setEnabled(False)
            self.pause_trimmed_btn.setEnabled(True)
            self.stop_trimmed_btn.setEnabled(True)
        else:
            self.play_trimmed_btn.setEnabled(True)
            self.pause_trimmed_btn.setEnabled(False)
            self.stop_trimmed_btn.setEnabled(False)
            
    def close_preview(self):
        """Close the preview widget"""
        self.hide()
        # Emit signal to notify main window
        self.preview_closed.emit()
        
    def hideEvent(self, event):
        """Handle hide event - stop all playback"""
        self.original_player.stop()
        self.trimmed_player.stop()
        super().hideEvent(event)


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
        
        # Audio controls section
        controls_group = QGroupBox("Audio Controls")
        controls_layout = QVBoxLayout(controls_group)
        
        # Original audio controls
        original_layout = QHBoxLayout()
        original_layout.addWidget(QLabel("Original Audio:"))
        
        self.play_original_btn = QPushButton("Play")
        self.play_original_btn.clicked.connect(self.play_original)
        original_layout.addWidget(self.play_original_btn)
        
        self.pause_original_btn = QPushButton("Pause")
        self.pause_original_btn.clicked.connect(self.pause_original)
        original_layout.addWidget(self.pause_original_btn)
        
        self.stop_original_btn = QPushButton("Stop")
        self.stop_original_btn.clicked.connect(self.stop_original)
        original_layout.addWidget(self.stop_original_btn)
        
        self.restart_original_btn = QPushButton("Restart")
        self.restart_original_btn.clicked.connect(self.restart_original)
        original_layout.addWidget(self.restart_original_btn)
        
        self.original_duration_label = QLabel("Duration: --:--")
        original_layout.addWidget(self.original_duration_label)
        
        controls_layout.addLayout(original_layout)
        
        # Trimmed audio controls
        trimmed_layout = QHBoxLayout()
        trimmed_layout.addWidget(QLabel("Trimmed Audio:"))
        
        self.play_trimmed_btn = QPushButton("Play")
        self.play_trimmed_btn.clicked.connect(self.play_trimmed)
        trimmed_layout.addWidget(self.play_trimmed_btn)
        
        self.pause_trimmed_btn = QPushButton("Pause")
        self.pause_trimmed_btn.clicked.connect(self.pause_trimmed)
        trimmed_layout.addWidget(self.pause_trimmed_btn)
        
        self.stop_trimmed_btn = QPushButton("Stop")
        self.stop_trimmed_btn.clicked.connect(self.stop_trimmed)
        trimmed_layout.addWidget(self.stop_trimmed_btn)
        
        self.restart_trimmed_btn = QPushButton("Restart")
        self.restart_trimmed_btn.clicked.connect(self.restart_trimmed)
        trimmed_layout.addWidget(self.restart_trimmed_btn)
        
        self.trimmed_duration_label = QLabel("Duration: --:--")
        trimmed_layout.addWidget(self.trimmed_duration_label)
        
        controls_layout.addLayout(trimmed_layout)
        
        # Progress bars
        progress_layout = QVBoxLayout()
        
        self.original_progress = QProgressBar()
        self.original_progress.setRange(0, 100)
        self.original_progress.setValue(0)
        progress_layout.addWidget(QLabel("Original Progress:"))
        progress_layout.addWidget(self.original_progress)
        
        self.trimmed_progress = QProgressBar()
        self.trimmed_progress.setRange(0, 100)
        self.trimmed_progress.setValue(0)
        progress_layout.addWidget(QLabel("Trimmed Progress:"))
        progress_layout.addWidget(self.trimmed_progress)
        
        controls_layout.addLayout(progress_layout)
        
        layout.addWidget(controls_group)
        
        # Close button
        close_btn = QPushButton("Close")
        close_btn.clicked.connect(self.accept)
        layout.addWidget(close_btn)
        
        self.connect_signals()
        
    def connect_signals(self):
        """Connect all the signals"""
        # Connect playback state changes (these are more reliable)
        self.original_player.playbackStateChanged.connect(self.on_original_playback_state_changed)
        self.trimmed_player.playbackStateChanged.connect(self.on_trimmed_playback_state_changed)
        
        # Try to connect media status changes (may not be available in all PyQt6 versions)
        try:
            self.original_player.mediaStatusChanged.connect(self.on_original_status_changed)
            self.trimmed_player.mediaStatusChanged.connect(self.on_trimmed_status_changed)
        except AttributeError:
            # If mediaStatusChanged is not available, skip it
            pass
        
    def load_files(self):
        """Load the audio files"""
        self.original_player.setSource(QUrl.fromLocalFile(self.original_file))
        self.trimmed_player.setSource(QUrl.fromLocalFile(self.trimmed_file))
        
        print(f"Loaded original file: {self.original_file}")
        print(f"Loaded trimmed file: {self.trimmed_file}")
        
    def reset_players(self):
        """Reset both players to beginning"""
        self.original_player.setPosition(0)
        self.trimmed_player.setPosition(0)
        self.original_progress.setValue(0)
        self.trimmed_progress.setValue(0)
        
    def play_original(self):
        """Play the original audio"""
        self.trimmed_player.stop()
        self.original_player.play()
        
    def pause_original(self):
        """Pause the original audio"""
        self.original_player.pause()
        
    def stop_original(self):
        """Stop the original audio"""
        self.original_player.stop()
        self.original_progress.setValue(0)
        
    def restart_original(self):
        """Restart the original audio"""
        self.original_player.setPosition(0)
        self.original_player.play()
        
    def play_trimmed(self):
        """Play the trimmed audio"""
        self.original_player.stop()
        self.trimmed_player.play()
        
    def pause_trimmed(self):
        """Pause the trimmed audio"""
        self.trimmed_player.pause()
        
    def stop_trimmed(self):
        """Stop the trimmed audio"""
        self.trimmed_player.stop()
        self.trimmed_progress.setValue(0)
        
    def restart_trimmed(self):
        """Restart the trimmed audio"""
        self.trimmed_player.setPosition(0)
        self.trimmed_player.play()
        
    def update_progress(self):
        """Update progress bars"""
        if self.original_player.isAvailable():
            duration = self.original_player.duration()
            if duration > 0:
                position = self.original_player.position()
                progress = int((position / duration) * 100)
                self.original_progress.setValue(progress)
                
                # Update duration label
                minutes = position // 60000
                seconds = (position % 60000) // 1000
                self.original_duration_label.setText(f"Duration: {minutes:02d}:{seconds:02d}")
        
        if self.trimmed_player.isAvailable():
            duration = self.trimmed_player.duration()
            if duration > 0:
                position = self.trimmed_player.position()
                progress = int((position / duration) * 100)
                self.trimmed_progress.setValue(progress)
                
                # Update duration label
                minutes = position // 60000
                seconds = (position % 60000) // 1000
                self.trimmed_duration_label.setText(f"Duration: {minutes:02d}:{seconds:02d}")
                
    def on_original_status_changed(self, status):
        """Handle original player status changes"""
        if status == QMediaPlayer.MediaStatus.LoadedMedia:
            print("Original file loaded successfully")
        elif status == QMediaPlayer.MediaStatus.InvalidMedia:
            print("Failed to load original file")
            
    def on_trimmed_status_changed(self, status):
        """Handle trimmed player status changes"""
        if status == QMediaPlayer.MediaStatus.LoadedMedia:
            print("Trimmed file loaded successfully")
        elif status == QMediaPlayer.MediaStatus.InvalidMedia:
            print("Failed to load trimmed file")
            
    def on_original_playback_state_changed(self, state):
        """Handle original player playback state changes"""
        if state == QMediaPlayer.PlaybackState.PlayingState:
            self.play_original_btn.setEnabled(False)
            self.pause_original_btn.setEnabled(True)
            self.stop_original_btn.setEnabled(True)
        else:
            self.play_original_btn.setEnabled(True)
            self.pause_original_btn.setEnabled(False)
            self.stop_original_btn.setEnabled(False)
            
    def on_trimmed_playback_state_changed(self, state):
        """Handle trimmed player playback state changes"""
        if state == QMediaPlayer.PlaybackState.PlayingState:
            self.play_trimmed_btn.setEnabled(False)
            self.pause_trimmed_btn.setEnabled(True)
            self.stop_trimmed_btn.setEnabled(True)
        else:
            self.play_trimmed_btn.setEnabled(True)
            self.pause_trimmed_btn.setEnabled(False)
            self.stop_trimmed_btn.setEnabled(False)
            
    def closeEvent(self, event):
        """Handle close event - stop all playback"""
        self.original_player.stop()
        self.trimmed_player.stop()
        super().closeEvent(event) 