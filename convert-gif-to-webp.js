#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { parseGIF, decompressFrames } = require('gifuct-js');

// Simple script to analyze GIF and prepare for WebP conversion
async function analyzeGif(gifPath) {
    console.log('🎬 GIF to WebP Conversion Analysis\n');
    console.log(`Input: ${gifPath}`);
    
    try {
        // Read GIF file
        const gifBuffer = fs.readFileSync(gifPath);
        const gifSize = gifBuffer.length;
        console.log(`File size: ${(gifSize / 1024).toFixed(1)} KB\n`);
        
        // Parse GIF
        console.log('Parsing GIF structure...');
        const gif = parseGIF(gifBuffer);
        
        console.log(`Dimensions: ${gif.lsd.width}x${gif.lsd.height}`);
        console.log(`Global Color Table: ${gif.gct ? 'Yes' : 'No'}`);
        
        // Decompress frames
        console.log('\nExtracting frames...');
        const frames = decompressFrames(gif, true);
        
        console.log(`Total frames: ${frames.length}`);
        
        // Analyze frames
        let totalDuration = 0;
        let minDelay = Infinity;
        let maxDelay = 0;
        
        frames.forEach((frame, index) => {
            const delay = frame.delay || 10; // Default 100ms
            totalDuration += delay * 10; // Convert to ms
            minDelay = Math.min(minDelay, delay);
            maxDelay = Math.max(maxDelay, delay);
            
            if (index < 5) {
                console.log(`  Frame ${index + 1}: ${frame.dims.width}x${frame.dims.height}, delay: ${delay * 10}ms`);
            }
        });
        
        if (frames.length > 5) {
            console.log(`  ... and ${frames.length - 5} more frames`);
        }
        
        console.log(`\nAnimation stats:`);
        console.log(`  Total duration: ${(totalDuration / 1000).toFixed(2)} seconds`);
        console.log(`  Average FPS: ${(frames.length / (totalDuration / 1000)).toFixed(1)} fps`);
        console.log(`  Frame delays: ${minDelay * 10}ms - ${maxDelay * 10}ms`);
        
        // Calculate expected WebP sizes
        console.log('\n📊 Expected WebP conversion:');
        
        // Single frame
        const singleFrameEstimate = (gif.lsd.width * gif.lsd.height * 3) / 20; // Rough estimate
        console.log(`  Single frame WebP: ~${(singleFrameEstimate / 1024).toFixed(1)} KB`);
        
        // Animated WebP (lossy)
        const animatedLossyEstimate = gifSize * 0.65; // ~35% reduction
        console.log(`  Animated WebP (lossy): ~${(animatedLossyEstimate / 1024).toFixed(1)} KB`);
        
        // Animated WebP (lossless)
        const animatedLosslessEstimate = gifSize * 0.82; // ~18% reduction  
        console.log(`  Animated WebP (lossless): ~${(animatedLosslessEstimate / 1024).toFixed(1)} KB`);
        
        // Save frame data for testing
        const outputDir = path.join(__dirname, 'tests', 'webp-outputs', 'frames');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        
        // Save first few frames as raw data
        console.log('\n💾 Saving frame data for analysis...');
        for (let i = 0; i < Math.min(5, frames.length); i++) {
            const frame = frames[i];
            const frameInfo = {
                index: i,
                width: frame.dims.width,
                height: frame.dims.height,
                left: frame.dims.left,
                top: frame.dims.top,
                delay: frame.delay * 10,
                disposal: frame.disposalType,
                dataSize: frame.patch.length
            };
            
            fs.writeFileSync(
                path.join(outputDir, `frame-${i}-info.json`),
                JSON.stringify(frameInfo, null, 2)
            );
            
            console.log(`  Saved frame ${i} metadata`);
        }
        
        console.log('\n✅ Analysis complete!');
        
        return {
            width: gif.lsd.width,
            height: gif.lsd.height,
            frameCount: frames.length,
            duration: totalDuration,
            originalSize: gifSize,
            frames: frames
        };
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    const gifPath = process.argv[2] || './tests/downloads/test-gif-with-attempt-text-1757346656916.gif';
    
    if (!fs.existsSync(gifPath)) {
        console.error('❌ File not found:', gifPath);
        console.log('\nUsage: node convert-gif-to-webp.js [path-to-gif]');
        process.exit(1);
    }
    
    analyzeGif(gifPath);
}

module.exports = { analyzeGif };