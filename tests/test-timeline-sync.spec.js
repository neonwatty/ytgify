const { test, expect, chromium } = require('@playwright/test');
const path = require('path');

test('Debug Timeline Sync with YouTube Video', async () => {
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
  
  console.log('\n=== Loading YouTube ===');
  await page.goto('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  await page.waitForSelector('.html5-video-player', { timeout: 10000 });
  await page.waitForTimeout(3000);
  
  // Get initial video state
  const initialVideoState = await page.evaluate(() => {
    const video = document.querySelector('video');
    return {
      duration: video?.duration,
      currentTime: video?.currentTime,
      paused: video?.paused
    };
  });
  console.log('Initial video state:', initialVideoState);
  
  // Seek video to a specific position (e.g., 30 seconds)
  console.log('\n=== Seeking Video to 30s ===');
  await page.evaluate(() => {
    const video = document.querySelector('video');
    if (video) {
      video.currentTime = 30;
    }
  });
  
  await page.waitForTimeout(2000); // Wait for seek
  
  const videoAfterSeek = await page.evaluate(() => {
    const video = document.querySelector('video');
    return {
      currentTime: video?.currentTime,
      duration: video?.duration
    };
  });
  console.log('Video after seek:', videoAfterSeek);
  
  // Open wizard
  console.log('\n=== Opening Wizard ===');
  const gifButton = await page.waitForSelector('.ytgif-button');
  await gifButton.click();
  await page.waitForTimeout(2000);
  
  // Navigate to Quick Capture
  const getStarted = await page.$('button:has-text("Get Started")');
  if (getStarted) {
    const isVisible = await getStarted.isVisible();
    if (isVisible) {
      await getStarted.click();
      await page.waitForTimeout(1000);
    }
  }
  
  const quickCaptureBtn = await page.$('button:has-text("Quick Capture")');
  await quickCaptureBtn.click();
  await page.waitForTimeout(1500);
  
  // Check timeline sync
  console.log('\n=== Checking Timeline Sync ===');
  
  const timelineData = await page.evaluate(() => {
    // Get timeline scrubber data
    const scrubber = document.querySelector('.ytgif-timeline-scrubber');
    const currentTimeIndicator = document.querySelector('.ytgif-timeline-current');
    const selectionDuration = document.querySelector('.ytgif-selection-duration');
    const timeLabels = document.querySelector('.ytgif-timeline-labels');
    
    // Get video element
    const video = document.querySelector('video');
    
    // Get timeline width and current position
    const track = document.querySelector('.ytgif-timeline-track');
    const trackWidth = track?.offsetWidth;
    const currentIndicatorPosition = currentTimeIndicator?.offsetLeft;
    
    // Calculate expected position based on video time
    const videoDuration = video?.duration || 0;
    const videoCurrentTime = video?.currentTime || 0;
    const expectedPosition = (videoCurrentTime / videoDuration) * trackWidth;
    
    return {
      video: {
        duration: videoDuration,
        currentTime: videoCurrentTime
      },
      timeline: {
        trackWidth,
        currentIndicatorPosition,
        expectedPosition,
        positionDifference: Math.abs(currentIndicatorPosition - expectedPosition)
      },
      ui: {
        selectionText: selectionDuration?.textContent,
        timeLabelsText: timeLabels?.textContent
      }
    };
  });
  
  console.log('Timeline sync analysis:', timelineData);
  
  // Check if positions match (within 5px tolerance)
  const positionMatch = timelineData.timeline.positionDifference < 5;
  console.log('Position match (within 5px):', positionMatch);
  console.log('Position difference:', timelineData.timeline.positionDifference, 'px');
  
  // Test seeking via timeline
  console.log('\n=== Testing Timeline Seek ===');
  
  const timelineTrack = await page.$('.ytgif-timeline-track');
  if (timelineTrack) {
    const box = await timelineTrack.boundingBox();
    // Click at 25% position (should be around 25% of video duration)
    const clickX = box.x + (box.width * 0.25);
    const clickY = box.y + (box.height * 0.5);
    
    console.log('Clicking timeline at 25% position');
    await page.mouse.click(clickX, clickY);
    await page.waitForTimeout(1000);
    
    // Check if video seeked to expected position
    const afterTimelineClick = await page.evaluate(() => {
      const video = document.querySelector('video');
      return {
        currentTime: video?.currentTime,
        expectedTime: (video?.duration || 0) * 0.25
      };
    });
    
    console.log('After timeline click:', afterTimelineClick);
    console.log('Seek accuracy:', Math.abs(afterTimelineClick.currentTime - afterTimelineClick.expectedTime), 'seconds');
  }
  
  // Test preview canvas sync
  console.log('\n=== Testing Preview Canvas Sync ===');
  
  // Get canvas content before and after video seek
  const canvasDataBefore = await page.evaluate(() => {
    const canvas = document.querySelector('.ytgif-preview-canvas');
    if (!canvas) return null;
    
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, 10, 10);
    const checksum = Array.from(imageData.data).slice(0, 20).reduce((sum, val) => sum + val, 0);
    
    return { checksum, time: Date.now() };
  });
  
  // Seek video to different position
  await page.evaluate(() => {
    const video = document.querySelector('video');
    if (video) video.currentTime = 60; // Seek to 1 minute
  });
  
  await page.waitForTimeout(2000);
  
  const canvasDataAfter = await page.evaluate(() => {
    const canvas = document.querySelector('.ytgif-preview-canvas');
    if (!canvas) return null;
    
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, 10, 10);
    const checksum = Array.from(imageData.data).slice(0, 20).reduce((sum, val) => sum + val, 0);
    
    return { checksum, time: Date.now() };
  });
  
  console.log('Canvas sync test:');
  console.log('Before seek checksum:', canvasDataBefore?.checksum);
  console.log('After seek checksum:', canvasDataAfter?.checksum);
  console.log('Canvas updated:', canvasDataBefore?.checksum !== canvasDataAfter?.checksum);
  
  await page.screenshot({ path: 'tests/screenshots/timeline-sync-debug.png' });
  
  await browser.close();
  
  console.log('\n=== Timeline Sync Investigation Complete ===');
});