#!/bin/bash
# WebSuddhi iOS - Build & Install Script
# This creates YOUR Safari extension for iPhone

set -e

echo "🔷 WebSuddhi iOS Setup"
echo "======================"
echo ""

# Check for XcodeGen
echo "📦 Checking XcodeGen..."
if ! command -v xcodegen &> /dev/null; then
    echo "   XcodeGen not found. Installing via Homebrew..."
    if ! command -v brew &> /dev/null; then
        echo "   ❌ Homebrew not found!"
        echo "   Install Homebrew first: https://brew.sh"
        exit 1
    fi
    brew install xcodegen
    echo "   ✅ XcodeGen installed"
else
    echo "   ✅ XcodeGen is ready"
fi

# Navigate to project directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Generate Xcode project
echo ""
echo "🔧 Generating Xcode project..."
xcodegen generate

echo ""
echo "✅ Project generated successfully!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📱 NEXT STEPS TO INSTALL ON YOUR IPHONE:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. Open WebSuddhi.xcodeproj in Xcode"
echo ""
echo "2. Select your Development Team:"
echo "   - Click the project in the sidebar"
echo "   - Go to 'Signing & Capabilities' tab"
echo "   - Select your Apple ID under 'Team'"
echo ""
echo "3. Connect your iPhone to your Mac"
echo ""
echo "4. Build and install:"
echo "   - Press Cmd+R or click the Run button"
echo "   - Xcode will install WebSuddhi on your iPhone"
echo ""
echo "5. Enable on iPhone:"
echo "   - Go to Settings > Safari > Extensions"
echo "   - Turn ON WebSuddhi"
echo "   - Tap 'WebSuddhi' and enable 'All Websites'"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔷 Your WebSuddhi Safari extension is ready!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
