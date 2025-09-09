#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { parseGIF, decompressFrames } = require('gifuct-js');
const { createCanvas, ImageData } = require('canvas');

/**
 * Smart GIF to animated WebP converter that handles frame rate correctly
 */
async function createAnimatedWebP(gifPath, outputPath, quality = 85) {
    console.log('🎬 Smart Animated WebP Converter\n');
    
    try {
        // Read and parse GIF
        const gifBuffer = fs.readFileSync(gifPath);
        const gif = parseGIF(gifBuffer);
        const frames = decompressFrames(gif, true);
        
        console.log(`Input: ${gifPath}`);
        console.log(`Frames: ${frames.length}`);
        console.log(`Dimensions: ${gif.lsd.width}x${gif.lsd.height}\n`);
        
        // Analyze frame delays to determine correct interpretation
        const delays = frames.map(f => f.delay || 10);
        const uniqueDelays = [...new Set(delays)];
        const avgDelay = delays.reduce((a, b) => a + b, 0) / delays.length;
        
        console.log('Frame Delay Analysis:');
        console.log(`  Unique delays: ${uniqueDelays.join(', ')}`);
        console.log(`  Average delay: ${avgDelay.toFixed(1)}`);
        
        // Determine interpretation mode
        let interpretationMode = 'standard'; // default to GIF spec
        let delayMultiplier = 10; // standard GIF: multiply by 10 for ms
        
        // Heuristics to detect non-standard GIFs
        if (avgDelay > 50 && avgDelay < 200) {
            // Values like 70, 100, 150 might already be in milliseconds
            // Check if multiplying by 10 would make it unreasonably slow
            const testDuration = (avgDelay * 10 * frames.length) / 1000;
            
            if (testDuration > 30 && frames.length < 100) {
                // Would be > 30 seconds for < 100 frames, probably wrong
                console.log(`  ⚠️  Standard interpretation would be ${testDuration.toFixed(1)}s`);
                console.log(`  📊 This seems too slow. Testing if delays are already in ms...`);
                
                // Check common frame rates
                const expectedFPS = [30, 25, 20, 15, 14.3, 12, 10, 8, 6, 5, 4, 3, 2, 1];
                const msPerFrame = expectedFPS.map(fps => 1000 / fps);
                
                // Check if avgDelay matches common frame rates directly
                for (const ms of msPerFrame) {
                    if (Math.abs(avgDelay - ms) < 5) {
                        interpretationMode = 'milliseconds';
                        delayMultiplier = 1;
                        console.log(`  ✅ Detected ${Math.round(1000/avgDelay)} FPS animation`);
                        console.log(`  Using delays as milliseconds directly`);
                        break;
                    }
                }
            }
        }
        
        if (interpretationMode === 'standard') {
            console.log(`  Using standard GIF interpretation (delay × 10 = ms)`);
        }
        
        console.log('');
        
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
        let totalDuration = 0;
        
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
            
            // Save as PNG first
            const pngPath = path.join(tempDir, `frame-${i.toString().padStart(4, '0')}.png`);
            const webpPath = path.join(tempDir, `frame-${i.toString().padStart(4, '0')}.webp`);
            
            // Save PNG
            const pngBuffer = canvas.toBuffer('image/png');
            fs.writeFileSync(pngPath, pngBuffer);
            
            // Convert PNG to WebP using cwebp
            execSync(`cwebp -q ${quality} "${pngPath}" -o "${webpPath}" 2>/dev/null`, { stdio: 'pipe' });
            
            // Clean up PNG
            fs.unlinkSync(pngPath);
            
            // Calculate actual delay
            const gifDelay = frame.delay || 10;
            let actualDelay = gifDelay * delayMultiplier;
            
            // Apply browser minimum delay clamping for standard GIFs
            if (interpretationMode === 'standard' && actualDelay < 20) {
                actualDelay = 100; // Browsers clamp < 20ms to 100ms
            }
            
            totalDuration += actualDelay;
            
            frameFiles.push({
                path: webpPath,
                delay: actualDelay
            });
            
            if ((i + 1) % 10 === 0) {
                console.log(`  Processed ${i + 1}/${frames.length} frames...`);
            }
        }
        
        console.log(`\nAnimation Details:`);
        console.log(`  Total duration: ${(totalDuration / 1000).toFixed(2)} seconds`);
        console.log(`  Average FPS: ${(frames.length / (totalDuration / 1000)).toFixed(1)}`);
        
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
                frameCount: frames.length,
                duration: totalDuration,
                fps: frames.length / (totalDuration / 1000)
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
    const outputPath = process.argv[3] || './tests/webp-outputs/animated-smart.webp';
    const quality = parseInt(process.argv[4]) || 85;
    
    if (!fs.existsSync(gifPath)) {
        console.error('❌ File not found:', gifPath);
        console.log('\nUsage: node create-animated-webp-smart.js [input.gif] [output.webp] [quality]');
        process.exit(1);
    }
    
    createAnimatedWebP(gifPath, outputPath, quality);
}

module.exports = { createAnimatedWebP };