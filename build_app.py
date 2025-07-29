#!/usr/bin/env python3
"""
Build KO Trimmer as a proper macOS application
"""

import subprocess
import sys
import os
from pathlib import Path

def build_macos_app():
    """Build KO Trimmer as a macOS app bundle"""
    
    print("Building KO Trimmer as macOS app...")
    
    # Clean previous builds
    print("Cleaning previous builds...")
    subprocess.run(["rm", "-rf", "dist", "build"], capture_output=True)
    
    # Build the app with explicit module inclusion
    cmd = [
        "python3", "-m", "PyInstaller",
        "--onefile",  # Use onefile for proper app bundle
        "--windowed",
        "--name=KO Trimmer",
        "--icon=src/ui/images/Knockout.png",
        "--add-data=src/ui/images:ui/images",
        "--hidden-import=src.ui.main_window",
        "--hidden-import=src.ui.drag_drop",
        "--hidden-import=src.ui.progress",
        "--hidden-import=src.ui.dialogs",
        "--hidden-import=src.audio.processor",
        "--hidden-import=src.audio.silence_detector",
        "--hidden-import=src.audio.file_handler",
        "--collect-all=src",
        "--osx-bundle-identifier=com.kotrimmer.app",
        "src/main.py"
    ]
    
    print(f"Running: {' '.join(cmd)}")
    result = subprocess.run(cmd, capture_output=True, text=True)
    
    if result.returncode == 0:
        print("✅ Build successful!")
        print("📱 App location: dist/KO Trimmer.app")
        print("🚀 You can now run: open 'dist/KO Trimmer.app'")
        
        # Add additional macOS metadata
        enhance_app_bundle()
        
    else:
        print("❌ Build failed!")
        print("Error:", result.stderr)

def enhance_app_bundle():
    """Add additional macOS app bundle enhancements"""
    try:
        app_path = "dist/KO Trimmer.app"
        info_plist_path = f"{app_path}/Contents/Info.plist"
        
        print("🔧 Enhancing app bundle with macOS metadata...")
        
        # Read current Info.plist
        with open(info_plist_path, 'r') as f:
            content = f.read()
        
        # Add additional macOS-specific keys
        enhanced_content = content.replace(
            '<key>NSHighResolutionCapable</key>',
            '''<key>NSHighResolutionCapable</key>
        <true/>
        <key>CFBundleVersion</key>
        <string>1.0.0</string>
        <key>CFBundleShortVersionString</key>
        <string>1.0.0</string>
        <key>LSMinimumSystemVersion</key>
        <string>10.15</string>
        <key>NSPrincipalClass</key>
        <string>NSApplication</string>
        <key>NSRequiresAquaSystemAppearance</key>
        <false/>
        <key>LSApplicationCategoryType</key>
        <string>public.app-category.music</string>
        <key>CFBundleDocumentTypes</key>
        <array>
            <dict>
                <key>CFBundleTypeName</key>
                <string>Audio Files</string>
                <key>CFBundleTypeExtensions</key>
                <array>
                    <string>wav</string>
                    <string>mp3</string>
                    <string>flac</string>
                    <string>aiff</string>
                    <string>m4a</string>
                    <string>ogg</string>
                </array>
                <key>CFBundleTypeRole</key>
                <string>Viewer</string>
                <key>LSHandlerRank</key>
                <string>Owner</string>
            </dict>
        </array>'''
        )
        
        # Write enhanced Info.plist
        with open(info_plist_path, 'w') as f:
            f.write(enhanced_content)
        
        print("✅ App bundle enhanced with macOS metadata!")
        print("📋 Features added:")
        print("   - Proper version information")
        print("   - Audio file type associations")
        print("   - Music app category")
        print("   - macOS 10.15+ compatibility")
        print("   - Dark mode support")
        
    except Exception as e:
        print(f"⚠️  Could not enhance app bundle: {e}")

if __name__ == "__main__":
    build_macos_app() 