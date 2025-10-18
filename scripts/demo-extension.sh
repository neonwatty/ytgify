#!/bin/bash

# Demo Extension - Launch Chrome with YTGify loaded
# This script opens Chrome with the extension for manual testing and screenshots

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DIST_DIR="$PROJECT_DIR/dist"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== YTGify Extension Demo ===${NC}"
echo ""

# Check if dist folder exists
if [ ! -d "$DIST_DIR" ]; then
    echo "Error: dist folder not found. Building extension..."
    cd "$PROJECT_DIR"
    npm run build
fi

echo -e "${GREEN}Extension built successfully!${NC}"
echo ""
echo -e "${BLUE}Instructions:${NC}"
echo "1. Chrome will open with YTGify extension loaded"
echo "2. Navigate to any YouTube video"
echo "3. Click the YTGify button to open the wizard"
echo "4. Take screenshots of each screen:"
echo "   - QuickCapture screen"
echo "   - Text Overlay screen"
echo "   - Processing screen"
echo "   - Success screen (with 'Spread the word' share link)"
echo "   - Feedback screen (with 'Show Your Support' section)"
echo "   - Milestone celebration screen (create 10, 25, or 50 GIFs)"
echo ""
echo "Press Enter to launch Chrome..."
read

# Launch Chrome with extension
echo -e "${GREEN}Launching Chrome...${NC}"

if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
        --load-extension="$DIST_DIR" \
        --disable-extensions-except="$DIST_DIR" \
        "https://www.youtube.com/watch?v=jNQXAC9IVRw"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    google-chrome \
        --load-extension="$DIST_DIR" \
        --disable-extensions-except="$DIST_DIR" \
        "https://www.youtube.com/watch?v=jNQXAC9IVRw"
else
    echo "Unsupported OS. Please manually load the extension from: $DIST_DIR"
fi
