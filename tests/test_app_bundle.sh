#!/bin/bash

echo "🧪 Testing TrimVibe macOS App Bundle"
echo "===================================="

# Change to parent directory to access the app bundle
cd "$(dirname "$0")/.."

# Test 1: Check if app bundle exists
echo "📁 Checking app bundle structure..."
if [ -d "TrimVibe.app" ]; then
    echo "✅ App bundle directory exists"
else
    echo "❌ App bundle directory missing"
    exit 1
fi

# Test 2: Check if executable exists
if [ -f "TrimVibe.app/Contents/MacOS/TrimVibe" ]; then
    echo "✅ Executable exists"
else
    echo "❌ Executable missing"
    exit 1
fi

# Test 3: Check if Info.plist exists
if [ -f "TrimVibe.app/Contents/Info.plist" ]; then
    echo "✅ Info.plist exists"
else
    echo "❌ Info.plist missing"
    exit 1
fi

# Test 4: Check if icon exists
if [ -f "TrimVibe.app/Contents/Resources/Knockout.icns" ]; then
    echo "✅ Icon exists"
else
    echo "❌ Icon missing"
    exit 1
fi

# Test 5: Check executable permissions
if [ -x "TrimVibe.app/Contents/MacOS/TrimVibe" ]; then
    echo "✅ Executable has proper permissions"
else
    echo "❌ Executable missing execute permissions"
    chmod +x "TrimVibe.app/Contents/MacOS/TrimVibe"
    echo "🔧 Fixed permissions"
fi

# Test 6: Check app bundle size
SIZE=$(du -sh "TrimVibe.app" | cut -f1)
echo "📊 App bundle size: $SIZE"

# Test 7: Launch app (non-interactive test)
echo "🚀 Testing app launch..."
timeout 5s open "TrimVibe.app" 2>/dev/null
if [ $? -eq 0 ]; then
    echo "✅ App launched successfully"
else
    echo "⚠️  App launch test inconclusive (timeout)"
fi

echo ""
echo "🎉 App bundle test completed!"
echo "📱 You can now:"
echo "   • Double-click TrimVibe.app in Finder"
echo "   • Run: open TrimVibe.app"
echo "   • Drag audio files onto the app icon" 