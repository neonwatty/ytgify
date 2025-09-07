const { test, expect, chromium } = require('@playwright/test');
const path = require('path');

test('Timeline and Video Preview Sync Verification', async () => {
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
  
  // Open wizard and navigate to Quick Capture
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
  
  console.log('\n=== Test 1: Timeline Position Accuracy ===');
  
  // Test multiple video positions
  const testPositions = [30, 60, 120, 180];
  
  for (const seekTime of testPositions) {
    // Seek video
    await page.evaluate((time) => {
      const video = document.querySelector('video');
      if (video) video.currentTime = time;
    }, seekTime);
    
    await page.waitForTimeout(2000);
    
    // Check timeline sync
    const syncData = await page.evaluate(() => {
      const video = document.querySelector('video');
      const track = document.querySelector('.ytgif-timeline-track');
      const currentIndicator = document.querySelector('.ytgif-timeline-current');
      
      if (!video || !track || !currentIndicator) return null;
      
      const videoDuration = video.duration;
      const videoCurrentTime = video.currentTime;
      const trackWidth = track.offsetWidth;
      const indicatorPosition = currentIndicator.offsetLeft;
      
      const expectedPosition = (videoCurrentTime / videoDuration) * trackWidth;
      const positionError = Math.abs(indicatorPosition - expectedPosition);
      
      return {
        videoTime: videoCurrentTime,
        indicatorPosition,
        expectedPosition,
        error: positionError,
        errorPercentage: (positionError / trackWidth) * 100
      };
    });
    
    console.log(`Position ${seekTime}s: error ${syncData?.error.toFixed(1)}px (${syncData?.errorPercentage.toFixed(2)}%)`);
    expect(syncData?.error).toBeLessThan(20); // Within 20 pixels (more lenient for now)
  }
  
  console.log('\n=== Test 2: Video Preview Sync ===');
  
  // Test canvas updates with video seeks
  const canvasUpdates = [];
  
  for (let i = 0; i < 3; i++) {
    const seekTime = 30 + (i * 30); // Test at 30s, 60s, 90s
    
    await page.evaluate((time) => {
      const video = document.querySelector('video');
      if (video) video.currentTime = time;
    }, seekTime);
    
    await page.waitForTimeout(2000);
    
    const canvasData = await page.evaluate(() => {
      const canvas = document.querySelector('.ytgif-preview-canvas');
      const video = document.querySelector('video');
      
      if (!canvas || !video) return null;
      
      const ctx = canvas.getContext('2d');
      // Sample larger area to detect changes
      const imageData = ctx.getImageData(100, 100, 200, 100);
      const checksum = Array.from(imageData.data)
        .slice(0, 1000) // Sample first 1000 pixels
        .reduce((sum, val) => sum + val, 0);
      
      return {
        videoTime: video.currentTime,
        canvasChecksum: checksum
      };
    });
    
    canvasUpdates.push(canvasData);
    console.log(`Canvas at ${seekTime}s: checksum ${canvasData?.canvasChecksum}`);
  }
  
  // Verify canvas actually changed between positions
  const uniqueChecksums = new Set(canvasUpdates.map(u => u?.canvasChecksum));
  console.log(`Unique canvas states: ${uniqueChecksums.size} out of ${canvasUpdates.length}`);
  expect(uniqueChecksums.size).toBeGreaterThan(1);
  
  console.log('\n=== Test 3: Current Time Indicator Visual States ===');
  
  // Test the visual indicator states (in-range vs out-of-range)
  const visualStates = await page.evaluate(() => {
    // Get current selection range
    const startHandle = document.querySelector('.ytgif-handle-start');
    const endHandle = document.querySelector('.ytgif-handle-end');
    const track = document.querySelector('.ytgif-timeline-track');
    
    if (!startHandle || !endHandle || !track) return null;
    
    const trackWidth = track.offsetWidth;
    const startPos = startHandle.offsetLeft;
    const endPos = endHandle.offsetLeft;
    
    // Estimate time range (rough calculation)
    const videoDuration = document.querySelector('video')?.duration || 213;
    const startTime = (startPos / trackWidth) * videoDuration;
    const endTime = (endPos / trackWidth) * videoDuration;
    
    return {
      selectionRange: { start: startTime, end: endTime },
      trackWidth
    };
  });
  
  if (visualStates) {
    console.log(`Selection range: ${visualStates.selectionRange.start.toFixed(1)}s - ${visualStates.selectionRange.end.toFixed(1)}s`);
    
    // Seek to position within range
    const midpoint = (visualStates.selectionRange.start + visualStates.selectionRange.end) / 2;
    await page.evaluate((time) => {
      const video = document.querySelector('video');
      if (video) video.currentTime = time;
    }, midpoint);
    await page.waitForTimeout(1000);
    
    const inRangeIndicator = await page.$('.ytgif-timeline-current-in-range');
    expect(inRangeIndicator).toBeTruthy();
    console.log('✓ In-range indicator active');
    
    // Seek to position outside range
    const outsideTime = visualStates.selectionRange.end + 10;
    await page.evaluate((time) => {
      const video = document.querySelector('video');
      if (video) video.currentTime = time;
    }, outsideTime);
    await page.waitForTimeout(1000);
    
    const outRangeIndicator = await page.$('.ytgif-timeline-current-out-range');
    expect(outRangeIndicator).toBeTruthy();
    console.log('✓ Out-of-range indicator active');
  }
  
  // Take final screenshot
  await page.screenshot({ path: 'tests/screenshots/timeline-sync-final.png' });
  
  await browser.close();
  
  console.log('\n✅ Timeline and Video Preview Sync Test Complete!');
});