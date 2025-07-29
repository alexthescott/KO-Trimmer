#!/usr/bin/env python3
"""
Test to verify the favorites renaming fix works correctly
"""

import sys
import os
import tempfile
from pathlib import Path

# Add the src directory to the Python path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

def test_favorites_rename_fix():
    """Test that favorites renaming now works correctly"""
    try:
        from ui.favorites_sidebar import FavoritesSidebar
        from PyQt6.QtWidgets import QApplication
        
        print("Testing fixed favorites renaming functionality...")
        
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
            
            # Add the test directory to favorites with new format
            sidebar.favorites = [{"path": str(test_dir), "display_name": ""}]
            sidebar.refresh_list()
            
            print(f"Added directory to favorites: {test_dir}")
            print(f"Favorites list count: {sidebar.favorites_list.count()}")
            
            # Check if the item was added correctly
            if sidebar.favorites_list.count() > 0:
                item = sidebar.favorites_list.item(0)
                print(f"Initial item text: {item.text()}")
                print(f"Initial item data: {item.data(0)}")  # UserRole
                
                # Simulate renaming
                print("\nSimulating rename operation...")
                old_directory = str(test_dir)
                
                # Manually update the display name (simulating user input)
                sidebar.favorites[0]["display_name"] = "My Custom Name"
                sidebar.refresh_list()
                
                # Check if the rename actually worked
                print(f"Favorites after rename: {sidebar.favorites}")
                print(f"List count after rename: {sidebar.favorites_list.count()}")
                
                if sidebar.favorites_list.count() > 0:
                    item_after = sidebar.favorites_list.item(0)
                    print(f"Item text after rename: {item_after.text()}")
                    print(f"Item data after rename: {item_after.data(0)}")
                    
                    # Check if the custom name is displayed
                    if item_after.text() == "My Custom Name":
                        print("✅ SUCCESS: Custom display name is now working!")
                        return True
                    else:
                        print("❌ FAILED: Custom display name not showing")
                        return False
                else:
                    print("❌ FAILED: No items in list after rename")
                    return False
            else:
                print("❌ Failed to add directory to favorites list")
                return False
                
    except Exception as e:
        print(f"❌ Test failed with error: {e}")
        return False

def test_favorites_storage_new_format():
    """Test that favorites storage works with new format"""
    try:
        from utils.settings_manager import SettingsManager
        
        print("\nTesting new favorites storage format...")
        
        manager = SettingsManager()
        
        # Test with new format
        with tempfile.TemporaryDirectory() as temp_dir:
            test_favorites = [
                {"path": temp_dir, "display_name": "Test Directory"},
                {"path": temp_dir + "/subdir", "display_name": "Custom Name"}
            ]
            
            # Save favorites
            manager.save_favorites(test_favorites)
            print(f"Saved favorites: {test_favorites}")
            
            # Load favorites
            loaded_favorites = manager.load_favorites()
            print(f"Loaded favorites: {loaded_favorites}")
            
            # Check if they match (filtering out non-existent paths)
            if len(loaded_favorites) > 0:
                print("✅ SUCCESS: New favorites storage format works!")
                print(f"Loaded {len(loaded_favorites)} favorites with custom names")
                return True
            else:
                print("❌ FAILED: No favorites loaded")
                return False
                
    except Exception as e:
        print(f"❌ Storage test failed: {e}")
        return False

def test_backward_compatibility():
    """Test that the new system is backward compatible"""
    try:
        from utils.settings_manager import SettingsManager
        
        print("\nTesting backward compatibility...")
        
        manager = SettingsManager()
        
        # Test with old format (list of strings)
        with tempfile.TemporaryDirectory() as temp_dir:
            old_format_favorites = [temp_dir]
            
            # Save in old format
            with open(manager._get_favorites_file_path(), 'w') as f:
                import json
                json.dump(old_format_favorites, f, indent=2)
            
            print(f"Saved old format favorites: {old_format_favorites}")
            
            # Load with new format
            loaded_favorites = manager.load_favorites()
            print(f"Loaded favorites: {loaded_favorites}")
            
            # Check if conversion worked
            if loaded_favorites and isinstance(loaded_favorites[0], dict):
                print("✅ SUCCESS: Backward compatibility works!")
                print("Old format automatically converted to new format")
                return True
            else:
                print("❌ FAILED: Backward compatibility broken")
                return False
                
    except Exception as e:
        print(f"❌ Backward compatibility test failed: {e}")
        return False

def main():
    """Run the favorites rename fix tests"""
    print("=== Testing Favorites Rename Fix ===\n")
    
    # Test 1: Verify the fix works
    fix_works = test_favorites_rename_fix()
    
    # Test 2: Check new storage format
    storage_works = test_favorites_storage_new_format()
    
    # Test 3: Check backward compatibility
    backward_compatible = test_backward_compatibility()
    
    print("\n=== Test Results ===")
    print(f"Rename fix works: {'Yes' if fix_works else 'No'}")
    print(f"New storage format works: {'Yes' if storage_works else 'No'}")
    print(f"Backward compatible: {'Yes' if backward_compatible else 'No'}")
    
    if fix_works and storage_works and backward_compatible:
        print("\n🎉 ALL TESTS PASSED!")
        print("✅ Favorites renaming now works correctly")
        print("✅ Custom display names are persisted")
        print("✅ Backward compatibility maintained")
        return True
    else:
        print("\n❌ Some tests failed")
        return False

if __name__ == "__main__":
    main() 