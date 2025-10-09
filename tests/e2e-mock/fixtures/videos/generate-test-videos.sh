#!/bin/bash
# Generate test videos for mock E2E tests using FFmpeg

set -e

cd "$(dirname "$0")"

echo "🎬 Generating test videos for mock E2E tests..."
echo ""

# Check if ffmpeg is installed
if ! command -v ffmpeg &> /dev/null; then
    echo "❌ Error: FFmpeg is not installed!"
    echo ""
    echo "Please install FFmpeg:"
    echo "  macOS:        brew install ffmpeg"
    echo "  Ubuntu/Debian: sudo apt-get install ffmpeg"
    echo "  Windows:      choco install ffmpeg"
    echo ""
    exit 1
fi

echo "✅ FFmpeg found: $(ffmpeg -version | head -n 1)"
echo ""

# Generate 20-second short video (640x360) - WebM format for Playwright compatibility
# Keyframe flags: -g 15 creates keyframe every 0.5s (15 frames at 30fps) for accurate seeking
echo "📹 Generating test-short-20s.webm (640x360, 20s)..."
ffmpeg -f lavfi -i testsrc=duration=20:size=640x360:rate=30 \
  -c:v libvpx-vp9 -crf 30 -b:v 0 -g 15 -keyint_min 15 \
  -y test-short-20s.webm 2>&1 | grep -i "video\|duration\|error" || true

# Generate 10-second medium video (1280x720)
echo "📹 Generating test-medium-10s.webm (1280x720, 10s)..."
ffmpeg -f lavfi -i testsrc=duration=10:size=1280x720:rate=30 \
  -c:v libvpx-vp9 -crf 30 -b:v 0 -g 15 -keyint_min 15 \
  -y test-medium-10s.webm 2>&1 | grep -i "video\|duration\|error" || true

# Generate 20-second long video (1920x1080)
echo "📹 Generating test-long-20s.webm (1920x1080, 20s)..."
ffmpeg -f lavfi -i testsrc=duration=20:size=1920x1080:rate=30 \
  -c:v libvpx-vp9 -crf 30 -b:v 0 -g 15 -keyint_min 15 \
  -y test-long-20s.webm 2>&1 | grep -i "video\|duration\|error" || true

# Generate 15-second HD video (1920x1080)
echo "📹 Generating test-hd-15s.webm (1920x1080, 15s)..."
ffmpeg -f lavfi -i testsrc=duration=15:size=1920x1080:rate=30 \
  -c:v libvpx-vp9 -crf 30 -b:v 0 -g 15 -keyint_min 15 \
  -y test-hd-15s.webm 2>&1 | grep -i "video\|duration\|error" || true

echo ""
echo "✅ Test videos generated successfully!"
echo ""
echo "📊 Video files:"
ls -lh test-*.webm 2>/dev/null || echo "No video files found"

echo ""
echo "🎉 Done! You can now run mock E2E tests."
