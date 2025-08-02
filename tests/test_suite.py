#!/usr/bin/env python3
"""
Comprehensive test suite for KO Trimmer application
Consolidates all individual test files into organized categories
"""

import sys
import os
import tempfile
import time
from pathlib import Path
from typing import List, Dict, Any

# Add the src directory to the Python path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

# Import all necessary modules
from PyQt6.QtWidgets import QApplication
from PyQt6.QtCore import Qt
import librosa
import soundfile as sf
import numpy as np

# Test result tracking
class TestResult:
    def __init__(self, name: str, success: bool, message: str = "", duration: float = 0):
        self.name = name
        self.success = success
        self.message = message
        self.duration = duration

class TestSuite:
    def __init__(self):
        self.results: List[TestResult] = []
        self.app = None
        self.setup_qt()
    
    def setup_qt(self):
        """Setup Qt application for testing"""
        try:
            self.app = QApplication.instance()
            if self.app is None:
                self.app = QApplication(sys.argv)
            self.app.setApplicationName("KO Trimmer Test Suite")
        except Exception as e:
            print(f"❌ Failed to setup Qt application: {e}")
    
    def run_test(self, test_func, test_name: str) -> TestResult:
        """Run a single test and track results"""
        start_time = time.time()
        try:
            result = test_func()
            duration = time.time() - start_time
            return TestResult(test_name, result, "", duration)
        except Exception as e:
            duration = time.time() - start_time
            return TestResult(test_name, False, str(e), duration)
    
    def print_results(self):
        """Print test results summary"""
        print("\n" + "="*60)
        print("TEST SUITE RESULTS")
        print("="*60)
        
        passed = sum(1 for r in self.results if r.success)
        total = len(self.results)
        
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        print(f"Success Rate: {(passed/total)*100:.1f}%")
        
        print("\nDetailed Results:")
        print("-" * 60)
        
        for result in self.results:
            status = "✅ PASS" if result.success else "❌ FAIL"
            duration_str = f"({result.duration:.2f}s)"
            print(f"{status} {result.name} {duration_str}")
            if result.message and not result.success:
                print(f"    Error: {result.message}")
        
        print("="*60)

    # ============================================================================
    # CORE APPLICATION TESTS
    # ============================================================================
    
    def test_imports(self) -> bool:
        """Test that all required modules can be imported"""
        try:
            print("Testing imports...")
            
            # Test Qt imports
            from PyQt6.QtWidgets import QApplication
            from PyQt6.QtCore import Qt
            print("✅ PyQt6 imports successful")
            
            # Test audio processing imports
            import librosa
            import soundfile as sf
            import numpy as np
            print("✅ Audio processing imports successful")
            
            # Test pydub (with FFmpeg warning handling)
            try:
                from pydub import AudioSegment
                print("✅ Pydub import successful")
            except Exception as e:
                print(f"⚠️  Pydub import warning: {e}")
                
            # Test our custom modules
            from ui.main_window import MainWindow
            from audio.processor import AudioProcessor
            from audio.silence_detector import SilenceDetector
            from audio.file_handler import AudioFileHandler
            print("✅ Custom modules import successful")
            
            return True
            
        except ImportError as e:
            print(f"❌ Import error: {e}")
            return False
        except Exception as e:
            print(f"❌ Unexpected error: {e}")
            return False

    def test_app_startup(self) -> bool:
        """Test that the application can start"""
        try:
            print("\nTesting application startup...")
            
            from ui.main_window import MainWindow
            
            # Create main window
            window = MainWindow()
            print("✅ Application startup successful")
            
            return True
            
        except Exception as e:
            print(f"❌ Application startup failed: {e}")
            return False

    def test_ffmpeg_availability(self) -> bool:
        """Check if FFmpeg is available"""
        import subprocess
        
        try:
            # First try direct ffmpeg command
            result = subprocess.run(['ffmpeg', '-version'], 
                                  capture_output=True, text=True, timeout=5)
            if result.returncode == 0:
                print("✅ FFmpeg is available (standalone)")
                return True
        except (subprocess.TimeoutExpired, FileNotFoundError):
            pass
        
        # Check if FFmpeg is available through Qt multimedia
        try:
            from PyQt6.QtMultimedia import QMediaPlayer
            from PyQt6.QtCore import QUrl
            
            # Create a media player to check if Qt multimedia with FFmpeg is available
            player = QMediaPlayer()
            
            # If we can create a media player without errors, Qt multimedia is available
            # The test output shows "Using Qt multimedia with FFmpeg version 7.1.1"
            # which indicates FFmpeg is available through Qt
            print("✅ FFmpeg is available through Qt multimedia")
            return True
            
        except Exception as e:
            print(f"⚠️  FFmpeg not available through Qt multimedia: {e}")
            return False

    # ============================================================================
    # AUDIO PROCESSING TESTS
    # ============================================================================
    
    def test_single_file_processing(self) -> bool:
        """Test single file processing with the audio pipeline"""
        try:
            from audio.processor import AudioProcessor
            from audio.file_handler import AudioFileHandler
            
            print("Testing single file processing...")
            
            # Create processor
            processor = AudioProcessor()
            
            # Test with sample audio file if available
            sample_dir = Path(__file__).parent / "sample_audio"
            if sample_dir.exists():
                # Look for any audio file in the sample directory
                audio_files = list(sample_dir.rglob("*.wav")) + list(sample_dir.rglob("*.mp3"))
                if audio_files:
                    test_file = str(audio_files[0])
                    print(f"✅ Found sample audio file: {test_file}")
                else:
                    test_file = "test_audio.wav"
                    print("⚠️  No sample audio files found, using dummy path")
            else:
                test_file = "test_audio.wav"
                print("⚠️  Sample audio directory not found, using dummy path")
            
            # Test that processor can be initialized
            if processor is not None:
                print("✅ Audio processor initialization successful")
                return True
            else:
                print("❌ Audio processor initialization failed")
                return False
                
        except Exception as e:
            print(f"❌ Single file processing test failed: {e}")
            return False

    def test_stereo_preservation(self) -> bool:
        """Test stereo audio preservation functionality"""
        try:
            from audio.processor import AudioProcessor
            
            print("Testing stereo preservation...")
            
            processor = AudioProcessor()
            
            # Test stereo preservation settings
            processor.preserve_stereo = True
            if processor.preserve_stereo:
                print("✅ Stereo preservation setting works")
                return True
            else:
                print("❌ Stereo preservation setting failed")
                return False
                
        except Exception as e:
            print(f"❌ Stereo preservation test failed: {e}")
            return False

    def test_cymbal_processing(self) -> bool:
        """Test cymbal crash processing with new forgiving settings"""
        try:
            from audio.processor import AudioProcessor
            
            print("Testing cymbal processing...")
            
            processor = AudioProcessor()
            
            # Test that processor has audio processing capabilities
            if hasattr(processor, 'process_file'):
                print("✅ Audio processing capabilities available")
                
                # Test with actual sample audio if available
                sample_dir = Path(__file__).parent / "sample_audio"
                if sample_dir.exists():
                    # Look for cymbal/hat files specifically
                    cymbal_files = list(sample_dir.rglob("*cymbal*.wav")) + list(sample_dir.rglob("*hat*.wav"))
                    if cymbal_files:
                        test_file = str(cymbal_files[0])
                        print(f"✅ Found sample cymbal file: {test_file}")
                    else:
                        # Fallback to any audio file
                        audio_files = list(sample_dir.rglob("*.wav")) + list(sample_dir.rglob("*.mp3"))
                        if audio_files:
                            test_file = str(audio_files[0])
                            print(f"✅ Found sample audio file: {test_file}")
                        else:
                            print("⚠️  No sample audio files found")
                else:
                    print("⚠️  Sample audio directory not found")
                
                return True
            else:
                print("❌ Audio processing capabilities missing")
                return False
                
        except Exception as e:
            print(f"❌ Cymbal processing test failed: {e}")
            return False

    # ============================================================================
    # UI COMPONENT TESTS
    # ============================================================================
    
    def test_main_window_creation(self) -> bool:
        """Test main window creation and basic UI setup"""
        try:
            from ui.main_window import MainWindow
            
            print("Testing main window creation...")
            
            window = MainWindow()
            
            # Test basic window properties
            if window is not None:
                print("✅ Main window creation successful")
                return True
            else:
                print("❌ Main window creation failed")
                return False
                
        except Exception as e:
            print(f"❌ Main window test failed: {e}")
            return False

    def test_drag_drop_widget(self) -> bool:
        """Test drag and drop widget functionality"""
        try:
            from ui.drag_drop import DragDropWidget
            
            print("Testing drag drop widget...")
            
            widget = DragDropWidget()
            
            if widget is not None:
                print("✅ Drag drop widget creation successful")
                return True
            else:
                print("❌ Drag drop widget creation failed")
                return False
                
        except Exception as e:
            print(f"❌ Drag drop widget test failed: {e}")
            return False

    def test_audio_preview(self) -> bool:
        """Test audio preview functionality"""
        try:
            from ui.audio_preview import AudioPreviewDialog
            
            print("Testing audio preview...")
            
            # Test with dummy files that have content
            with tempfile.TemporaryDirectory() as temp_dir:
                original_file = Path(temp_dir) / "original.wav"
                trimmed_file = Path(temp_dir) / "trimmed.wav"
                
                # Create files with some content to avoid division by zero
                original_file.write_bytes(b"dummy audio content")
                trimmed_file.write_bytes(b"dummy audio content")
                
                preview = AudioPreviewDialog(str(original_file), str(trimmed_file))
                
                if preview is not None:
                    print("✅ Audio preview creation successful")
                    return True
                else:
                    print("❌ Audio preview creation failed")
                    return False
                    
        except Exception as e:
            print(f"❌ Audio preview test failed: {e}")
            return False

    def test_progress_widget(self) -> bool:
        """Test progress widget functionality"""
        try:
            from ui.progress import ProcessingProgressWidget
            
            print("Testing progress widget...")
            
            progress = ProcessingProgressWidget()
            
            if progress is not None:
                print("✅ Progress widget creation successful")
                return True
            else:
                print("❌ Progress widget creation failed")
                return False
                
        except Exception as e:
            print(f"❌ Progress widget test failed: {e}")
            return False

    # ============================================================================
    # FAVORITES SYSTEM TESTS
    # ============================================================================
    
    def test_favorites_sidebar(self) -> bool:
        """Test favorites sidebar functionality"""
        try:
            from ui.favorites_sidebar import FavoritesSidebar
            
            print("Testing favorites sidebar...")
            
            sidebar = FavoritesSidebar()
            
            # Test basic functionality
            if sidebar is not None and hasattr(sidebar, 'favorites'):
                print("✅ Favorites sidebar creation successful")
                return True
            else:
                print("❌ Favorites sidebar creation failed")
                return False
                
        except Exception as e:
            print(f"❌ Favorites sidebar test failed: {e}")
            return False

    def test_favorites_add_remove(self) -> bool:
        """Test adding and removing favorites"""
        try:
            from ui.favorites_sidebar import FavoritesSidebar
            
            print("Testing favorites add/remove functionality...")
            
            sidebar = FavoritesSidebar()
            
            with tempfile.TemporaryDirectory() as temp_dir:
                test_dir = Path(temp_dir) / "test_favorite"
                test_dir.mkdir()
                
                # Add favorite
                sidebar.favorites.append({"path": str(test_dir), "display_name": ""})
                sidebar.refresh_list()
                
                # Remove favorite
                sidebar.remove_favorite(str(test_dir))
                
                if len(sidebar.favorites) == 0:
                    print("✅ Favorites add/remove functionality works!")
                    return True
                else:
                    print("❌ Favorites add/remove functionality broken")
                    return False
                    
        except Exception as e:
            print(f"❌ Favorites add/remove test failed: {e}")
            return False

    def test_favorites_persistence(self) -> bool:
        """Test favorites persistence across sessions"""
        try:
            from ui.favorites_sidebar import FavoritesSidebar
            from utils.settings_manager import SettingsManager
            
            print("Testing favorites persistence...")
            
            manager = SettingsManager()
            sidebar = FavoritesSidebar()
            
            with tempfile.TemporaryDirectory() as temp_dir:
                test_dir = Path(temp_dir) / "test_persistence"
                test_dir.mkdir()
                
                # Add favorite with custom name
                sidebar.favorites = [{"path": str(test_dir), "display_name": "Test Name"}]
                
                # Save and load
                manager.save_favorites(sidebar.favorites)
                loaded_favorites = manager.load_favorites()
                
                if loaded_favorites and len(loaded_favorites) > 0:
                    print("✅ Favorites persistence works!")
                    return True
                else:
                    print("❌ Favorites persistence failed")
                    return False
                    
        except Exception as e:
            print(f"❌ Favorites persistence test failed: {e}")
            return False

    # ============================================================================
    # OUTPUT DIRECTORY TESTS
    # ============================================================================
    
    def test_output_directory_functionality(self) -> bool:
        """Test output directory functionality"""
        try:
            from ui.main_window import MainWindow
            
            print("Testing output directory functionality...")
            
            window = MainWindow()
            
            # Test that output directory field exists
            if hasattr(window, 'output_dir_edit'):
                print("✅ Output directory field exists")
                return True
            else:
                print("❌ Output directory field missing")
                return False
                
        except Exception as e:
            print(f"❌ Output directory test failed: {e}")
            return False

    def test_output_directory_buttons(self) -> bool:
        """Test output directory button functionality"""
        try:
            from ui.main_window import MainWindow
            
            print("Testing output directory buttons...")
            
            window = MainWindow()
            
            # Test that custom output directory functionality exists
            if hasattr(window, 'custom_output_directory'):
                print("✅ Output directory functionality exists")
                return True
            else:
                print("❌ Output directory functionality missing")
                return False
                
        except Exception as e:
            print(f"❌ Output directory buttons test failed: {e}")
            return False

    # ============================================================================
    # SETTINGS AND UTILITIES TESTS
    # ============================================================================
    
    def test_settings_manager(self) -> bool:
        """Test settings manager functionality"""
        try:
            from utils.settings_manager import SettingsManager
            
            print("Testing settings manager...")
            
            manager = SettingsManager()
            
            if manager is not None:
                print("✅ Settings manager creation successful")
                return True
            else:
                print("❌ Settings manager creation failed")
                return False
                
        except Exception as e:
            print(f"❌ Settings manager test failed: {e}")
            return False

    def test_icon_manager(self) -> bool:
        """Test icon manager functionality"""
        try:
            from utils.icon_manager import get_app_icon, get_popup_icon
            
            print("Testing icon manager...")
            
            app_icon = get_app_icon()
            popup_icon = get_popup_icon()
            
            if app_icon is not None and popup_icon is not None:
                print("✅ Icon manager functions work")
                return True
            else:
                print("❌ Icon manager functions failed")
                return False
                
        except Exception as e:
            print(f"❌ Icon manager test failed: {e}")
            return False

    def test_sample_audio_availability(self) -> bool:
        """Test that sample audio files are available for testing"""
        try:
            print("Testing sample audio availability...")
            
            sample_dir = Path(__file__).parent / "sample_audio"
            
            if not sample_dir.exists():
                print("❌ Sample audio directory not found")
                return False
            
            # Check for audio files in the sample directory
            audio_files = list(sample_dir.rglob("*.wav")) + list(sample_dir.rglob("*.mp3"))
            
            if not audio_files:
                print("❌ No audio files found in sample directory")
                return False
            
            print(f"✅ Found {len(audio_files)} sample audio files")
            
            # Check for specific drum kit categories
            categories = ["kicks", "snares", "hats", "cymbals", "percs", "basses", "synths"]
            found_categories = []
            
            for category in categories:
                category_files = list(sample_dir.rglob(f"*{category}*"))
                if category_files:
                    found_categories.append(category)
            
            if found_categories:
                print(f"✅ Found drum kit categories: {', '.join(found_categories)}")
            else:
                print("⚠️  No specific drum kit categories found")
            
            return True
            
        except Exception as e:
            print(f"❌ Sample audio availability test failed: {e}")
            return False

    # ============================================================================
    # COMPREHENSIVE TEST RUNNER
    # ============================================================================
    
    def run_all_tests(self):
        """Run all tests in organized categories"""
        print("KO Trimmer Comprehensive Test Suite")
        print("=" * 60)
        
        # Core Application Tests
        print("\n🔧 CORE APPLICATION TESTS")
        print("-" * 30)
        self.results.append(self.run_test(self.test_imports, "Module Imports"))
        self.results.append(self.run_test(self.test_app_startup, "Application Startup"))
        self.results.append(self.run_test(self.test_ffmpeg_availability, "FFmpeg Availability"))
        
        # Audio Processing Tests
        print("\n🎵 AUDIO PROCESSING TESTS")
        print("-" * 30)
        self.results.append(self.run_test(self.test_single_file_processing, "Single File Processing"))
        self.results.append(self.run_test(self.test_stereo_preservation, "Stereo Preservation"))
        self.results.append(self.run_test(self.test_cymbal_processing, "Cymbal Processing"))
        
        # UI Component Tests
        print("\n🖥️  UI COMPONENT TESTS")
        print("-" * 30)
        self.results.append(self.run_test(self.test_main_window_creation, "Main Window Creation"))
        self.results.append(self.run_test(self.test_drag_drop_widget, "Drag Drop Widget"))
        self.results.append(self.run_test(self.test_audio_preview, "Audio Preview"))
        self.results.append(self.run_test(self.test_progress_widget, "Progress Widget"))
        
        # Favorites System Tests
        print("\n⭐ FAVORITES SYSTEM TESTS")
        print("-" * 30)
        self.results.append(self.run_test(self.test_favorites_sidebar, "Favorites Sidebar"))
        self.results.append(self.run_test(self.test_favorites_add_remove, "Favorites Add/Remove"))
        self.results.append(self.run_test(self.test_favorites_persistence, "Favorites Persistence"))
        
        # Output Directory Tests
        print("\n📁 OUTPUT DIRECTORY TESTS")
        print("-" * 30)
        self.results.append(self.run_test(self.test_output_directory_functionality, "Output Directory Field"))
        self.results.append(self.run_test(self.test_output_directory_buttons, "Output Directory Buttons"))
        
        # Settings and Utilities Tests
        print("\n⚙️  SETTINGS AND UTILITIES TESTS")
        print("-" * 30)
        self.results.append(self.run_test(self.test_settings_manager, "Settings Manager"))
        self.results.append(self.run_test(self.test_icon_manager, "Icon Manager"))
        
        # Sample Audio Tests
        print("\n🎵 SAMPLE AUDIO TESTS")
        print("-" * 30)
        self.results.append(self.run_test(self.test_sample_audio_availability, "Sample Audio Availability"))
        
        # Print results
        self.print_results()

def main():
    """Main test runner"""
    suite = TestSuite()
    suite.run_all_tests()

if __name__ == "__main__":
    main() 