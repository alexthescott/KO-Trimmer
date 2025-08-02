#!/usr/bin/env python3
"""
Simple packaging script for TrimVibe with ffmpeg
"""

import os
import sys
import subprocess
import shutil
from pathlib import Path

def install_ffmpeg():
    """Install ffmpeg using Homebrew if not available"""
    try:
        result = subprocess.run(['ffmpeg', '-version'], 
                              capture_output=True, text=True, timeout=5)
        if result.returncode == 0:
            print("✅ FFmpeg already installed")
            return True
    except:
        pass
    
    print("📦 Installing FFmpeg...")
    try:
        subprocess.run(['brew', 'install', 'ffmpeg'], check=True)
        print("✅ FFmpeg installed successfully")
        return True
    except subprocess.CalledProcessError:
        print("❌ Failed to install FFmpeg with Homebrew")
        print("Please install manually: brew install ffmpeg")
        return False

def build_app():
    """Build the application"""
    print("🔨 Building TrimVibe application...")
    
    # Clean previous builds
    for path in ['dist', 'build']:
        if os.path.exists(path):
            shutil.rmtree(path)
    
    # Build command
    cmd = [
        'python3', '-m', 'PyInstaller',
        '--onefile',
        '--windowed',
        '--name=TrimVibe',
        '--add-data=src/ui/images:ui/images',
        '--hidden-import=PyQt6.QtCore',
        '--hidden-import=PyQt6.QtGui', 
        '--hidden-import=PyQt6.QtWidgets',
        '--hidden-import=PyQt6.QtMultimedia',
        '--hidden-import=pydub',
        '--hidden-import=librosa',
        '--hidden-import=soundfile',
        '--hidden-import=numpy',
        '--hidden-import=scipy',
        '--collect-all=src',
        'src/main.py'
    ]
    
    try:
        subprocess.run(cmd, check=True)
        print("✅ Build successful!")
        print("📱 App location: dist/TrimVibe")
        
        # Copy ffmpeg to dist directory if available
        ffmpeg_path = shutil.which('ffmpeg')
        if ffmpeg_path:
            dist_path = Path('dist')
            if dist_path.exists():
                shutil.copy2(ffmpeg_path, dist_path / 'ffmpeg')
                print("✅ FFmpeg copied to dist directory")
        
        return True
        
    except subprocess.CalledProcessError as e:
        print(f"❌ Build failed: {e}")
        return False

def create_dmg():
    """Create a DMG installer (macOS only)"""
    if sys.platform != 'darwin':
        print("⚠️  DMG creation only available on macOS")
        return False
    
    try:
        import dmgbuild
    except ImportError:
        print("📦 Installing dmgbuild...")
        subprocess.run([sys.executable, '-m', 'pip', 'install', 'dmgbuild'])
    
    print("📦 Creating DMG installer...")
    
    # Create DMG settings
    settings = {
        'title': 'TrimVibe',
        'format': 'UDBZ',
        'size': (400, 300),
        'files': ['dist/TrimVibe'],
        'symlinks': {'Applications': '/Applications'},
        'background': 'src/ui/images/Knockout.png' if os.path.exists('src/ui/images/Knockout.png') else None,
        'icon_size': 128,
        'icon_locations': {
            'TrimVibe': (100, 100),
            'Applications': (300, 100)
        }
    }
    
    try:
        dmgbuild.build_dmg('TrimVibe.dmg', 'TrimVibe', settings)
        print("✅ DMG created: TrimVibe.dmg")
        return True
    except Exception as e:
        print(f"❌ DMG creation failed: {e}")
        return False

def main():
    print("🚀 TrimVibe Packaging Script")
    print("=" * 40)
    
    # Check/install ffmpeg
    if not install_ffmpeg():
        print("⚠️  Continuing without FFmpeg - bitrate compression will not work")
    
    # Build the app
    if build_app():
        print("\n🎉 Build completed successfully!")
        print("📁 Files created:")
        print("   - dist/TrimVibe (executable)")
        if os.path.exists('dist/ffmpeg'):
            print("   - dist/ffmpeg (bundled)")
        
        # Create DMG if requested
        if len(sys.argv) > 1 and sys.argv[1] == '--dmg':
            create_dmg()
    else:
        print("\n❌ Build failed!")
        sys.exit(1)

if __name__ == "__main__":
    main() 