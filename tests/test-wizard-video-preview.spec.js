const { test, expect, chromium } = require('@playwright/test');
const path = require('path');

test('Wizard Video Preview and Timeline Scrubber', async () => {
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
  
  // Capture all logs
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('VideoPreview') || text.includes('TimelineScrubber') || 
        text.includes('QuickCapture')) {
      console.log(`[${msg.type()}]`, text);
    }
  });
  
  console.log('\n=== Loading YouTube ===');
  await page.goto('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  await page.waitForSelector('.html5-video-player', { timeout: 10000 });
  
  // Wait for video to be ready
  await page.waitForTimeout(3000);
  
  // Get video element details
  const videoDetails = await page.evaluate(() => {
    const video = document.querySelector('video');
    return {
      duration: video?.duration,
      currentTime: video?.currentTime,
      paused: video?.paused,
      width: video?.videoWidth,
      height: video?.videoHeight
    };
  });
  console.log('Video details:', videoDetails);
  
  // Click GIF button
  const button = await page.waitForSelector('.ytgif-button', { timeout: 10000 });
  console.log('\n=== Clicking GIF Button ===');
  await button.click();
  await page.waitForTimeout(2000);
  
  // Verify wizard overlay appeared
  const wizardOverlay = await page.$('#ytgif-wizard-overlay');
  expect(wizardOverlay).toBeTruthy();
  console.log('✓ Wizard overlay appeared');
  
  // Navigate to Quick Capture screen
  // Skip welcome if shown
  const welcomeScreen = await page.$('.ytgif-welcome-screen');
  if (welcomeScreen) {
    const getStarted = await page.$('button:has-text("Get Started")');
    if (getStarted) {
      await getStarted.click();
      await page.waitForTimeout(1000);
    }
  }
  
  // Click Quick Capture
  const quickCaptureBtn = await page.$('button:has-text("Quick Capture")');
  expect(quickCaptureBtn).toBeTruthy();
  console.log('\n=== Selecting Quick Capture ===');
  await quickCaptureBtn.click();
  await page.waitForTimeout(1500);
  
  // Check for video preview components
  const checkPreviewComponents = await page.evaluate(() => {
    const previewCanvas = document.querySelector('.ytgif-preview-canvas');
    const timeline = document.querySelector('.ytgif-timeline-scrubber');
    const playButton = document.querySelector('.ytgif-preview-control-btn');
    const durationPresets = document.querySelectorAll('.ytgif-preset-btn');
    const timelineHandles = document.querySelectorAll('.ytgif-timeline-handle');
    
    return {
      hasCanvas: !!previewCanvas,
      canvasSize: previewCanvas ? {
        width: previewCanvas.width,
        height: previewCanvas.height
      } : null,
      hasTimeline: !!timeline,
      hasPlayButton: !!playButton,
      presetCount: durationPresets.length,
      handleCount: timelineHandles.length,
      // Check if canvas has content
      canvasHasContent: previewCanvas ? (() => {
        const ctx = previewCanvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, 10, 10);
        return imageData.data.some(pixel => pixel > 0);
      })() : false
    };
  });
  
  console.log('\n=== Video Preview Components ===');
  console.log('Has canvas:', checkPreviewComponents.hasCanvas);
  console.log('Canvas size:', checkPreviewComponents.canvasSize);
  console.log('Canvas has content:', checkPreviewComponents.canvasHasContent);
  console.log('Has timeline scrubber:', checkPreviewComponents.hasTimeline);
  console.log('Has play button:', checkPreviewComponents.hasPlayButton);
  console.log('Duration preset buttons:', checkPreviewComponents.presetCount);
  console.log('Timeline handles:', checkPreviewComponents.handleCount);
  
  // Test timeline interaction
  if (checkPreviewComponents.hasTimeline) {
    console.log('\n=== Testing Timeline Interaction ===');
    
    // Try dragging the end handle
    const endHandle = await page.$('.ytgif-handle-end');
    if (endHandle) {
      const box = await endHandle.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x - 50, box.y + box.height / 2);
      await page.mouse.up();
      console.log('✓ Dragged end handle');
    }
    
    // Click a duration preset
    const presetBtn = await page.$('.ytgif-preset-btn');
    if (presetBtn) {
      await presetBtn.click();
      await page.waitForTimeout(500);
      console.log('✓ Clicked duration preset');
    }
  }
  
  // Test play button
  if (checkPreviewComponents.hasPlayButton) {
    console.log('\n=== Testing Preview Playback ===');
    
    const playBtn = await page.$('.ytgif-preview-control-btn');
    await playBtn.click();
    console.log('✓ Clicked play button');
    
    // Wait and check if preview is playing
    await page.waitForTimeout(2000);
    
    const isPlaying = await page.evaluate(() => {
      const playBtn = document.querySelector('.ytgif-preview-control-btn');
      return playBtn?.classList.contains('playing');
    });
    console.log('Is playing:', isPlaying);
    
    // Stop playback
    if (isPlaying) {
      await playBtn.click();
      console.log('✓ Stopped playback');
    }
  }
  
  // Take screenshot for visual verification
  await page.screenshot({ path: 'tests/screenshots/wizard-video-preview.png' });
  console.log('\n✓ Screenshot saved: wizard-video-preview.png');
  
  // Check the final time selection
  const finalSelection = await page.evaluate(() => {
    const startTime = document.querySelector('.ytgif-label-selection');
    const duration = document.querySelector('.ytgif-selection-duration');
    return {
      label: startTime?.textContent,
      duration: duration?.textContent
    };
  });
  console.log('\n=== Final Selection ===');
  console.log('Time range:', finalSelection.label);
  console.log('Duration:', finalSelection.duration);
  
  await browser.close();
  
  // Assertions
  expect(checkPreviewComponents.hasCanvas || checkPreviewComponents.hasTimeline).toBeTruthy();
  console.log('\n✅ Video preview components test completed!');
});