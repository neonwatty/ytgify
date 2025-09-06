const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  console.log('=== Saving Sample Frames from Video ===\n');
  
  const outputPath = path.join(process.cwd(), 'tests', 'sample-frames');
  
  // Create output directory
  if (!fs.existsSync(outputPath)) {
    fs.mkdirSync(outputPath, { recursive: true });
  }
  
  // Clean existing files
  fs.readdirSync(outputPath).forEach(file => {
    if (file.endsWith('.png') || file.endsWith('.html')) {
      fs.unlinkSync(path.join(outputPath, file));
    }
  });
  
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  console.log('1. Opening YouTube video...');
  await page.goto('https://www.youtube.com/watch?v=jNQXAC9IVRw');
  await page.waitForTimeout(3000);
  
  // Wait for video to load
  await page.waitForSelector('video');
  
  console.log('2. Capturing frames from different time points...\n');
  
  // Define time points to capture (simulating what the GIF creator does)
  const timePoints = [
    { time: 4.0, description: 'Start of typical GIF selection' },
    { time: 4.5, description: 'Half second in' },
    { time: 5.0, description: 'One second in (elephant visible)' },
    { time: 5.5, description: 'Mid-point' },
    { time: 6.0, description: 'Two seconds in' },
    { time: 6.5, description: 'Continuing action' },
    { time: 7.0, description: 'Three seconds in' },
    { time: 7.5, description: 'Near end' },
    { time: 8.0, description: 'End of typical 4-second GIF' }
  ];
  
  const capturedFrames = [];
  
  for (const point of timePoints) {
    console.log(`   Capturing frame at ${point.time}s: ${point.description}`);
    
    // Seek to time point and capture
    const frameData = await page.evaluate(async (targetTime) => {
      const video = document.querySelector('video');
      if (!video) return null;
      
      // Seek to target time
      video.currentTime = targetTime;
      
      // Wait for seek to complete
      await new Promise(resolve => {
        const checkTime = () => {
          if (Math.abs(video.currentTime - targetTime) < 0.1) {
            resolve();
          } else {
            setTimeout(checkTime, 100);
          }
        };
        checkTime();
      });
      
      // Wait a bit for frame to render
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Create canvas and capture frame
      const canvas = document.createElement('canvas');
      canvas.width = 480;  // Same as GIF encoder settings
      canvas.height = 360; // Same as GIF encoder settings
      const ctx = canvas.getContext('2d');
      
      // Calculate scaling to maintain aspect ratio
      const videoAspect = video.videoWidth / video.videoHeight;
      const canvasAspect = canvas.width / canvas.height;
      let drawWidth = canvas.width;
      let drawHeight = canvas.height;
      
      if (videoAspect > canvasAspect) {
        drawHeight = canvas.width / videoAspect;
      } else {
        drawWidth = canvas.height * videoAspect;
      }
      
      const x = (canvas.width - drawWidth) / 2;
      const y = (canvas.height - drawHeight) / 2;
      
      // Draw video frame to canvas
      ctx.drawImage(video, x, y, drawWidth, drawHeight);
      
      // Convert to data URL
      return {
        dataUrl: canvas.toDataURL('image/png'),
        actualTime: video.currentTime,
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight
      };
    }, point.time);
    
    if (frameData) {
      // Save frame as PNG
      const base64Data = frameData.dataUrl.replace(/^data:image\/png;base64,/, '');
      const filename = `frame_${point.time.toFixed(1)}s.png`;
      const filepath = path.join(outputPath, filename);
      fs.writeFileSync(filepath, base64Data, 'base64');
      
      capturedFrames.push({
        time: point.time,
        actualTime: frameData.actualTime,
        description: point.description,
        filename: filename
      });
      
      console.log(`      ✓ Saved: ${filename}`);
    }
  }
  
  console.log('\n3. Creating HTML viewer...');
  
  // Create HTML viewer
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <title>Sample Frames from YouTube Video</title>
  <style>
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
      max-width: 1200px; 
      margin: 0 auto; 
      padding: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
    }
    .container {
      background: white;
      border-radius: 16px;
      padding: 30px;
      box-shadow: 0 20px 40px rgba(0,0,0,0.1);
    }
    h1 { 
      color: #333; 
      margin-bottom: 10px;
    }
    .subtitle {
      color: #666;
      margin-bottom: 30px;
    }
    .info-box {
      background: #f8f9fa;
      border-left: 4px solid #667eea;
      padding: 15px;
      margin-bottom: 30px;
      border-radius: 4px;
    }
    .frames-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 25px;
      margin-top: 30px;
    }
    .frame-card {
      background: white;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      transition: transform 0.3s ease, box-shadow 0.3s ease;
    }
    .frame-card:hover {
      transform: translateY(-5px);
      box-shadow: 0 8px 24px rgba(0,0,0,0.15);
    }
    .frame-card img {
      width: 100%;
      height: auto;
      display: block;
    }
    .frame-info {
      padding: 15px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }
    .frame-time {
      font-size: 18px;
      font-weight: bold;
      margin-bottom: 5px;
    }
    .frame-description {
      font-size: 14px;
      opacity: 0.95;
    }
    .timeline {
      background: #f8f9fa;
      padding: 20px;
      border-radius: 8px;
      margin: 30px 0;
    }
    .timeline-bar {
      width: 100%;
      height: 60px;
      background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
      border-radius: 30px;
      position: relative;
      box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);
    }
    .timeline-point {
      position: absolute;
      top: 50%;
      transform: translate(-50%, -50%);
      width: 20px;
      height: 20px;
      background: white;
      border: 3px solid #333;
      border-radius: 50%;
      cursor: pointer;
      transition: transform 0.2s ease;
    }
    .timeline-point:hover {
      transform: translate(-50%, -50%) scale(1.3);
    }
    .timeline-labels {
      display: flex;
      justify-content: space-between;
      margin-top: 10px;
      font-size: 12px;
      color: #666;
    }
    .summary {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 20px;
      border-radius: 8px;
      margin-top: 30px;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🎬 Sample Frames from GIF Creation</h1>
    <p class="subtitle">These frames represent what gets captured during GIF creation</p>
    
    <div class="info-box">
      <strong>Video:</strong> "Me at the zoo" - The first YouTube video ever uploaded<br>
      <strong>Typical GIF Range:</strong> 4.0s - 8.0s (4-second duration)<br>
      <strong>Frame Resolution:</strong> 480×360 pixels<br>
      <strong>Sample Rate:</strong> Every 0.5 seconds (actual GIF uses 10 fps)
    </div>
    
    <div class="timeline">
      <h3>📍 Timeline Visualization</h3>
      <div class="timeline-bar">
        ${capturedFrames.map((frame, i) => {
          const position = ((frame.time - 4.0) / 4.0) * 100;
          return `<div class="timeline-point" style="left: ${position}%" title="${frame.time}s: ${frame.description}"></div>`;
        }).join('')}
      </div>
      <div class="timeline-labels">
        <span>4.0s (Start)</span>
        <span>6.0s (Middle)</span>
        <span>8.0s (End)</span>
      </div>
    </div>
    
    <h2>📸 Captured Frames</h2>
    <div class="frames-grid">
      ${capturedFrames.map(frame => `
        <div class="frame-card">
          <img src="${frame.filename}" alt="Frame at ${frame.time}s" />
          <div class="frame-info">
            <div class="frame-time">${frame.time.toFixed(1)} seconds</div>
            <div class="frame-description">${frame.description}</div>
          </div>
        </div>
      `).join('')}
    </div>
    
    <div class="summary">
      <h3>✅ What This Shows</h3>
      <p>These ${capturedFrames.length} frames demonstrate the video content that would be extracted<br>
      when creating a 4-second GIF from timestamp 4.0s to 8.0s.</p>
      <p style="margin-top: 15px; opacity: 0.9; font-size: 14px;">
      In actual GIF creation, 40+ frames would be captured (at 10 fps) for smooth animation.
      </p>
    </div>
  </div>
</body>
</html>`;
  
  const htmlPath = path.join(outputPath, 'frame-viewer.html');
  fs.writeFileSync(htmlPath, htmlContent);
  
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('✅ Sample frames successfully captured!');
  console.log('═══════════════════════════════════════════════════════\n');
  
  console.log(`📁 Frames saved to: ${outputPath}`);
  console.log(`📄 View them at: ${htmlPath}`);
  console.log('\nFiles created:');
  capturedFrames.forEach(frame => {
    console.log(`   • ${frame.filename} - ${frame.description}`);
  });
  console.log(`   • frame-viewer.html - Interactive viewer`);
  
  // Try to open the HTML file
  try {
    console.log('\n🌐 Opening viewer in browser...');
    require('child_process').exec(`open "${htmlPath}"`);
  } catch (e) {
    console.log('   (Open frame-viewer.html manually to see the frames)');
  }
  
  await browser.close();
  console.log('\n✨ Done!');
  process.exit(0);
})();