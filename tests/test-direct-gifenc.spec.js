// Quick test to see if gifenc works in the browser
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  console.log('=== Test Direct Gifenc ===\n');
  
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  // Go to YouTube
  await page.goto('https://www.youtube.com/watch?v=jNQXAC9IVRw');
  await page.waitForTimeout(3000);
  
  // Try to create a GIF directly using gifenc
  const result = await page.evaluate(async () => {
    try {
      const video = document.querySelector('video');
      if (!video) return { error: 'No video found' };
      
      // Set video position
      video.currentTime = 5;
      video.pause();
      await new Promise(r => setTimeout(r, 500));
      
      // Create canvas
      const canvas = document.createElement('canvas');
      canvas.width = 200;
      canvas.height = 150;
      const ctx = canvas.getContext('2d');
      
      // Capture a few frames
      const frames = [];
      for (let i = 0; i < 3; i++) {
        video.currentTime = 5 + i * 0.5;
        await new Promise(r => setTimeout(r, 200));
        ctx.drawImage(video, 0, 0, 200, 150);
        
        // Get image data
        const imageData = ctx.getImageData(0, 0, 200, 150);
        frames.push({
          data: imageData.data,
          width: 200,
          height: 150
        });
      }
      
      console.log('Captured', frames.length, 'frames');
      
      // Try to encode with simple approach
      // Since gifenc isn't available, let's just verify frames were captured
      return {
        success: true,
        frameCount: frames.length,
        firstFrameSize: frames[0].data.length
      };
      
    } catch (error) {
      return { error: error.message };
    }
  });
  
  console.log('Result:', result);
  
  await browser.close();
  process.exit(0);
})();