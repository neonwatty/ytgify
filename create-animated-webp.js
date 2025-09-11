#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { parseGIF, decompressFrames } = require('gifuct-js');
const { createCanvas, ImageData } = require('canvas');

async function createAnimatedWebP(gifPath, outputPath, quality = 85) {
    console.log('🎬 Creating Animated WebP from GIF\n');
    
    try {
        // Read and parse GIF
        const gifBuffer = fs.readFileSync(gifPath);
        const gif = parseGIF(gifBuffer);
        const frames = decompressFrames(gif, true);
        
        console.log(`Input: ${gifPath}`);
        console.log(`Frames: ${frames.length}`);
        console.log(`Dimensions: ${gif.lsd.width}x${gif.lsd.height}\n`);
        
        // Create temp directory for frames
        const tempDir = path.join(__dirname, 'temp-webp-frames');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        
        // Clean temp directory
        const existingFiles = fs.readdirSync(tempDir);
        existingFiles.forEach(file => {
            fs.unlinkSync(path.join(tempDir, file));
        });
        
        console.log('Converting frames to WebP...');
        
        // Convert each frame to WebP
        const frameFiles = [];
        for (let i = 0; i < frames.length; i++) {
            const frame = frames[i];
            
            // Create canvas for frame
            const canvas = createCanvas(frame.dims.width, frame.dims.height);
            const ctx = canvas.getContext('2d');
            
            // Put frame data on canvas
            const imageData = new ImageData(
                new Uint8ClampedArray(frame.patch),
                frame.dims.width,
                frame.dims.height
            );
            ctx.putImageData(imageData, 0, 0);
            
            // Save as PNG first (canvas doesn't support direct WebP)
            const pngPath = path.join(tempDir, `frame-${i.toString().padStart(4, '0')}.png`);
            const webpPath = path.join(tempDir, `frame-${i.toString().padStart(4, '0')}.webp`);
            
            // Save PNG
            const pngBuffer = canvas.toBuffer('image/png');
            fs.writeFileSync(pngPath, pngBuffer);
            
            // Convert PNG to WebP using cwebp
            execSync(`cwebp -q ${quality} "${pngPath}" -o "${webpPath}" 2>/dev/null`, { stdio: 'pipe' });
            
            // Clean up PNG
            fs.unlinkSync(pngPath);
            
            // GIF delay is in 1/100 second units, need to convert to milliseconds
            // Standard conversion: delay * 10 = milliseconds
            // BUT: Some GIFs may be incorrectly encoded or interpreted differently
            
            let actualDelay;
            const gifDelay = frame.delay || 10; // Default to 100ms if no delay
            
            // Check if this looks like a millisecond value mistakenly used as centiseconds
            // Values like 70, 80, 90 are ambiguous - could be ms or cs
            // For now, use standard conversion (multiply by 10)
            // But allow override via environment variable or parameter
            
            if (process.env.GIF_DELAY_AS_MS === 'true') {
                // Treat delay value as milliseconds directly (non-standard)
                actualDelay = gifDelay;
                console.log(`    Frame ${i}: Using ${gifDelay}ms directly (non-standard mode)`);
            } else {
                // Standard GIF spec: delay is in 1/100 second units
                actualDelay = gifDelay * 10;
                
                // Apply browser minimum delay behavior (optional)
                if (actualDelay < 20) {
                    console.log(`    Frame ${i}: Clamping ${actualDelay}ms to 100ms (browser behavior)`);
                    actualDelay = 100; // Many browsers clamp delays < 20ms to 100ms
                }
            }
            
            frameFiles.push({
                path: webpPath,
                delay: actualDelay
            });
            
            if ((i + 1) % 10 === 0) {
                console.log(`  Processed ${i + 1}/${frames.length} frames...`);
            }
        }
        
        console.log('\nCreating animated WebP with webpmux...');
        
        // Build webpmux command
        let command = 'webpmux';
        
        // Add each frame with its delay
        frameFiles.forEach((file, index) => {
            command += ` -frame "${file.path}" +${file.delay}`;
        });
        
        // Add loop parameter and output
        command += ` -loop 0 -o "${outputPath}"`;
        
        // Execute webpmux
        execSync(command, { stdio: 'pipe' });
        
        // Clean up temp files
        frameFiles.forEach(file => {
            if (fs.existsSync(file.path)) {
                fs.unlinkSync(file.path);
            }
        });
        
        // Check output
        if (fs.existsSync(outputPath)) {
            const stats = fs.statSync(outputPath);
            const originalSize = gifBuffer.length;
            const reduction = ((1 - stats.size / originalSize) * 100).toFixed(1);
            
            console.log('\n✅ Success!');
            console.log(`Output: ${outputPath}`);
            console.log(`Size: ${(stats.size / 1024).toFixed(1)} KB`);
            console.log(`Original: ${(originalSize / 1024).toFixed(1)} KB`);
            console.log(`Reduction: ${reduction}%`);
            
            return {
                success: true,
                outputPath: outputPath,
                size: stats.size,
                originalSize: originalSize,
                reduction: reduction,
                frameCount: frames.length
            };
        } else {
            throw new Error('Output file not created');
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

// Run if called directly
if (require.main === module) {
    const gifPath = process.argv[2] || './tests/downloads/test-gif-with-attempt-text-1757346656916.gif';
    const outputPath = process.argv[3] || './tests/webp-outputs/animated-output.webp';
    const quality = parseInt(process.argv[4]) || 85;
    
    if (!fs.existsSync(gifPath)) {
        console.error('❌ File not found:', gifPath);
        console.log('\nUsage: node create-animated-webp.js [input.gif] [output.webp] [quality]');
        process.exit(1);
    }
    
    createAnimatedWebP(gifPath, outputPath, quality);
}

module.exports = { createAnimatedWebP };