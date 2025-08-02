#!/usr/bin/env python3
"""
Archive old individual test files to clean up the tests directory
"""

import os
import shutil
from pathlib import Path

def archive_old_tests():
    """Archive old test files to a backup directory"""
    
    tests_dir = Path(__file__).parent
    archive_dir = tests_dir / "archive"
    
    # Create archive directory if it doesn't exist
    archive_dir.mkdir(exist_ok=True)
    
    # List of files to archive (all individual test files)
    files_to_archive = [
        "test_app.py",
        "test_single_file.py",
        "test_gui.py",
        "test_cymbal.py",
        "test_cymbal_compare.py",
        "test_completion_dialog.py",
        "test_output_directory.py",
        "test_output_path.py",
        "test_favorites_comprehensive.py",
        "test_favorites_rename_fix.py",
        "test_favorites_rename.py",
        "test_stereo_verification.py",
        "test_stereo_preservation.py",
        "test_favorites_debug.py",
        "test_favorite_selection.py",
        "test_display_names.py",
        "test_welcome_favorites.py",
        "test_processing_fix.py",
        "test_popup_failure_detection.py",
        "test_stereo_checkbox.py",
        "test_pause_play_functionality.py",
        "test_replay_functionality.py",
        "test_preview_repeat.py",
        "test_preview_demo.py",
        "test_audio_preview.py",
        "test_placeholder_visibility.py",
        "test_unified_drag_drop.py",
        "test_combined_file_interface.py",
        "test_output_directory_simplified.py",
        "test_output_directory_simple_clickable.py",
        "test_output_directory_clickable.py",
        "test_right_panel_visibility.py",
        "test_output_directory_simple.py",
        "test_output_directory_position.py",
        "test_output_directory_feature.py",
        "test_summary.py"
    ]
    
    archived_count = 0
    
    print("Archiving old test files...")
    print("=" * 40)
    
    for filename in files_to_archive:
        source_path = tests_dir / filename
        dest_path = archive_dir / filename
        
        if source_path.exists():
            try:
                shutil.move(str(source_path), str(dest_path))
                print(f"✅ Archived: {filename}")
                archived_count += 1
            except Exception as e:
                print(f"❌ Failed to archive {filename}: {e}")
        else:
            print(f"⚠️  File not found: {filename}")
    
    print("=" * 40)
    print(f"Archived {archived_count} files to {archive_dir}")
    print("\nNew consolidated test files:")
    print("- test_suite.py (comprehensive test suite)")
    print("- run_tests.py (test runner)")
    print("- README.md (updated documentation)")

if __name__ == "__main__":
    archive_old_tests() 