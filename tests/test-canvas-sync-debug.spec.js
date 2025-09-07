const { test, expect, chromium } = require('@playwright/test');
const path = require('path');

test('Debug Canvas Sync Specific Issue', async () => {
  test.setTimeout(120000);
  
  const extensionPath = path.join(__dirname, '..', 'dist');
  console.log('Loading extension from:', extensionPath);
  
  const browser = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--no-sandbox'
    ]
  });
  
  const page = await browser.newPage();
  
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('VideoPreview') || text.includes('drawFrame') || 
        text.includes('timeupdate') || text.includes('seeked')) {
      console.log(`[${msg.type()}]`, text);
    }
  });
  
  console.log('\n=== Loading YouTube ===');
  await page.goto('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  await page.waitForSelector('.html5-video-player', { timeout: 10000 });
  await page.waitForTimeout(3000);
  
  // Open wizard and get to Quick Capture
  const gifButton = await page.waitForSelector('.ytgif-button');
  await gifButton.click();
  await page.waitForTimeout(2000);
  
  const getStarted = await page.$('button:has-text("Get Started")');
  if (getStarted && await getStarted.isVisible()) {
    await getStarted.click();
    await page.waitForTimeout(1000);
  }
  
  const quickCaptureBtn = await page.$('button:has-text("Quick Capture")');
  await quickCaptureBtn.click();
  await page.waitForTimeout(1500);
  
  console.log('\n=== Testing Canvas Update ===');
  
  // Get initial canvas state
  const initialCanvasData = await page.evaluate(() => {
    const canvas = document.querySelector('.ytgif-preview-canvas');
    if (!canvas) return null;
    
    const ctx = canvas.getContext('2d');
    // Get a larger sample to detect changes
    const imageData = ctx.getImageData(50, 50, 100, 100);
    const sum = Array.from(imageData.data).reduce((acc, val) => acc + val, 0);
    
    return {
      sum,
      width: canvas.width,
      height: canvas.height,
      timestamp: Date.now()
    };
  });
  
  console.log('Initial canvas state:', initialCanvasData);
  
  // Seek video to a different position
  console.log('Seeking video to 60 seconds...');
  await page.evaluate(() => {
    const video = document.querySelector('video');
    if (video) {
      console.log('About to seek video to 60s, current time:', video.currentTime);
      video.currentTime = 60;
    }
  });
  
  // Wait for seek to complete
  await page.waitForTimeout(3000);
  
  // Check if canvas updated
  const updatedCanvasData = await page.evaluate(() => {
    const canvas = document.querySelector('.ytgif-preview-canvas');
    if (!canvas) return null;
    
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(50, 50, 100, 100);
    const sum = Array.from(imageData.data).reduce((acc, val) => acc + val, 0);
    
    return {
      sum,
      width: canvas.width,
      height: canvas.height,
      timestamp: Date.now()
    };
  });
  
  console.log('Updated canvas state:', updatedCanvasData);
  console.log('Canvas changed:', initialCanvasData?.sum !== updatedCanvasData?.sum);
  console.log('Difference:', Math.abs(initialCanvasData?.sum - updatedCanvasData?.sum));
  
  // Check video element directly
  const videoState = await page.evaluate(() => {
    const video = document.querySelector('video');
    return {
      currentTime: video?.currentTime,
      duration: video?.duration,
      readyState: video?.readyState
    };
  });
  console.log('Video state after seek:', videoState);
  
  // Try manual drawFrame call
  console.log('\n=== Testing Manual Draw ===');
  const manualDrawResult = await page.evaluate(() => {
    const canvas = document.querySelector('.ytgif-preview-canvas');
    const video = document.querySelector('video');
    
    if (canvas && video) {
      try {
        const ctx = canvas.getContext('2d');
        console.log('Drawing video frame to canvas...');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Get checksum after manual draw
        const imageData = ctx.getImageData(50, 50, 100, 100);
        const sum = Array.from(imageData.data).reduce((acc, val) => acc + val, 0);
        
        return { success: true, sum };
      } catch (error) {
        return { success: false, error: error.message };
      }
    }
    return { success: false, error: 'No canvas or video' };
  });
  
  console.log('Manual draw result:', manualDrawResult);
  
  // Take screenshot for visual inspection
  await page.screenshot({ path: 'tests/screenshots/canvas-sync-debug.png' });
  
  await browser.close();
});