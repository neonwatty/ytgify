const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  console.log('=== Frame Extraction and Verification Test ===\n');
  
  const extensionPath = path.join(process.cwd(), 'dist');
  const outputPath = path.join(process.cwd(), 'tests', 'captured-frames');
  
  // Create output directory
  if (!fs.existsSync(outputPath)) {
    fs.mkdirSync(outputPath, { recursive: true });
  }
  // Clean existing frames
  fs.readdirSync(outputPath).forEach(file => {
    fs.unlinkSync(path.join(outputPath, file));
  });
  
  const browser = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`
    ],
    viewport: { width: 1920, height: 1080 }
  });

  const page = await browser.newPage();
  
  // Monitor console for frame captures
  const frameTimings = [];
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[ContentScriptGifProcessor] Captured frame')) {
      console.log(text);
      const match = text.match(/frame (\d+)\/(\d+) at time ([\d.]+)s/);
      if (match) {
        frameTimings.push({
          frame: parseInt(match[1]),
          total: parseInt(match[2]),
          time: parseFloat(match[3])
        });
      }
    }
  });
  
  // STEP 1: Navigate to YouTube
  console.log('1. Opening YouTube video...');
  console.log('   Video: "Me at the zoo" - The first ever YouTube video');
  console.log('   We\'ll capture frames from the elephant scene\n');
  
  await page.goto('https://www.youtube.com/watch?v=jNQXAC9IVRw');
  await page.waitForTimeout(3000);
  
  // STEP 2: Position video
  console.log('2. Setting video to 5 seconds (elephant scene)...');
  const videoState = await page.evaluate(() => {
    const video = document.querySelector('video');
    if (video) {
      video.currentTime = 5;
      video.pause();
      return {
        duration: video.duration,
        currentTime: video.currentTime,
        width: video.videoWidth,
        height: video.videoHeight
      };
    }
  });
  console.log('   Video state:', videoState);
  await page.waitForTimeout(1000);
  
  // STEP 3: Open GIF timeline
  console.log('\n3. Opening GIF creation interface...');
  await page.click('.ytgif-button');
  await page.waitForSelector('#ytgif-timeline-overlay', { timeout: 5000 });
  
  // Get the selection range
  const selection = await page.evaluate(() => {
    const range = document.querySelector('.ytgif-timeline-range');
    return range ? range.textContent : null;
  });
  console.log('   Selection range:', selection);
  
  // STEP 4: Start GIF creation
  console.log('\n4. Starting GIF creation...');
  console.log('   This will extract frames from the selected video segment\n');
  
  await page.click('.ytgif-timeline-create');
  
  // Wait for frame extraction
  console.log('5. Extracting frames...\n');
  
  // Wait for processing to complete or timeout
  await page.waitForFunction(
    () => !document.querySelector('#ytgif-timeline-overlay'),
    { timeout: 30000 }
  ).catch(() => console.log('   Processing continues...'));
  
  // Wait a bit more for all operations
  await page.waitForTimeout(3000);
  
  // STEP 5: Retrieve captured frames
  console.log('\n6. Retrieving captured frame data...');
  const capturedFrames = await page.evaluate(() => {
    return window.__DEBUG_CAPTURED_FRAMES || [];
  });
  
  console.log(`   Found ${capturedFrames.length} captured frames`);
  
  if (capturedFrames.length > 0) {
    // STEP 6: Save frames as images
    console.log('\n7. Saving frames as PNG images...\n');
    
    for (let i = 0; i < Math.min(capturedFrames.length, 10); i++) { // Save first 10 for quick view
      const frame = capturedFrames[i];
      const base64Data = frame.dataUrl.replace(/^data:image\/png;base64,/, '');
      const filename = `frame_${String(frame.frameNumber).padStart(3, '0')}_at_${frame.videoTime.toFixed(3)}s.png`;
      const filepath = path.join(outputPath, filename);
      
      fs.writeFileSync(filepath, base64Data, 'base64');
      console.log(`   ✓ ${filename} (${frame.width}x${frame.height})`);
    }
    
    if (capturedFrames.length > 10) {
      console.log(`   ... and ${capturedFrames.length - 10} more frames`);
    }
    
    // STEP 7: Analyze frames
    console.log('\n8. Frame Analysis:');
    console.log('   ═══════════════════════════════════════');
    
    const firstTime = capturedFrames[0].videoTime;
    const lastTime = capturedFrames[capturedFrames.length - 1].videoTime;
    const duration = lastTime - firstTime;
    
    console.log(`   📹 Total frames: ${capturedFrames.length}`);
    console.log(`   ⏱️  Time range: ${firstTime.toFixed(3)}s - ${lastTime.toFixed(3)}s`);
    console.log(`   ⏳ Duration: ${duration.toFixed(3)} seconds`);
    console.log(`   🎬 Frame rate: ${(capturedFrames.length / duration).toFixed(1)} fps`);
    console.log(`   📐 Resolution: ${capturedFrames[0].width}x${capturedFrames[0].height}`);
    
    // Verify frames are in correct time range
    console.log('\n9. Verification:');
    console.log('   ═══════════════════════════════════════');
    
    // Parse expected range from selection
    let expectedStart = 3, expectedEnd = 7;
    if (selection) {
      const rangeMatch = selection.match(/([\d.]+)s.*?([\d.]+)s/);
      if (rangeMatch) {
        expectedStart = parseFloat(rangeMatch[1]);
        expectedEnd = parseFloat(rangeMatch[2]);
      }
    }
    
    const tolerance = 0.5; // Allow 0.5 second tolerance
    const inRange = firstTime >= (expectedStart - tolerance) && 
                   lastTime <= (expectedEnd + tolerance);
    
    if (inRange) {
      console.log(`   ✅ Frames are within expected range (${expectedStart}s - ${expectedEnd}s)`);
    } else {
      console.log(`   ⚠️  Frames may be outside expected range`);
      console.log(`      Expected: ${expectedStart}s - ${expectedEnd}s`);
      console.log(`      Actual: ${firstTime.toFixed(3)}s - ${lastTime.toFixed(3)}s`);
    }
    
    // Create summary HTML
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <title>GIF Frame Extraction Verification</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 40px; background: #f5f5f5; }
    h1 { color: #333; }
    .summary { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 20px; }
    .stat { display: inline-block; margin: 10px 20px 10px 0; }
    .stat-value { font-size: 24px; font-weight: bold; color: #4CAF50; }
    .stat-label { font-size: 12px; color: #666; }
    .frames { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 15px; }
    .frame { background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .frame img { width: 100%; display: block; }
    .frame-info { padding: 10px; font-size: 12px; background: #333; color: white; }
    .status { padding: 10px 15px; border-radius: 5px; display: inline-block; margin: 10px 0; }
    .status.success { background: #4CAF50; color: white; }
    .status.warning { background: #ff9800; color: white; }
  </style>
</head>
<body>
  <h1>🎬 GIF Frame Extraction Report</h1>
  
  <div class="summary">
    <h2>Extraction Summary</h2>
    <div class="status ${inRange ? 'success' : 'warning'}">
      ${inRange ? '✅ Frames extracted from correct video segment' : '⚠️ Check frame timing'}
    </div>
    
    <div style="margin-top: 20px;">
      <div class="stat">
        <div class="stat-value">${capturedFrames.length}</div>
        <div class="stat-label">Total Frames</div>
      </div>
      <div class="stat">
        <div class="stat-value">${duration.toFixed(1)}s</div>
        <div class="stat-label">Duration</div>
      </div>
      <div class="stat">
        <div class="stat-value">${(capturedFrames.length / duration).toFixed(1)}</div>
        <div class="stat-label">FPS</div>
      </div>
      <div class="stat">
        <div class="stat-value">${capturedFrames[0].width}×${capturedFrames[0].height}</div>
        <div class="stat-label">Resolution</div>
      </div>
    </div>
    
    <p><strong>Time Range:</strong> ${firstTime.toFixed(3)}s - ${lastTime.toFixed(3)}s</p>
    <p><strong>Expected Range:</strong> ${expectedStart}s - ${expectedEnd}s</p>
  </div>
  
  <h2>Sample Frames (First 10)</h2>
  <div class="frames">
    ${capturedFrames.slice(0, 10).map(frame => `
      <div class="frame">
        <img src="frame_${String(frame.frameNumber).padStart(3, '0')}_at_${frame.videoTime.toFixed(3)}s.png" alt="Frame ${frame.frameNumber}">
        <div class="frame-info">
          Frame ${frame.frameNumber} @ ${frame.videoTime.toFixed(3)}s
        </div>
      </div>
    `).join('')}
  </div>
</body>
</html>`;
    
    fs.writeFileSync(path.join(outputPath, 'verification-report.html'), htmlContent);
    
    console.log(`\n   📁 Frames saved to: ${outputPath}`);
    console.log(`   📄 Open verification-report.html to view the frames`);
    
    // Try to open the report
    try {
      require('child_process').exec(`open "${path.join(outputPath, 'verification-report.html')}"`);
      console.log('   🌐 Opening report in browser...');
    } catch (e) {
      // Ignore if can't open
    }
    
  } else {
    console.log('\n❌ No frames were captured. This might indicate an issue with frame extraction.');
  }
  
  console.log('\n✨ Test complete!');
  await browser.close();
  process.exit(0);
})();