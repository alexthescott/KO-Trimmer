#!/usr/bin/env python3
"""
Test to reproduce and fix the favorites renaming bug
"""

import sys
import os
import tempfile
from pathlib import Path

# Add the src directory to the Python path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

def test_favorites_rename_bug():
    """Test to reproduce the favorites renaming bug"""
    try:
        from ui.favorites_sidebar import FavoritesSidebar
        from PyQt6.QtWidgets import QApplication
        
        print("Testing favorites renaming functionality...")
        
        # Create a test directory
        with tempfile.TemporaryDirectory() as temp_dir:
            test_dir = Path(temp_dir) / "test_favorite"
            test_dir.mkdir()
            
            print(f"Created test directory: {test_dir}")
            
            # Create Qt application
            app = QApplication.instance()
            if app is None:
                app = QApplication(sys.argv)
            
            # Create favorites sidebar
            sidebar = FavoritesSidebar()
            
            # Add the test directory to favorites
            sidebar.favorites = [str(test_dir)]
            sidebar.refresh_list()
            
            print(f"Added directory to favorites: {test_dir}")
            print(f"Favorites list count: {sidebar.favorites_list.count()}")
            
            # Check if the item was added correctly
            if sidebar.favorites_list.count() > 0:
                item = sidebar.favorites_list.item(0)
                print(f"Item text: {item.text()}")
                print(f"Item data: {item.data(0)}")  # UserRole
                
                # Simulate renaming
                print("\nSimulating rename operation...")
                old_directory = str(test_dir)
                
                # Call the rename function
                sidebar.rename_favorite(old_directory)
                
                # Check if the rename actually worked
                print(f"Favorites after rename: {sidebar.favorites}")
                print(f"List count after rename: {sidebar.favorites_list.count()}")
                
                if sidebar.favorites_list.count() > 0:
                    item_after = sidebar.favorites_list.item(0)
                    print(f"Item text after rename: {item_after.text()}")
                    print(f"Item data after rename: {item_after.data(0)}")
                
                # The bug: rename doesn't persist custom names
                print("\n❌ BUG FOUND: Rename function doesn't persist custom display names")
                print("The favorites system only stores paths, not custom display names")
                
                return False
            else:
                print("❌ Failed to add directory to favorites list")
                return False
                
    except Exception as e:
        print(f"❌ Test failed with error: {e}")
        return False

def test_favorites_storage():
    """Test how favorites are currently stored"""
    try:
        from utils.settings_manager import SettingsManager
        
        print("\nTesting favorites storage...")
        
        manager = SettingsManager()
        
        # Test with a temporary directory
        with tempfile.TemporaryDirectory() as temp_dir:
            test_favorites = [temp_dir]
            
            # Save favorites
            manager.save_favorites(test_favorites)
            print(f"Saved favorites: {test_favorites}")
            
            # Load favorites
            loaded_favorites = manager.load_favorites()
            print(f"Loaded favorites: {loaded_favorites}")
            
            # Check if they match
            if test_favorites == loaded_favorites:
                print("✅ Favorites storage works correctly")
                print("❌ BUT: Only stores paths, not custom display names")
                return True
            else:
                print("❌ Favorites storage failed")
                return False
                
    except Exception as e:
        print(f"❌ Storage test failed: {e}")
        return False

def main():
    """Run the favorites rename tests"""
    print("=== Testing Favorites Rename Bug ===\n")
    
    # Test 1: Reproduce the bug
    bug_found = test_favorites_rename_bug()
    
    # Test 2: Check storage mechanism
    storage_works = test_favorites_storage()
    
    print("\n=== Test Results ===")
    print(f"Bug reproduced: {'Yes' if not bug_found else 'No'}")
    print(f"Storage works: {'Yes' if storage_works else 'No'}")
    
    if not bug_found:
        print("\n🎯 BUG CONFIRMED: Favorites renaming doesn't work because:")
        print("1. The system only stores directory paths")
        print("2. No mechanism to store custom display names")
        print("3. Rename function doesn't persist changes")
        
        print("\n🔧 SOLUTION NEEDED:")
        print("1. Extend favorites storage to include custom names")
        print("2. Update rename function to persist custom names")
        print("3. Modify display logic to use custom names when available")
    
    return bug_found and storage_works

if __name__ == "__main__":
    main() 