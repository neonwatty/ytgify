const { test, expect, chromium } = require('@playwright/test');
const path = require('path');

test('Video Preview Independence - Main video should not be affected by preview', async () => {
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
  
  // Capture console logs related to video preview
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('VideoPreview') || text.includes('preview video')) {
      console.log(`[${msg.type()}]`, text);
    }
  });
  
  console.log('\n=== Loading YouTube ===');
  await page.goto('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  await page.waitForSelector('.html5-video-player', { timeout: 10000 });
  
  // Wait for video to be ready and note initial state
  await page.waitForTimeout(3000);
  
  // Get initial main video state
  const initialVideoState = await page.evaluate(() => {
    const video = document.querySelector('video');
    return {
      currentTime: video?.currentTime,
      paused: video?.paused,
      volume: video?.volume,
      playbackRate: video?.playbackRate
    };
  });
  console.log('Initial main video state:', initialVideoState);
  
  // Click GIF button to open wizard
  const button = await page.waitForSelector('.ytgif-button', { timeout: 10000 });
  console.log('\n=== Opening Wizard ===');
  await button.click();
  await page.waitForTimeout(2000);
  
  // Navigate to Quick Capture screen
  // Check initial screen
  let currentScreen = await page.evaluate(() => {
    const screens = [
      '.ytgif-welcome-screen',
      '.ytgif-action-screen',
      '.ytgif-quick-capture-screen',
      '.ytgif-custom-range-screen',
      '.ytgif-processing-screen',
      '.ytgif-success-screen'
    ];
    
    for (const selector of screens) {
      const el = document.querySelector(selector);
      if (el && window.getComputedStyle(el).display !== 'none') {
        return selector.replace('.ytgif-', '').replace('-screen', '');
      }
    }
    return 'unknown';
  });
  
  console.log('Initial screen:', currentScreen);
  
  // If on welcome screen, click Get Started
  if (currentScreen === 'welcome') {
    const getStarted = await page.$('button:has-text("Get Started")');
    if (getStarted) {
      await getStarted.click();
      await page.waitForTimeout(1000);
      
      // Check what screen we're on after clicking Get Started
      currentScreen = await page.evaluate(() => {
        const screens = [
          '.ytgif-welcome-screen',
          '.ytgif-action-screen',
          '.ytgif-quick-capture-screen'
        ];
        
        for (const selector of screens) {
          const el = document.querySelector(selector);
          if (el && window.getComputedStyle(el).display !== 'none') {
            return selector.replace('.ytgif-', '').replace('-screen', '');
          }
        }
        return 'unknown';
      });
      console.log('After Get Started, screen:', currentScreen);
    }
  }
  
  // Should be on action screen - click Quick Capture
  const quickCaptureBtn = await page.$('button:has-text("Quick Capture")');
  if (!quickCaptureBtn) {
    // Debug: log all buttons
    const allButtons = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('button')).map(btn => btn.textContent?.trim()).filter(Boolean);
    });
    console.log('All buttons found:', allButtons);
    
    // Try different selector for Quick Capture
    const altQuickCaptureBtn = await page.$('button[class*="quick"]');
    if (altQuickCaptureBtn) {
      console.log('Found Quick Capture button with alt selector');
      await altQuickCaptureBtn.click();
    } else {
      throw new Error('Quick Capture button not found');
    }
  } else {
    console.log('Found Quick Capture button');
    await quickCaptureBtn.click();
  }
  await page.waitForTimeout(1500);
  
  console.log('\n=== Testing Video Independence ===');
  
  // Wait for preview video to be ready
  await page.waitForTimeout(2000);
  
  // Check that preview video element exists and is separate
  const videoSeparation = await page.evaluate(() => {
    const mainVideo = document.querySelector('#movie_player video');
    const previewVideos = Array.from(document.querySelectorAll('video')).filter(v => 
      v !== mainVideo && 
      v.style.position === 'absolute' && 
      v.style.left === '-9999px'
    );
    
    return {
      mainVideoExists: !!mainVideo,
      previewVideoCount: previewVideos.length,
      previewVideoReady: previewVideos.length > 0 ? previewVideos[0].readyState >= 2 : false,
      mainVideoId: mainVideo?.id || 'no-id',
      previewVideoSrc: previewVideos.length > 0 ? previewVideos[0].src.substring(0, 50) + '...' : 'none'
    };
  });
  
  console.log('Video separation check:', videoSeparation);
  expect(videoSeparation.mainVideoExists).toBeTruthy();
  expect(videoSeparation.previewVideoCount).toBeGreaterThan(0);
  
  // Test preview playback without affecting main video
  const playButton = await page.$('.ytgif-preview-control-btn');
  if (playButton) {
    console.log('\n=== Testing Preview Playback ===');
    
    // Get main video state before preview playback
    const beforePlayback = await page.evaluate(() => {
      const video = document.querySelector('#movie_player video');
      return {
        currentTime: video?.currentTime,
        paused: video?.paused
      };
    });
    
    // Start preview playback
    await playButton.click();
    await page.waitForTimeout(2000);
    
    // Get main video state after preview playback
    const afterPlayback = await page.evaluate(() => {
      const video = document.querySelector('#movie_player video');
      return {
        currentTime: video?.currentTime,
        paused: video?.paused
      };
    });
    
    console.log('Main video before preview:', beforePlayback);
    console.log('Main video after preview:', afterPlayback);
    
    // Main video should be unaffected by preview playback
    const timeDifference = Math.abs(afterPlayback.currentTime - beforePlayback.currentTime);
    console.log('Time difference:', timeDifference);
    
    // Allow some tolerance for natural video progression
    expect(timeDifference).toBeLessThan(0.5); // Less than 500ms difference
    console.log('✓ Main video time not significantly affected by preview');
    
    // Stop preview playback
    await playButton.click();
  }
  
  // Test timeline scrubbing without affecting main video
  const timelineHandle = await page.$('.ytgif-handle-end');
  if (timelineHandle) {
    console.log('\n=== Testing Timeline Scrubbing ===');
    
    // Get main video state before scrubbing
    const beforeScrub = await page.evaluate(() => {
      const video = document.querySelector('#movie_player video');
      return {
        currentTime: video?.currentTime,
        paused: video?.paused
      };
    });
    
    // Drag the timeline handle
    const box = await timelineHandle.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x - 100, box.y + box.height / 2);
    await page.mouse.up();
    await page.waitForTimeout(1000);
    
    // Get main video state after scrubbing
    const afterScrub = await page.evaluate(() => {
      const video = document.querySelector('#movie_player video');
      return {
        currentTime: video?.currentTime,
        paused: video?.paused
      };
    });
    
    console.log('Main video before scrub:', beforeScrub);
    console.log('Main video after scrub:', afterScrub);
    
    // Main video should be unaffected by timeline scrubbing
    const scrubTimeDifference = Math.abs(afterScrub.currentTime - beforeScrub.currentTime);
    console.log('Scrub time difference:', scrubTimeDifference);
    
    expect(scrubTimeDifference).toBeLessThan(0.5);
    console.log('✓ Main video not affected by timeline scrubbing');
  }
  
  // Final verification that preview system is working
  const finalCheck = await page.evaluate(() => {
    const canvas = document.querySelector('.ytgif-preview-canvas');
    const ctx = canvas?.getContext('2d');
    const imageData = ctx?.getImageData(0, 0, 10, 10);
    const hasContent = imageData?.data.some(pixel => pixel > 0);
    
    return {
      canvasExists: !!canvas,
      canvasHasContent: hasContent,
      canvasSize: canvas ? { width: canvas.width, height: canvas.height } : null
    };
  });
  
  console.log('\n=== Final Verification ===');
  console.log('Canvas check:', finalCheck);
  expect(finalCheck.canvasExists).toBeTruthy();
  expect(finalCheck.canvasHasContent).toBeTruthy();
  
  await page.screenshot({ path: 'tests/screenshots/video-separation-test.png' });
  
  await browser.close();
  
  console.log('\n✅ Video separation test completed successfully!');
});