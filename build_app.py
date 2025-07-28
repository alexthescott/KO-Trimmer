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
        "src/main.py"
    ]
    
    print(f"Running: {' '.join(cmd)}")
    result = subprocess.run(cmd, capture_output=True, text=True)
    
    if result.returncode == 0:
        print("✅ Build successful!")
        print("📱 App location: dist/KO Trimmer.app")
        print("🚀 You can now run: open 'dist/KO Trimmer.app'")
    else:
        print("❌ Build failed!")
        print("Error:", result.stderr)

if __name__ == "__main__":
    build_macos_app() 