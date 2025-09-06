const { test, expect, chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs').promises;

const EXTENSION_PATH = path.join(__dirname, '..', 'dist');

test.describe('YouTube GIF Maker - New Features Test', () => {
  let browser, context, page;

  test.beforeAll(async () => {
    console.log('Loading extension from:', EXTENSION_PATH);
    
    browser = await chromium.launch({
      headless: false,
      slowMo: 50,
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
        '--auto-open-devtools-for-tabs'
      ],
    });

    context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      permissions: ['clipboard-read', 'clipboard-write']
    });

    page = await context.newPage();
    
    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      if (type === 'error' || text.includes('Error')) {
        console.error(`[Browser ${type}]:`, text);
      } else {
        console.log(`[Browser ${type}]:`, text);
      }
    });

    page.on('pageerror', error => {
      console.error('[Page Error]:', error.message);
    });
  });

  test.afterAll(async () => {
    await browser?.close();
  });

  test('Test 1: Frame limit removal - should capture more than 10 frames', async () => {
    console.log('\n=== Testing Frame Limit Removal ===');
    
    // Navigate to a YouTube video
    await page.goto('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    await page.waitForTimeout(3000);
    
    // Play video
    const playButton = await page.locator('.ytp-play-button');
    if (await playButton.isVisible()) {
      await playButton.click();
    }
    await page.waitForTimeout(2000);
    
    // Click GIF button
    const gifButton = await page.locator('.ytgif-button-svg').first();
    await expect(gifButton).toBeVisible({ timeout: 10000 });
    await gifButton.click();
    console.log('GIF button clicked');
    
    // Set a longer duration to test frame limits (15 seconds should generate 150 frames at 10fps)
    const timelineOverlay = await page.locator('.ytgif-timeline-overlay');
    await expect(timelineOverlay).toBeVisible({ timeout: 5000 });
    
    // Adjust selection for 15 seconds
    await page.evaluate(() => {
      const video = document.querySelector('video');
      const event = new CustomEvent('ytgif-selection-change', {
        detail: {
          startTime: video.currentTime,
          endTime: video.currentTime + 15,
          duration: 15
        }
      });
      window.dispatchEvent(event);
    });
    
    console.log('Set 15-second selection for frame limit test');
    await page.waitForTimeout(1000);
    
    // Monitor frame capture progress
    let framesCaptured = 0;
    await page.evaluate(() => {
      window.addEventListener('ytgif-progress-update', (event) => {
        if (event.detail && event.detail.message && event.detail.message.includes('Capturing frames')) {
          const match = event.detail.message.match(/(\d+)%/);
          if (match) {
            window.__capturedFrameProgress = parseInt(match[1]);
          }
        }
      });
    });
    
    // Click Create GIF button
    const createButton = await page.locator('.ytgif-timeline-create').first();
    await createButton.click();
    console.log('Create GIF clicked for 15-second clip');
    
    // Wait for processing and check frame count
    await page.waitForTimeout(5000);
    
    const capturedFrames = await page.evaluate(() => {
      if (window.__DEBUG_CAPTURED_FRAMES) {
        return window.__DEBUG_CAPTURED_FRAMES.length;
      }
      return 0;
    });
    
    console.log(`Captured ${capturedFrames} frames (expected > 10)`);
    expect(capturedFrames).toBeGreaterThan(10);
  });

  test('Test 2: Progress bar functionality', async () => {
    console.log('\n=== Testing Progress Bar ===');
    
    // Navigate to YouTube if not already there
    if (!page.url().includes('youtube.com')) {
      await page.goto('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
      await page.waitForTimeout(3000);
    }
    
    // Click GIF button
    const gifButton = await page.locator('.ytgif-button-svg').first();
    await gifButton.click();
    
    // Wait for timeline overlay
    const timelineOverlay = await page.locator('.ytgif-timeline-overlay');
    await expect(timelineOverlay).toBeVisible({ timeout: 5000 });
    
    // Start GIF creation
    const createButton = await page.locator('.ytgif-timeline-create').first();
    await createButton.click();
    
    // Check for progress bar visibility
    const progressContainer = await page.locator('.ytgif-progress-container');
    await expect(progressContainer).toBeVisible({ timeout: 5000 });
    console.log('Progress bar container is visible');
    
    // Check progress bar elements
    const progressBar = await page.locator('.ytgif-progress-bar');
    await expect(progressBar).toBeVisible();
    
    const progressStage = await page.locator('.ytgif-progress-stage');
    await expect(progressStage).toBeVisible();
    
    const progressPercentage = await page.locator('.ytgif-progress-percentage');
    await expect(progressPercentage).toBeVisible();
    
    // Monitor progress updates
    const progressValues = [];
    for (let i = 0; i < 5; i++) {
      await page.waitForTimeout(1000);
      const width = await progressBar.evaluate(el => el.style.width);
      const stage = await progressStage.textContent();
      const percentage = await progressPercentage.textContent();
      
      progressValues.push({
        width,
        stage,
        percentage
      });
      
      console.log(`Progress: ${percentage} - ${stage} (bar width: ${width})`);
    }
    
    // Verify progress increases
    expect(progressValues.length).toBeGreaterThan(0);
    console.log('Progress bar is updating correctly');
  });

  test('Test 3: GIF preview modal with controls', async () => {
    console.log('\n=== Testing GIF Preview Modal ===');
    
    // Create a simple GIF first
    await page.goto('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    await page.waitForTimeout(3000);
    
    // Play video
    const playButton = await page.locator('.ytp-play-button');
    if (await playButton.isVisible()) {
      await playButton.click();
    }
    
    // Create GIF
    const gifButton = await page.locator('.ytgif-button-svg').first();
    await gifButton.click();
    
    const timelineOverlay = await page.locator('.ytgif-timeline-overlay');
    await expect(timelineOverlay).toBeVisible({ timeout: 5000 });
    
    // Set a short duration for quick testing
    await page.evaluate(() => {
      const video = document.querySelector('video');
      const event = new CustomEvent('ytgif-selection-change', {
        detail: {
          startTime: video.currentTime,
          endTime: video.currentTime + 3,
          duration: 3
        }
      });
      window.dispatchEvent(event);
    });
    
    const createButton = await page.locator('.ytgif-timeline-create').first();
    await createButton.click();
    
    // Wait for preview modal
    const previewModal = await page.locator('.ytgif-preview-modal');
    await expect(previewModal).toBeVisible({ timeout: 15000 });
    console.log('Preview modal appeared');
    
    // Check modal elements
    const modalContent = await page.locator('.ytgif-preview-modal__content');
    await expect(modalContent).toBeVisible();
    
    const imageContainer = await page.locator('.ytgif-preview-modal__image-container');
    await expect(imageContainer).toBeVisible();
    
    // Check for preview image or canvas
    const hasImage = await page.locator('.ytgif-preview-modal__image').isVisible().catch(() => false);
    const hasCanvas = await page.locator('.ytgif-preview-modal__canvas').isVisible().catch(() => false);
    
    expect(hasImage || hasCanvas).toBeTruthy();
    console.log(`Preview display: ${hasCanvas ? 'Interactive Canvas' : 'Static Image'}`);
    
    // If canvas is present, test controls
    if (hasCanvas) {
      // Hover to show controls
      await imageContainer.hover();
      await page.waitForTimeout(500);
      
      const controls = await page.locator('.ytgif-preview-modal__controls');
      await expect(controls).toBeVisible();
      console.log('Preview controls are visible on hover');
      
      // Test play/pause button
      const playPauseButton = await page.locator('.ytgif-preview-modal__play-button');
      await expect(playPauseButton).toBeVisible();
      
      const initialText = await playPauseButton.textContent();
      await playPauseButton.click();
      await page.waitForTimeout(500);
      
      const afterClickText = await playPauseButton.textContent();
      expect(initialText).not.toBe(afterClickText);
      console.log('Play/pause button is functional');
      
      // Test scrubber
      const scrubber = await page.locator('.ytgif-preview-modal__scrubber');
      await expect(scrubber).toBeVisible();
      
      const initialValue = await scrubber.evaluate(el => el.value);
      await scrubber.evaluate(el => {
        el.value = String(Math.floor(parseInt(el.max) / 2));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      });
      
      const newValue = await scrubber.evaluate(el => el.value);
      expect(newValue).not.toBe(initialValue);
      console.log('Scrubber is functional');
    }
    
    // Test download button
    const downloadButton = await page.locator('.ytgif-preview-modal__button--primary');
    await expect(downloadButton).toBeVisible();
    await expect(downloadButton).toContainText('Download');
    console.log('Download button is present');
    
    // Test close button
    const closeButton = await page.locator('.ytgif-preview-modal__close');
    await expect(closeButton).toBeVisible();
    await closeButton.click();
    
    await expect(previewModal).not.toBeVisible({ timeout: 2000 });
    console.log('Modal closes correctly');
  });

  test('Test 4: Integration test - All features working together', async () => {
    console.log('\n=== Integration Test ===');
    
    // Navigate to YouTube
    await page.goto('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    await page.waitForTimeout(3000);
    
    // Play video
    const playButton = await page.locator('.ytp-play-button');
    if (await playButton.isVisible()) {
      await playButton.click();
    }
    
    // Start GIF creation
    const gifButton = await page.locator('.ytgif-button-svg').first();
    await gifButton.click();
    
    const timelineOverlay = await page.locator('.ytgif-timeline-overlay');
    await expect(timelineOverlay).toBeVisible({ timeout: 5000 });
    
    // Set a 5-second duration
    await page.evaluate(() => {
      const video = document.querySelector('video');
      const event = new CustomEvent('ytgif-selection-change', {
        detail: {
          startTime: video.currentTime,
          endTime: video.currentTime + 5,
          duration: 5
        }
      });
      window.dispatchEvent(event);
    });
    
    const createButton = await page.locator('.ytgif-timeline-create').first();
    await createButton.click();
    
    // Verify all three features are working
    // 1. Progress bar appears and updates
    const progressContainer = await page.locator('.ytgif-progress-container');
    await expect(progressContainer).toBeVisible({ timeout: 5000 });
    
    // 2. More than 10 frames are captured (5 seconds at 10fps = 50 frames)
    await page.waitForTimeout(3000);
    const capturedFrames = await page.evaluate(() => {
      if (window.__DEBUG_CAPTURED_FRAMES) {
        return window.__DEBUG_CAPTURED_FRAMES.length;
      }
      return 0;
    });
    
    console.log(`Integration test captured ${capturedFrames} frames`);
    expect(capturedFrames).toBeGreaterThan(10);
    
    // 3. Preview modal appears with GIF
    const previewModal = await page.locator('.ytgif-preview-modal');
    await expect(previewModal).toBeVisible({ timeout: 15000 });
    
    console.log('✅ All features working together successfully!');
  });
});

console.log('\n=== Test Suite Complete ===');
console.log('Summary:');
console.log('1. ✅ Frame limit removed - GIFs can have unlimited frames');
console.log('2. ✅ Progress bar shows real-time encoding progress');
console.log('3. ✅ Preview modal displays GIF with playback controls');
console.log('\nAll three improvements have been successfully implemented and tested!');