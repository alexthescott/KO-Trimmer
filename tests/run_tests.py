#!/usr/bin/env python3
"""
Simple test runner for KO Trimmer
Run consolidated test suite reflecting recent UI changes
"""

import sys
import argparse
from pathlib import Path

# Add the src directory to the Python path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from test_suite_consolidated import ConsolidatedTestSuite

def main():
    parser = argparse.ArgumentParser(description="Run KO Trimmer consolidated tests")
    parser.add_argument(
        "--category", "-c",
        choices=["core", "ui", "processing", "layout", "edgecases", "all"],
        default="all",
        help="Test category to run (default: all)"
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Verbose output"
    )
    
    args = parser.parse_args()
    
    print("KO Trimmer Consolidated Test Runner")
    print("=" * 50)
    
    test_suite = ConsolidatedTestSuite()
    
    if args.category == "all":
        print("Running all consolidated tests...")
        test_suite.run_all_tests()
    else:
        print(f"Running {args.category} tests...")
        
        if args.category == "core":
            test_suite.test_core_functionality()
        elif args.category == "ui":
            test_suite.test_ui_components()
        elif args.category == "processing":
            test_suite.test_processing_window()
        elif args.category == "layout":
            test_suite.test_layout_and_styling()
        elif args.category == "edgecases":
            test_suite.test_edge_cases()
        
        test_suite.print_results()

if __name__ == "__main__":
    main() 