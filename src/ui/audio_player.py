"""
Audio player component for KO Trimmer
"""

from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QPushButton, QLabel, 
    QProgressBar, QSlider
)
from PyQt6.QtCore import Qt, QTimer, pyqtSignal
from PyQt6.QtMultimedia import QMediaPlayer, QAudioOutput
from PyQt6.QtCore import QUrl

from .ui_utils import UIUtils


class AudioPlayerWidget(QWidget):
    """Widget for playing a single audio file"""
    
    playback_state_changed = pyqtSignal(str)  # Emitted when playback state changes
    
    def __init__(self, title: str = "Audio Player"):
        super().__init__()
        self.title = title
        self.player = QMediaPlayer()
        self.audio_output = QAudioOutput()
        self.player.setAudioOutput(self.audio_output)
        self.audio_output.setVolume(50)
        
        # Timer for updating progress
        self.update_timer = QTimer()
        self.update_timer.timeout.connect(self.update_progress)
        self.update_timer.start(100)  # Update every 100ms
        
        self.init_ui()
        self.connect_signals()
        
    def init_ui(self):
        """Initialize the user interface"""
        layout = QVBoxLayout(self)
        
        # Title
        title_label = UIUtils.create_styled_label(self.title, 12, True)
        title_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        layout.addWidget(title_label)
        
        # Progress bar
        self.progress_bar = QProgressBar()
        self.progress_bar.setRange(0, 100)
        self.progress_bar.setValue(0)
        layout.addWidget(self.progress_bar)
        
        # Time labels
        time_layout = QHBoxLayout()
        self.current_time_label = QLabel("00:00")
        self.total_time_label = QLabel("00:00")
        time_layout.addWidget(self.current_time_label)
        time_layout.addStretch()
        time_layout.addWidget(self.total_time_label)
        layout.addLayout(time_layout)
        
        # Control buttons
        controls_layout = QHBoxLayout()
        
        self.play_btn = UIUtils.create_styled_button("Play")
        self.play_btn.clicked.connect(self.play)
        controls_layout.addWidget(self.play_btn)
        
        self.pause_btn = UIUtils.create_styled_button("Pause")
        self.pause_btn.clicked.connect(self.pause)
        controls_layout.addWidget(self.pause_btn)
        
        self.stop_btn = UIUtils.create_styled_button("Stop")
        self.stop_btn.clicked.connect(self.stop)
        controls_layout.addWidget(self.stop_btn)
        
        self.restart_btn = UIUtils.create_styled_button("Restart")
        self.restart_btn.clicked.connect(self.restart)
        controls_layout.addWidget(self.restart_btn)
        
        layout.addLayout(controls_layout)
        
        # Volume control
        volume_layout = QHBoxLayout()
        volume_layout.addWidget(QLabel("Volume:"))
        
        self.volume_slider = QSlider(Qt.Orientation.Horizontal)
        self.volume_slider.setRange(0, 100)
        self.volume_slider.setValue(50)
        self.volume_slider.valueChanged.connect(self.set_volume)
        volume_layout.addWidget(self.volume_slider)
        
        layout.addLayout(volume_layout)
        
    def connect_signals(self):
        """Connect player signals"""
        self.player.playbackStateChanged.connect(self.on_playback_state_changed)
        self.player.mediaStatusChanged.connect(self.on_media_status_changed)
        
    def load_file(self, file_path: str):
        """Load an audio file"""
        if file_path:
            self.player.setSource(QUrl.fromLocalFile(file_path))
            
    def play(self):
        """Start playback"""
        self.player.play()
        
    def pause(self):
        """Pause playback"""
        self.player.pause()
        
    def stop(self):
        """Stop playback"""
        self.player.stop()
        
    def restart(self):
        """Restart playback from beginning"""
        self.player.setPosition(0)
        self.player.play()
        
    def set_volume(self, volume: int):
        """Set playback volume"""
        self.audio_output.setVolume(volume / 100.0)
        
    def update_progress(self):
        """Update progress bar and time labels"""
        if self.player.isAvailable():
            duration = self.player.duration()
            position = self.player.position()
            
            if duration > 0:
                # Update progress bar
                progress = int((position / duration) * 100)
                self.progress_bar.setValue(progress)
                
                # Update time labels
                self.current_time_label.setText(self.format_time(position))
                self.total_time_label.setText(self.format_time(duration))
                
    def format_time(self, milliseconds: int) -> str:
        """Format milliseconds to MM:SS format"""
        seconds = milliseconds // 1000
        minutes = seconds // 60
        seconds = seconds % 60
        return f"{minutes:02d}:{seconds:02d}"
        
    def on_playback_state_changed(self, state):
        """Handle playback state changes"""
        if state == QMediaPlayer.PlaybackState.PlayingState:
            self.play_btn.setEnabled(False)
            self.pause_btn.setEnabled(True)
            self.stop_btn.setEnabled(True)
            self.restart_btn.setEnabled(True)
        elif state == QMediaPlayer.PlaybackState.PausedState:
            self.play_btn.setEnabled(True)
            self.pause_btn.setEnabled(False)
            self.stop_btn.setEnabled(True)
            self.restart_btn.setEnabled(True)
        else:  # StoppedState
            self.play_btn.setEnabled(True)
            self.pause_btn.setEnabled(False)
            self.stop_btn.setEnabled(False)
            self.restart_btn.setEnabled(False)
            
        self.playback_state_changed.emit(str(state))
        
    def on_media_status_changed(self, status):
        """Handle media status changes"""
        if status == QMediaPlayer.MediaStatus.LoadedMedia:
            # Media loaded successfully
            pass
        elif status == QMediaPlayer.MediaStatus.InvalidMedia:
            # Invalid media
            pass
            
    def reset_player(self):
        """Reset the player to initial state"""
        self.player.stop()
        self.player.setSource(QUrl())
        self.progress_bar.setValue(0)
        self.current_time_label.setText("00:00")
        self.total_time_label.setText("00:00")
        
    def cleanup(self):
        """Clean up resources"""
        self.update_timer.stop()
        self.player.stop() 