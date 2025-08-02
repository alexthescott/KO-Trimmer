"""
Audio file handling and validation
"""

import os
from pathlib import Path
from typing import List, Dict, Any, Optional
import mimetypes


class AudioFileHandler:
    """Class for handling audio file operations"""
    
    def __init__(self):
        self.supported_extensions = {
            '.wav', '.mp3', '.flac', '.aiff', '.m4a', '.ogg', '.wma', '.aac'
        }
        
        # MIME types for audio files
        self.audio_mime_types = {
            'audio/wav', 'audio/x-wav', 'audio/mpeg', 'audio/mp3', 'audio/flac', 
            'audio/aiff', 'audio/mp4', 'audio/ogg', 'audio/wma', 'audio/aac'
        }
        
    def is_valid_audio_file(self, file_path: str) -> bool:
        """
        Check if a file is a valid audio file
        
        Args:
            file_path: Path to the file
            
        Returns:
            bool: True if file is a valid audio file
        """
        try:
            path = Path(file_path)
            
            # Basic validation checks
            if not path.exists() or not path.is_file():
                return False
                
            if path.stat().st_size == 0:
                return False
                
            if path.suffix.lower() not in self.supported_extensions:
                return False
                
            return True
            
        except Exception:
            return False
            
    def get_audio_files_in_directory(self, directory_path: str, recursive: bool = True) -> List[str]:
        """
        Get all audio files in a directory
        
        Args:
            directory_path: Path to the directory
            recursive: Whether to search recursively
            
        Returns:
            List of audio file paths
        """
        audio_files = []
        directory = Path(directory_path)
        
        if not directory.exists() or not directory.is_dir():
            return audio_files
            
        try:
            if recursive:
                # Search recursively
                for file_path in directory.rglob("*"):
                    if file_path.is_file() and self.is_valid_audio_file(str(file_path)):
                        audio_files.append(str(file_path))
            else:
                # Search only in the specified directory
                for file_path in directory.iterdir():
                    if file_path.is_file() and self.is_valid_audio_file(str(file_path)):
                        audio_files.append(str(file_path))
                        
        except PermissionError:
            # Skip directories we don't have permission to access
            pass
            
        return audio_files
        
    def get_file_info(self, file_path: str) -> Dict[str, Any]:
        """
        Get information about an audio file
        
        Args:
            file_path: Path to the audio file
            
        Returns:
            Dictionary with file information
        """
        try:
            path = Path(file_path)
            
            if not self.is_valid_audio_file(file_path):
                return {}
                
            stat = path.stat()
            
            return {
                'name': path.name,
                'stem': path.stem,
                'suffix': path.suffix.lower(),
                'size_bytes': stat.st_size,
                'size_mb': stat.st_size / (1024 * 1024),
                'modified_time': stat.st_mtime,
                'path': str(path),
                'parent': str(path.parent)
            }
            
        except Exception as e:
            print(f"Error getting file info for {file_path}: {e}")
            return {}
            
    def create_output_directory(self, output_path: str) -> bool:
        """
        Create output directory if it doesn't exist
        
        Args:
            output_path: Path where output should be saved
            
        Returns:
            bool: True if directory was created or already exists
        """
        try:
            output_dir = Path(output_path).parent
            output_dir.mkdir(parents=True, exist_ok=True)
            return True
        except Exception as e:
            print(f"Error creating output directory: {e}")
            return False
            
    def get_unique_filename(self, base_path: str, suffix: str = "_trimmed") -> str:
        """
        Generate a unique filename to avoid overwriting existing files
        
        Args:
            base_path: Base file path
            suffix: Suffix to add to filename
            
        Returns:
            Unique file path
        """
        path = Path(base_path)
        counter = 1
        
        while True:
            if counter == 1:
                new_name = f"{path.stem}{suffix}{path.suffix}"
            else:
                new_name = f"{path.stem}{suffix}_{counter}{path.suffix}"
                
            new_path = path.parent / new_name
            
            if not new_path.exists():
                return str(new_path)
                
            counter += 1
            
    def validate_output_path(self, output_path: str, overwrite: bool = False) -> bool:
        """
        Validate if output path is writable
        
        Args:
            output_path: Path where file should be saved
            overwrite: Whether to allow overwriting existing files
            
        Returns:
            bool: True if path is valid and writable
        """
        try:
            path = Path(output_path)
            
            # Check if parent directory is writable
            parent_dir = path.parent
            if not parent_dir.exists():
                parent_dir.mkdir(parents=True, exist_ok=True)
                
            if not parent_dir.is_dir():
                return False
                
            # Test write permissions
            test_file = parent_dir / ".test_write"
            try:
                test_file.touch()
                test_file.unlink()
            except Exception:
                return False
                
            # Check overwrite permission
            if path.exists() and not overwrite:
                return False
                
            return True
            
        except Exception:
            return False
            
    def get_relative_path(self, file_path: str, base_directory: str) -> str:
        """
        Get relative path from base directory
        
        Args:
            file_path: Full file path
            base_directory: Base directory path
            
        Returns:
            Relative path string
        """
        try:
            file_path_obj = Path(file_path)
            base_dir_obj = Path(base_directory)
            
            return str(file_path_obj.relative_to(base_dir_obj))
        except ValueError:
            # If file is not in base directory, return just the filename
            return Path(file_path).name
            
    def format_file_size(self, size_bytes: int) -> str:
        """
        Format file size in human-readable format
        
        Args:
            size_bytes: Size in bytes
            
        Returns:
            Formatted size string
        """
        size_units = [
            (1024 * 1024 * 1024, "GB"),
            (1024 * 1024, "MB"),
            (1024, "KB"),
            (1, "B")
        ]
        
        for unit_size, unit_name in size_units:
            if size_bytes >= unit_size:
                return f"{size_bytes / unit_size:.1f} {unit_name}"
        
        return f"{size_bytes} B" 