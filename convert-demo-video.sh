#!/bin/bash

# Convert WebM demo videos to MP4 format
# Requires ffmpeg to be installed

echo "🎬 Converting demo videos to MP4..."

# Check if ffmpeg is installed
if ! command -v ffmpeg &> /dev/null; then
    echo "❌ ffmpeg is not installed. Please install it first:"
    echo "   On macOS: brew install ffmpeg"
    echo "   On Ubuntu: sudo apt-get install ffmpeg"
    exit 1
fi

# Create output directory
mkdir -p demo-videos-mp4

# Convert all WebM files
for webm_file in demo-videos/*.webm; do
    if [ -f "$webm_file" ]; then
        filename=$(basename "$webm_file" .webm)
        output_file="demo-videos-mp4/${filename}.mp4"
        
        echo "Converting: $webm_file -> $output_file"
        
        # Convert with good quality settings
        ffmpeg -i "$webm_file" \
               -c:v libx264 \
               -preset medium \
               -crf 23 \
               -c:a aac \
               -b:a 128k \
               -movflags +faststart \
               "$output_file" \
               -y 2>/dev/null
        
        if [ $? -eq 0 ]; then
            echo "✅ Converted successfully"
            
            # Get file sizes
            original_size=$(du -h "$webm_file" | cut -f1)
            new_size=$(du -h "$output_file" | cut -f1)
            echo "   Original: $original_size -> MP4: $new_size"
        else
            echo "❌ Conversion failed for $webm_file"
        fi
    fi
done

# Find the most recent video and rename it
latest_mp4=$(ls -t demo-videos-mp4/*.mp4 2>/dev/null | head -1)
if [ -f "$latest_mp4" ]; then
    cp "$latest_mp4" "demo-videos-mp4/ytgiphy-demo.mp4"
    echo ""
    echo "🎉 Demo video ready: demo-videos-mp4/ytgiphy-demo.mp4"
    
    # Get video info
    duration=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$latest_mp4" 2>/dev/null)
    duration_formatted=$(printf '%02d:%02d' $(echo "$duration/60" | bc) $(echo "$duration%60" | bc))
    
    resolution=$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 "$latest_mp4" 2>/dev/null)
    
    echo "📊 Video Info:"
    echo "   Duration: $duration_formatted"
    echo "   Resolution: $resolution"
    echo "   Format: H.264/AAC MP4"
fi

echo ""
echo "💡 Tip: You can upload the MP4 file to GitHub, YouTube, or any video platform!"