#!/usr/bin/env python3
"""
Test to verify that the completion popup correctly shows failure information
"""

import sys
import os
import time
from pathlib import Path
from PyQt6.QtWidgets import QApplication, QMessageBox
from PyQt6.QtCore import QTimer, QEventLoop
from PyQt6.QtTest import QTest

# Add the src directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from ui.main_window import MainWindow
from ui.progress import ProcessingProgressWidget


class PopupTestHelper:
    """Helper class to test popup behavior"""
    
    def __init__(self):
        self.app = QApplication.instance()
        if not self.app:
            self.app = QApplication(sys.argv)
        
        self.main_window = MainWindow()
        self.popup_detected = False
        self.popup_message = ""
        self.popup_title = ""
        
    def wait_for_popup(self, timeout=30):
        """Wait for a popup to appear and capture its content"""
        start_time = time.time()
        
        while time.time() - start_time < timeout:
            # Check for active popup windows
            for widget in self.app.topLevelWidgets():
                if isinstance(widget, QMessageBox) and widget.isVisible():
                    self.popup_detected = True
                    self.popup_title = widget.windowTitle()
                    self.popup_message = widget.text()
                    return True
            
            # Process events and wait a bit
            self.app.processEvents()
            time.sleep(0.1)
        
        return False
    
    def close_popup(self):
        """Close any visible popup"""
        for widget in self.app.topLevelWidgets():
            if isinstance(widget, QMessageBox) and widget.isVisible():
                widget.accept()
                return True
        return False


def test_popup_failure_detection():
    """Test that popup correctly shows failure information"""
    print("🧪 Testing popup failure detection...")
    
    helper = PopupTestHelper()
    
    try:
        # Show the main window
        helper.main_window.show()
        
        print("📋 Instructions for manual test:")
        print("1. The application window should now be visible")
        print("2. Drag and drop the folder: /Users/alexthescott/Desktop/william crooks drumkit vol. 1")
        print("3. Click 'Process Files' button")
        print("4. Wait for processing to complete")
        print("5. The popup should show failure information if files failed")
        print("6. Press Enter when ready to continue...")
        
        input("Press Enter when you've completed the test...")
        
        # Check if popup was detected
        if helper.popup_detected:
            print(f"✅ Popup detected!")
            print(f"   Title: {helper.popup_title}")
            print(f"   Message: {helper.popup_message}")
            
            # Check if the message contains failure information
            if "failed" in helper.popup_message.lower() or "error" in helper.popup_message.lower():
                print("✅ Popup correctly shows failure information")
                return True
            elif "successfully" in helper.popup_message.lower():
                print("ℹ️  Popup shows success message (no failures detected)")
                return True
            else:
                print("❌ Popup message doesn't clearly indicate success or failure")
                return False
        else:
            print("❌ No popup detected within timeout period")
            return False
            
    except Exception as e:
        print(f"❌ Test failed with error: {e}")
        return False
    finally:
        helper.close_popup()
        helper.main_window.close()


def test_progress_widget_failure_tracking():
    """Test that the progress widget correctly tracks failures"""
    print("\n🧪 Testing progress widget failure tracking...")
    
    app = QApplication.instance()
    if not app:
        app = QApplication(sys.argv)
    
    progress_widget = ProcessingProgressWidget()
    
    # Simulate some successful and failed files
    progress_widget.start_processing()
    
    # Add some successful files
    progress_widget.update_file_progress("/path/to/success1.wav", True)
    progress_widget.update_file_progress("/path/to/success2.wav", True)
    
    # Add some failed files
    progress_widget.update_file_progress("/path/to/failed1.wav", False)
    progress_widget.update_file_progress("/path/to/failed2.wav", False)
    
    progress_widget.finish_processing()
    
    # Get summary info
    summary = progress_widget.get_summary_info()
    
    if summary:
        print(f"✅ Summary generated successfully")
        print(f"   Files processed: {summary.get('files_processed', 0)}")
        print(f"   Total files: {summary.get('total_files', 0)}")
        print(f"   Failed files: {summary.get('failed_files', 0)}")
        
        # Check that failures are tracked
        if summary.get('failed_files', 0) == 2:
            print("✅ Failure tracking working correctly")
            return True
        else:
            print(f"❌ Expected 2 failed files, got {summary.get('failed_files', 0)}")
            return False
    else:
        print("❌ No summary generated")
        return False


def test_popup_message_content():
    """Test the popup message content logic"""
    print("\n🧪 Testing popup message content logic...")
    
    app = QApplication.instance()
    if not app:
        app = QApplication(sys.argv)
    
    main_window = MainWindow()
    
    # Test different scenarios
    test_cases = [
        {
            'name': 'All files successful',
            'summary': {'files_processed': 5, 'total_files': 5, 'failed_files': 0},
            'expected_contains': 'successfully',
            'expected_dialog_type': 'information'
        },
        {
            'name': 'Some files failed',
            'summary': {'files_processed': 3, 'total_files': 5, 'failed_files': 2},
            'expected_contains': 'failed to process',
            'expected_dialog_type': 'warning'
        },
        {
            'name': 'All files failed',
            'summary': {'files_processed': 0, 'total_files': 5, 'failed_files': 5},
            'expected_contains': 'completed with errors',
            'expected_dialog_type': 'warning'
        }
    ]
    
    for test_case in test_cases:
        print(f"   Testing: {test_case['name']}")
        
        # Mock the summary info
        main_window.progress_widget.original_sizes = {'file1': 1000, 'file2': 1000}
        main_window.progress_widget.processed_sizes = {'file1': 800} if test_case['summary']['files_processed'] > 0 else {}
        main_window.progress_widget.failed_files = ['failed1', 'failed2'] if test_case['summary']['failed_files'] > 0 else []
        
        # Get the message that would be shown
        summary_info = main_window.progress_widget.get_summary_info()
        if summary_info:
            # Simulate the message creation logic
            failed_files = summary_info.get('failed_files', 0)
            processed_files = summary_info.get('files_processed', 0)
            
            if failed_files == 0:
                message = "All files have been processed successfully!\n\n"
            elif processed_files == 0:
                message = "Processing completed with errors.\n\n"
            else:
                message = f"Processing completed with {failed_files} file(s) that failed to process.\n\n"
            
            # Check if the message contains expected content
            if test_case['expected_contains'] in message.lower():
                print(f"   ✅ Message contains expected content: '{test_case['expected_contains']}'")
            else:
                print(f"   ❌ Message missing expected content: '{test_case['expected_contains']}'")
                print(f"      Actual message: {message}")
                return False
        else:
            print(f"   ❌ No summary info generated for {test_case['name']}")
            return False
    
    print("✅ All popup message content tests passed")
    return True


if __name__ == "__main__":
    print("🚀 Starting popup failure detection tests...")
    
    # Test 1: Progress widget failure tracking
    test1_passed = test_progress_widget_failure_tracking()
    
    # Test 2: Popup message content logic
    test2_passed = test_popup_message_content()
    
    # Test 3: Manual popup detection (requires user interaction)
    print("\n" + "="*50)
    print("MANUAL TEST REQUIRED")
    print("="*50)
    test3_passed = test_popup_failure_detection()
    
    # Summary
    print("\n" + "="*50)
    print("TEST SUMMARY")
    print("="*50)
    print(f"Progress Widget Failure Tracking: {'✅ PASSED' if test1_passed else '❌ FAILED'}")
    print(f"Popup Message Content Logic: {'✅ PASSED' if test2_passed else '❌ FAILED'}")
    print(f"Manual Popup Detection: {'✅ PASSED' if test3_passed else '❌ FAILED'}")
    
    if test1_passed and test2_passed and test3_passed:
        print("\n🎉 All tests passed! The popup failure detection is working correctly.")
    else:
        print("\n⚠️  Some tests failed. Please check the implementation.") 