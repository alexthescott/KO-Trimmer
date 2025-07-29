#!/usr/bin/env python3
"""
Package KO Trimmer for distribution
"""

import subprocess
import sys
import os
from pathlib import Path

def create_dmg():
    """Create a DMG for distribution"""
    try:
        print("📦 Creating DMG for distribution...")
        
        # Check if create-dmg is available
        result = subprocess.run(["which", "create-dmg"], capture_output=True, text=True)
        if result.returncode != 0:
            print("⚠️  create-dmg not found. Install with: brew install create-dmg")
            print("📋 Manual DMG creation:")
            print("   1. Open Disk Utility")
            print("   2. Create new disk image")
            print("   3. Drag KO Trimmer.app to the disk image")
            print("   4. Eject and save as .dmg")
            return False
        
        # Create DMG
        dmg_name = "KO Trimmer 1.0.0.dmg"
        app_path = "dist/KO Trimmer.app"
        
        cmd = [
            "create-dmg",
            "--volname", "KO Trimmer",
            "--window-pos", "200", "120",
            "--window-size", "600", "400",
            "--icon-size", "100",
            "--app-drop-link", "425", "120",
            dmg_name,
            app_path
        ]
        
        print(f"Running: {' '.join(cmd)}")
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode == 0:
            print(f"✅ DMG created successfully: {dmg_name}")
            return True
        else:
            print("❌ DMG creation failed")
            print("Error:", result.stderr)
            return False
            
    except Exception as e:
        print(f"❌ Error creating DMG: {e}")
        return False

def main():
    """Package the app for distribution"""
    
    print("🚀 KO Trimmer Distribution Package")
    print("=" * 40)
    
    # Check if app exists
    app_path = Path("dist/KO Trimmer.app")
    if not app_path.exists():
        print("❌ App not found. Run build_app.py first.")
        return 1
    
    print("✅ App found: dist/KO Trimmer.app")
    
    # Show app info
    print("\n📱 App Information:")
    print(f"   Name: KO Trimmer")
    print(f"   Version: 1.0.0")
    print(f"   Bundle ID: com.kotrimmer.app")
    print(f"   Size: {app_path.stat().st_size / (1024*1024):.1f} MB")
    
    # Show distribution options
    print("\n📦 Distribution Options:")
    print("1. Direct app bundle: dist/KO Trimmer.app")
    print("2. Create DMG for easy distribution")
    
    choice = input("\nCreate DMG? (y/n): ").lower().strip()
    
    if choice in ['y', 'yes']:
        if create_dmg():
            print("\n🎉 Distribution package ready!")
            print("📁 Files created:")
            print("   - dist/KO Trimmer.app (App bundle)")
            print("   - KO Trimmer 1.0.0.dmg (Distribution package)")
        else:
            print("\n📋 Manual distribution:")
            print("   - Share the app bundle directly")
            print("   - Or create DMG manually using Disk Utility")
    else:
        print("\n✅ App bundle ready for distribution!")
        print("📁 Location: dist/KO Trimmer.app")
    
    return 0

if __name__ == "__main__":
    sys.exit(main()) 