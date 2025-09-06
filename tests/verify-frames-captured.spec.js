const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  console.log('=== Frame Capture Verification Test ===\n');
  console.log('This test will capture frames and save them as images for visual verification.\n');
  
  const extensionPath = path.join(process.cwd(), 'dist');
  const outputPath = path.join(process.cwd(), 'tests', 'captured-frames');
  
  // Create output directory for frames
  if (!fs.existsSync(outputPath)) {
    fs.mkdirSync(outputPath, { recursive: true });
  }
  // Clean existing frames
  fs.readdirSync(outputPath).forEach(file => {
    if (file.endsWith('.png')) {
      fs.unlinkSync(path.join(outputPath, file));
    }
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
  
  // Inject frame capture interceptor
  await page.addInitScript(() => {
    console.log('[TEST] Injecting frame capture interceptor...');
    
    // Store original drawImage function
    const originalDrawImage = CanvasRenderingContext2D.prototype.drawImage;
    let frameCounter = 0;
    
    // Override drawImage to capture frames
    CanvasRenderingContext2D.prototype.drawImage = function(...args) {
      // Call original function
      originalDrawImage.apply(this, args);
      
      // If drawing from video element, capture the frame
      if (args[0] instanceof HTMLVideoElement) {
        frameCounter++;
        const video = args[0];
        const canvas = this.canvas;
        
        // Log frame capture details
        console.log(`[FRAME_CAPTURE] Frame ${frameCounter} captured at video time: ${video.currentTime.toFixed(3)}s`);
        
        // Store frame data for retrieval
        if (!window.__capturedFrames) {
          window.__capturedFrames = [];
        }
        
        // Convert canvas to data URL
        const dataUrl = canvas.toDataURL('image/png');
        window.__capturedFrames.push({
          frameNumber: frameCounter,
          videoTime: video.currentTime,
          width: canvas.width,
          height: canvas.height,
          dataUrl: dataUrl
        });
        
        // Dispatch custom event with frame data
        window.dispatchEvent(new CustomEvent('frameCapture', {
          detail: {
            frameNumber: frameCounter,
            videoTime: video.currentTime,
            width: canvas.width,
            height: canvas.height
          }
        }));
      }
    };
  });
  
  // Listen for frame capture events
  await page.addInitScript(() => {
    window.addEventListener('frameCapture', (e) => {
      console.log('[FRAME_EVENT]', JSON.stringify(e.detail));
    });
  });
  
  // Track frame captures
  const capturedFrames = [];
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[FRAME_CAPTURE]')) {
      const match = text.match(/Frame (\d+) captured at video time: ([\d.]+)s/);
      if (match) {
        capturedFrames.push({
          frame: parseInt(match[1]),
          time: parseFloat(match[2])
        });
      }
      console.log(text);
    }
  });
  
  // STEP 1: Navigate to YouTube
  console.log('1. Opening YouTube video (\"Me at the zoo\" - first YouTube video)...');
  await page.goto('https://www.youtube.com/watch?v=jNQXAC9IVRw');
  await page.waitForTimeout(3000);
  
  // STEP 2: Set video to specific time
  console.log('2. Setting video to 5 seconds (elephant scene)...');
  const videoInfo = await page.evaluate(() => {
    const video = document.querySelector('video');
    if (video) {
      video.currentTime = 5;
      video.pause(); // Pause to ensure stable frame
      return {
        duration: video.duration,
        currentTime: video.currentTime,
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
        title: document.title
      };
    }
  });
  console.log('   Video info:', videoInfo);
  await page.waitForTimeout(1000);
  
  // STEP 3: Activate GIF mode
  console.log('\n3. Clicking GIF button to open timeline overlay...');
  await page.click('.ytgif-button');
  await page.waitForSelector('#ytgif-timeline-overlay', { timeout: 5000 });
  
  // STEP 4: Check selection range
  const selectionInfo = await page.evaluate(() => {
    const rangeText = document.querySelector('.ytgif-timeline-range');
    return {
      range: rangeText?.textContent,
      startTime: document.querySelector('#gif-start')?.value,
      endTime: document.querySelector('#gif-end')?.value
    };
  });
  console.log('4. Current selection:', selectionInfo);
  
  // STEP 5: Start GIF creation
  console.log('\n5. Starting GIF creation (this will capture frames)...\n');
  await page.click('.ytgif-timeline-create');
  
  // Wait for frame capture to complete
  await page.waitForTimeout(5000); // Give time for initial frame captures
  
  // Continue waiting while frames are being captured
  let lastFrameCount = 0;
  let stableCount = 0;
  while (stableCount < 3) {
    await page.waitForTimeout(1000);
    if (capturedFrames.length === lastFrameCount) {
      stableCount++;
    } else {
      stableCount = 0;
      lastFrameCount = capturedFrames.length;
    }
  }
  
  console.log(`\n6. Frame capture complete. Total frames: ${capturedFrames.length}`);
  
  // STEP 6: Retrieve and save captured frames
  console.log('\n7. Retrieving captured frame data...');
  const frameData = await page.evaluate(() => {
    return window.__capturedFrames || [];
  });
  
  console.log(`   Retrieved ${frameData.length} frames from page`);
  
  // STEP 7: Save frames as images
  if (frameData.length > 0) {
    console.log('\n8. Saving frames as PNG images...');
    
    // Save each frame
    for (let i = 0; i < frameData.length; i++) {
      const frame = frameData[i];
      const base64Data = frame.dataUrl.replace(/^data:image\/png;base64,/, '');
      const filename = `frame_${String(i + 1).padStart(3, '0')}_time_${frame.videoTime.toFixed(3)}s.png`;
      const filepath = path.join(outputPath, filename);
      
      fs.writeFileSync(filepath, base64Data, 'base64');
      console.log(`   Saved: ${filename} (${frame.width}x${frame.height})`);
    }
    
    // Create an HTML viewer
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <title>Captured Frames Verification</title>
  <style>
    body { 
      font-family: Arial, sans-serif; 
      max-width: 1200px; 
      margin: 0 auto; 
      padding: 20px;
      background: #f0f0f0;
    }
    h1 { color: #333; }
    .info { 
      background: white; 
      padding: 15px; 
      border-radius: 8px; 
      margin-bottom: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .frames-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
      gap: 20px;
      margin-top: 20px;
    }
    .frame-card {
      background: white;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .frame-card img {
      width: 100%;
      height: auto;
      display: block;
    }
    .frame-info {
      padding: 10px;
      background: #333;
      color: white;
      font-size: 12px;
    }
    .frame-number {
      font-weight: bold;
      color: #4CAF50;
    }
    .summary {
      background: #4CAF50;
      color: white;
      padding: 15px;
      border-radius: 8px;
      margin: 20px 0;
    }
    .timeline {
      background: white;
      padding: 20px;
      border-radius: 8px;
      margin: 20px 0;
    }
    .timeline-bar {
      width: 100%;
      height: 40px;
      background: linear-gradient(to right, #4CAF50 0%, #8BC34A 100%);
      border-radius: 4px;
      position: relative;
      margin: 10px 0;
    }
    .timeline-marker {
      position: absolute;
      top: -5px;
      width: 2px;
      height: 50px;
      background: #333;
    }
  </style>
</head>
<body>
  <h1>🎬 GIF Frame Capture Verification</h1>
  
  <div class="info">
    <h2>Test Information</h2>
    <p><strong>Video:</strong> ${videoInfo ? videoInfo.title : 'YouTube Video'}</p>
    <p><strong>Selection Range:</strong> ${selectionInfo.range || 'Unknown'}</p>
    <p><strong>Total Frames Captured:</strong> ${frameData.length}</p>
    <p><strong>Frame Rate:</strong> ${frameData.length > 1 ? 
      (frameData.length / (frameData[frameData.length-1].videoTime - frameData[0].videoTime)).toFixed(1) : 'N/A'} fps</p>
    <p><strong>Time Span:</strong> ${frameData.length > 0 ? 
      `${frameData[0].videoTime.toFixed(3)}s - ${frameData[frameData.length-1].videoTime.toFixed(3)}s` : 'N/A'}</p>
  </div>
  
  <div class="summary">
    <h3>✅ Verification Summary</h3>
    <p>${frameData.length > 0 ? 
      `Successfully captured ${frameData.length} frames from the video segment. Each frame represents a moment in the selected time range.` :
      'No frames were captured.'}</p>
  </div>
  
  <div class="timeline">
    <h3>📊 Frame Distribution Timeline</h3>
    <div class="timeline-bar">
      ${frameData.map((frame, i) => {
        const startTime = frameData[0].videoTime;
        const endTime = frameData[frameData.length-1].videoTime;
        const position = ((frame.videoTime - startTime) / (endTime - startTime)) * 100;
        return `<div class="timeline-marker" style="left: ${position}%" title="Frame ${i+1} at ${frame.videoTime.toFixed(3)}s"></div>`;
      }).join('')}
    </div>
  </div>
  
  <h2>📸 Captured Frames</h2>
  <div class="frames-grid">
    ${frameData.map((frame, i) => `
      <div class="frame-card">
        <img src="${'frame_' + String(i + 1).padStart(3, '0') + '_time_' + frame.videoTime.toFixed(3) + 's.png'}" 
             alt="Frame ${i + 1}" />
        <div class="frame-info">
          <span class="frame-number">Frame ${i + 1}</span> | 
          Time: ${frame.videoTime.toFixed(3)}s | 
          ${frame.width}x${frame.height}
        </div>
      </div>
    `).join('')}
  </div>
  
  <script>
    // Add hover effects
    document.querySelectorAll('.timeline-marker').forEach(marker => {
      marker.addEventListener('mouseenter', (e) => {
        e.target.style.background = '#ff0000';
        e.target.style.width = '4px';
      });
      marker.addEventListener('mouseleave', (e) => {
        e.target.style.background = '#333';
        e.target.style.width = '2px';
      });
    });
  </script>
</body>
</html>`;
    
    const htmlPath = path.join(outputPath, 'frame-verification.html');
    fs.writeFileSync(htmlPath, htmlContent);
    console.log(`\n✅ Created HTML viewer: ${htmlPath}`);
    
    // Analyze frame timing
    console.log('\n9. Frame Timing Analysis:');
    if (capturedFrames.length > 0) {
      const times = capturedFrames.map(f => f.time);
      const minTime = Math.min(...times);
      const maxTime = Math.max(...times);
      const duration = maxTime - minTime;
      
      console.log(`   First frame at: ${minTime.toFixed(3)}s`);
      console.log(`   Last frame at: ${maxTime.toFixed(3)}s`);
      console.log(`   Duration covered: ${duration.toFixed(3)}s`);
      console.log(`   Average interval: ${(duration / (capturedFrames.length - 1)).toFixed(3)}s`);
      
      // Check if frames are within selection range
      const expectedStart = parseFloat(selectionInfo.startTime || '3');
      const expectedEnd = parseFloat(selectionInfo.endTime || '7');
      
      console.log('\n10. Verification Results:');
      if (minTime >= expectedStart - 0.5 && maxTime <= expectedEnd + 0.5) {
        console.log('   ✅ Frames are within expected range');
      } else {
        console.log('   ⚠️ Some frames may be outside expected range');
      }
      console.log(`   Expected: ${expectedStart}s - ${expectedEnd}s`);
      console.log(`   Actual: ${minTime.toFixed(3)}s - ${maxTime.toFixed(3)}s`);
    }
    
    console.log(`\n📁 Frames saved in: ${outputPath}`);
    console.log('📄 Open frame-verification.html in a browser to view all captured frames');
  } else {
    console.log('\n❌ No frames were captured');
  }
  
  console.log('\n✨ Test complete!');
  await browser.close();
  
  // Open the HTML file in default browser if possible
  if (frameData.length > 0) {
    const htmlPath = path.join(outputPath, 'frame-verification.html');
    console.log('\nOpening frame viewer in browser...');
    require('child_process').exec(`open "${htmlPath}"` || `start "${htmlPath}"`);
  }
  
  process.exit(0);
})();