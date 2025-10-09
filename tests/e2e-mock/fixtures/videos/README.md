# Test Video Generation

This directory contains test video files used by the mock E2E test suite. These videos allow tests to run without depending on real YouTube.

## Required Videos

The following video files are required for mock E2E tests:

- `test-short-5s.mp4` - 5 second video (640x360)
- `test-medium-10s.mp4` - 10 second video (1280x720)
- `test-long-20s.mp4` - 20 second video (1920x1080)
- `test-hd-15s.mp4` - 15 second video (1920x1080)

## Generating Test Videos

### Option 1: Using FFmpeg (Recommended)

Install FFmpeg if you don't have it:

```bash
# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt-get install ffmpeg

# Windows (via Chocolatey)
choco install ffmpeg
```

Generate test videos using the testsrc pattern (synthetic test pattern):

```bash
cd tests/e2e-mock/fixtures/videos

# Generate 5-second short video (640x360)
ffmpeg -f lavfi -i testsrc=duration=5:size=640x360:rate=30 \
  -pix_fmt yuv420p -c:v libx264 -preset fast \
  test-short-5s.mp4

# Generate 10-second medium video (1280x720)
ffmpeg -f lavfi -i testsrc=duration=10:size=1280x720:rate=30 \
  -pix_fmt yuv420p -c:v libx264 -preset fast \
  test-medium-10s.mp4

# Generate 20-second long video (1920x1080)
ffmpeg -f lavfi -i testsrc=duration=20:size=1920x1080:rate=30 \
  -pix_fmt yuv420p -c:v libx264 -preset fast \
  test-long-20s.mp4

# Generate 15-second HD video (1920x1080)
ffmpeg -f lavfi -i testsrc=duration=15:size=1920x1080:rate=30 \
  -pix_fmt yuv420p -c:v libx264 -preset fast \
  test-hd-15s.mp4
```

### Option 2: Using Color Patterns

For simpler solid color videos:

```bash
# Red video - 5 seconds
ffmpeg -f lavfi -i color=c=red:s=640x360:d=5:r=30 \
  -pix_fmt yuv420p -c:v libx264 \
  test-short-5s.mp4

# Blue video - 10 seconds
ffmpeg -f lavfi -i color=c=blue:s=1280x720:d=10:r=30 \
  -pix_fmt yuv420p -c:v libx264 \
  test-medium-10s.mp4

# Green video - 20 seconds
ffmpeg -f lavfi -i color=c=green:s=1920x1080:d=20:r=30 \
  -pix_fmt yuv420p -c:v libx264 \
  test-long-20s.mp4

# Yellow video - 15 seconds
ffmpeg -f lavfi -i color=c=yellow:s=1920x1080:d=15:r=30 \
  -pix_fmt yuv420p -c:v libx264 \
  test-hd-15s.mp4
```

### Option 3: Download Open Source Videos

You can use short clips from open source videos like:

- Big Buck Bunny: https://download.blender.org/demo/movies/BBB/
- Sintel: https://durian.blender.org/download/

Example:

```bash
# Download and trim Big Buck Bunny
wget https://download.blender.org/demo/movies/BBB/bbb_sunflower_1080p_30fps_normal.mp4

# Trim to 5 seconds
ffmpeg -i bbb_sunflower_1080p_30fps_normal.mp4 -ss 00:00:00 -t 5 \
  -c copy test-short-5s.mp4

# Resize and trim to 10 seconds at 720p
ffmpeg -i bbb_sunflower_1080p_30fps_normal.mp4 -ss 00:00:05 -t 10 \
  -vf scale=1280:720 test-medium-10s.mp4
```

## Quick Setup Script

Create a script to generate all videos at once:

```bash
#!/bin/bash
# File: generate-test-videos.sh

cd "$(dirname "$0")"

echo "🎬 Generating test videos..."

# Short video
echo "Generating test-short-5s.mp4..."
ffmpeg -f lavfi -i testsrc=duration=5:size=640x360:rate=30 \
  -pix_fmt yuv420p -c:v libx264 -preset fast \
  -y test-short-5s.mp4

# Medium video
echo "Generating test-medium-10s.mp4..."
ffmpeg -f lavfi -i testsrc=duration=10:size=1280x720:rate=30 \
  -pix_fmt yuv420p -c:v libx264 -preset fast \
  -y test-medium-10s.mp4

# Long video
echo "Generating test-long-20s.mp4..."
ffmpeg -f lavfi -i testsrc=duration=20:size=1920x1080:rate=30 \
  -pix_fmt yuv420p -c:v libx264 -preset fast \
  -y test-long-20s.mp4

# HD video
echo "Generating test-hd-15s.mp4..."
ffmpeg -f lavfi -i testsrc=duration=15:size=1920x1080:rate=30 \
  -pix_fmt yuv420p -c:v libx264 -preset fast \
  -y test-hd-15s.mp4

echo "✅ Test videos generated successfully!"
ls -lh test-*.mp4
```

Make executable and run:

```bash
chmod +x generate-test-videos.sh
./generate-test-videos.sh
```

## Verification

After generating, verify the videos:

```bash
# Check video properties
ffprobe test-short-5s.mp4

# Expected output should show:
# Duration: 00:00:05.00
# Video: h264, yuv420p, 640x360, 30 fps
```

## File Sizes

Expected approximate file sizes:

- `test-short-5s.mp4`: ~50-100 KB
- `test-medium-10s.mp4`: ~150-250 KB
- `test-long-20s.mp4`: ~500-800 KB
- `test-hd-15s.mp4`: ~400-600 KB

## Troubleshooting

### FFmpeg not found

```bash
# Check if FFmpeg is installed
ffmpeg -version

# If not, install it using instructions above
```

### Videos not playing in browser

Make sure videos are encoded with H.264 (libx264) and yuv420p pixel format for browser compatibility.

### Permission denied

```bash
# Make sure you have write permissions
chmod +w .
```

## CI/CD Setup

For GitHub Actions, videos will be generated in the CI environment before tests run. Add to your workflow:

```yaml
- name: Generate test videos
  run: |
    cd tests/e2e-mock/fixtures/videos
    chmod +x generate-test-videos.sh
    ./generate-test-videos.sh
```

## Notes

- Test videos are in `.gitignore` to keep repository size small
- Videos use synthetic patterns (no copyright issues)
- Videos are optimized for size while maintaining quality for testing
- All videos use 30 fps for consistent GIF extraction testing
