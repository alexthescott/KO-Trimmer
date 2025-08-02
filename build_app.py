#!/usr/bin/env python3
"""
Build script for TrimVibe with bundled ffmpeg
"""

import os
import sys
import subprocess
import shutil
from pathlib import Path

def check_ffmpeg():
    """Check if ffmpeg is available"""
    try:
        result = subprocess.run(['ffmpeg', '-version'], 
                              capture_output=True, text=True, timeout=5)
        return result.returncode == 0
    except:
        return False

def download_ffmpeg_binary():
    """Download ffmpeg binary for macOS"""
    import urllib.request
    import zipfile
    
    # FFmpeg static build for macOS
    ffmpeg_url = "https://evermeet.cx/ffmpeg/getrelease/zip"
    ffmpeg_dir = Path("ffmpeg_bundle")
    ffmpeg_dir.mkdir(exist_ok=True)
    
    print("Downloading FFmpeg...")
    zip_path = ffmpeg_dir / "ffmpeg.zip"
    
    try:
        urllib.request.urlretrieve(ffmpeg_url, zip_path)
        
        # Extract
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(ffmpeg_dir)
        
        # Find the ffmpeg binary
        for file in ffmpeg_dir.rglob("ffmpeg"):
            if file.is_file() and os.access(file, os.X_OK):
                return file
        
        print("Error: Could not find ffmpeg binary in downloaded archive")
        return None
        
    except Exception as e:
        print(f"Error downloading ffmpeg: {e}")
        return None

def build_with_pyinstaller():
    """Build the application with PyInstaller"""
    
    # Check if ffmpeg is available
    ffmpeg_path = None
    if check_ffmpeg():
        print("FFmpeg found in system PATH")
        ffmpeg_path = shutil.which('ffmpeg')
    else:
        print("FFmpeg not found, downloading...")
        ffmpeg_path = download_ffmpeg_binary()
    
    if not ffmpeg_path:
        print("Warning: Could not find or download ffmpeg")
        print("Building without ffmpeg - bitrate compression will not work")
    
    # Create PyInstaller spec file
    spec_content = f'''# -*- mode: python ; coding: utf-8 -*-

block_cipher = None

a = Analysis(
    ['src/main.py'],
    pathex=[],
    binaries={[str(ffmpeg_path)] if ffmpeg_path else []},
    datas=[],
    hiddenimports=[
        'pydub',
        'librosa',
        'soundfile',
        'numpy',
        'scipy',
        'PyQt6',
        'PyQt6.QtCore',
        'PyQt6.QtGui',
        'PyQt6.QtWidgets',
        'PyQt6.QtMultimedia'
    ],
    hookspath=[],
    hooksconfig={{}},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='TrimVibe',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon='src/ui/images/Knockout.icns' if os.path.exists('src/ui/images/Knockout.icns') else None,
)
'''
    
    # Write spec file
    with open('TrimVibe.spec', 'w') as f:
        f.write(spec_content)
    
    # Run PyInstaller
    print("Building application with PyInstaller...")
    subprocess.run([
        'pyinstaller',
        '--clean',
        'TrimVibe.spec'
    ])
    
    print("Build complete! Executable is in dist/TrimVibe")

def build_with_cx_Freeze():
    """Alternative build method using cx_Freeze"""
    
    setup_content = '''
from cx_Freeze import setup, Executable
import sys

# Dependencies are automatically detected, but it might need fine tuning.
build_exe_options = {
    "packages": [
        "os", "sys", "numpy", "librosa", "soundfile", "pydub", 
        "PyQt6", "scipy", "pathlib", "typing"
    ],
    "excludes": [],
    "include_files": []
}

# GUI applications require a different base on Windows
base = None
if sys.platform == "win32":
    base = "Win32GUI"

setup(
    name="TrimVibe",
    version="1.0",
    description="Audio Silence Trimmer",
    options={"build_exe": build_exe_options},
    executables=[Executable("src/main.py", base=base, target_name="TrimVibe")]
)
'''
    
    with open('setup_cx_freeze.py', 'w') as f:
        f.write(setup_content)
    
    subprocess.run(['python', 'setup_cx_freeze.py', 'build'])

if __name__ == "__main__":
    print("TrimVibe Build Script")
    print("=====================")
    
    if len(sys.argv) > 1 and sys.argv[1] == "cx_freeze":
        build_with_cx_Freeze()
    else:
        build_with_pyinstaller() 