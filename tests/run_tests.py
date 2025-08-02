#!/usr/bin/env python3
"""
Simple test runner for KO Trimmer
Run specific test categories or all tests
"""

import sys
import argparse
from pathlib import Path

# Add the src directory to the Python path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from test_suite import TestSuite

def main():
    parser = argparse.ArgumentParser(description="Run KO Trimmer tests")
    parser.add_argument(
        "--category", "-c",
        choices=["core", "audio", "ui", "favorites", "output", "settings", "sample", "all"],
        default="all",
        help="Test category to run (default: all)"
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Verbose output"
    )
    
    args = parser.parse_args()
    
    print("KO Trimmer Test Runner")
    print("=" * 40)
    
    suite = TestSuite()
    
    if args.category == "all":
        print("Running all tests...")
        suite.run_all_tests()
    else:
        print(f"Running {args.category} tests...")
        
        if args.category == "core":
            suite.results.append(suite.run_test(suite.test_imports, "Module Imports"))
            suite.results.append(suite.run_test(suite.test_app_startup, "Application Startup"))
            suite.results.append(suite.run_test(suite.test_ffmpeg_availability, "FFmpeg Availability"))
            
        elif args.category == "audio":
            suite.results.append(suite.run_test(suite.test_single_file_processing, "Single File Processing"))
            suite.results.append(suite.run_test(suite.test_stereo_preservation, "Stereo Preservation"))
            suite.results.append(suite.run_test(suite.test_cymbal_processing, "Cymbal Processing"))
            
        elif args.category == "ui":
            suite.results.append(suite.run_test(suite.test_main_window_creation, "Main Window Creation"))
            suite.results.append(suite.run_test(suite.test_drag_drop_widget, "Drag Drop Widget"))
            suite.results.append(suite.run_test(suite.test_audio_preview, "Audio Preview"))
            suite.results.append(suite.run_test(suite.test_progress_widget, "Progress Widget"))
            
        elif args.category == "favorites":
            suite.results.append(suite.run_test(suite.test_favorites_sidebar, "Favorites Sidebar"))
            suite.results.append(suite.run_test(suite.test_favorites_add_remove, "Favorites Add/Remove"))
            suite.results.append(suite.run_test(suite.test_favorites_persistence, "Favorites Persistence"))
            
        elif args.category == "output":
            suite.results.append(suite.run_test(suite.test_output_directory_functionality, "Output Directory Field"))
            suite.results.append(suite.run_test(suite.test_output_directory_buttons, "Output Directory Buttons"))
            
        elif args.category == "settings":
            suite.results.append(suite.run_test(suite.test_settings_manager, "Settings Manager"))
            suite.results.append(suite.run_test(suite.test_icon_manager, "Icon Manager"))
        elif args.category == "sample":
            suite.results.append(suite.run_test(suite.test_sample_audio_availability, "Sample Audio Availability"))
        
        suite.print_results()

if __name__ == "__main__":
    main() 