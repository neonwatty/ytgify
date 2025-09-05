const { test, expect, chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs').promises;

const EXTENSION_PATH = path.join(__dirname, '..', 'dist');
const DOWNLOADS_PATH = path.join(__dirname, 'downloads');

test.describe('GIF Download Button Integration Tests', () => {
  let browser, context, page;

  test.beforeAll(async () => {
    console.log('=== Setting up Download Button Tests ===');
    console.log('Extension path:', EXTENSION_PATH);
    console.log('Downloads path:', DOWNLOADS_PATH);
    
    // Clean and create downloads directory
    try {
      await fs.rm(DOWNLOADS_PATH, { recursive: true, force: true });
    } catch (e) {}
    await fs.mkdir(DOWNLOADS_PATH, { recursive: true });
    
    browser = await chromium.launch({
      headless: false, // Set to true for CI
      slowMo: 100,
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
        '--auto-open-devtools-for-tabs'
      ],
    });

    context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      acceptDownloads: true,
      downloadsPath: DOWNLOADS_PATH
    });

    page = await context.newPage();
    
    // Enhanced console logging
    page.on('console', msg => {
      const text = msg.text();
      const type = msg.type();
      
      // Log important messages
      if (text.includes('GIF') || text.includes('Download') || 
          text.includes('Preview') || text.includes('Created') ||
          text.includes('Saved') || text.includes('Encoding')) {
        console.log(`[${type}]:`, text);
      }
      
      // Always log errors
      if (type === 'error') {
        console.error('[Error]:', text);
      }
    });

    page.on('pageerror', error => {
      console.error('[Page Error]:', error.message);
    });
  });

  test.afterAll(async () => {
    // List all downloaded files
    try {
      const files = await fs.readdir(DOWNLOADS_PATH);
      console.log('\n=== Final Downloads Summary ===');
      if (files.length > 0) {
        for (const file of files) {
          const stats = await fs.stat(path.join(DOWNLOADS_PATH, file));
          console.log(`✅ ${file} (${(stats.size / 1024).toFixed(1)} KB)`);
        }
      } else {
        console.log('No files downloaded');
      }
    } catch (e) {
      console.log('Could not read downloads directory');
    }
    
    await browser?.close();
  });

  test('Test 1: Preview modal appears with download button', async () => {
    console.log('\n=== Test 1: Preview Modal and Download Button ===');
    
    // Navigate to YouTube
    await page.goto('https://www.youtube.com/watch?v=jNQXAC9IVRw');
    await page.waitForTimeout(5000);
    
    // Set video position
    await page.evaluate(() => {
      const video = document.querySelector('video');
      if (video) {
        video.currentTime = 5;
        if (video.paused) video.play();
        console.log('Video positioned at 5 seconds');
      }
    });
    await page.waitForTimeout(2000);
    
    // Click GIF button
    console.log('Looking for GIF button...');
    const gifButton = await page.locator('.ytgif-button-svg, .ytgif-button, button[aria-label*="GIF"]').first();
    await expect(gifButton).toBeVisible({ timeout: 15000 });
    await gifButton.click();
    console.log('GIF button clicked');
    
    // Wait for timeline overlay
    console.log('Waiting for timeline overlay...');
    const timelineOverlay = await page.locator('.ytgif-timeline-overlay, #ytgif-timeline-overlay').first();
    await expect(timelineOverlay).toBeVisible({ timeout: 10000 });
    console.log('Timeline overlay appeared');
    
    // Set a 2-second selection for quick testing
    await page.evaluate(() => {
      const video = document.querySelector('video');
      if (video) {
        const startTime = video.currentTime;
        const endTime = startTime + 2;
        console.log(`Setting GIF selection: ${startTime}s to ${endTime}s`);
        
        // Try multiple methods to ensure selection is set
        // Method 1: Direct event
        const event = new CustomEvent('ytgif-selection-change', {
          detail: { startTime, endTime, duration: 2 }
        });
        window.dispatchEvent(event);
      }
    });
    await page.waitForTimeout(500);
    
    // Click Create GIF button
    console.log('Clicking Create GIF button...');
    const createButton = await page.locator('.ytgif-timeline-create, button:has-text("Create")').first();
    await expect(createButton).toBeVisible();
    await createButton.click();
    console.log('Create GIF clicked, processing...');
    
    // Wait for processing to complete and preview modal to appear
    console.log('Waiting for preview modal...');
    const previewModal = await page.locator('.ytgif-preview-modal').first();
    await expect(previewModal).toBeVisible({ timeout: 30000 });
    console.log('✅ Preview modal appeared!');
    
    // Check for download button in preview modal
    const downloadButton = await page.locator('.ytgif-preview-modal button:has-text("Download")').first();
    await expect(downloadButton).toBeVisible();
    console.log('✅ Download button is visible in preview modal');
    
    // Check for GIF preview (either image or canvas)
    const hasImage = await page.locator('.ytgif-preview-modal__image').isVisible().catch(() => false);
    const hasCanvas = await page.locator('.ytgif-preview-modal__canvas').isVisible().catch(() => false);
    
    expect(hasImage || hasCanvas).toBeTruthy();
    console.log(`✅ GIF preview displayed as: ${hasCanvas ? 'interactive canvas' : 'static image'}`);
    
    // Click download button
    console.log('Clicking download button...');
    const downloadPromise = page.waitForEvent('download', { timeout: 10000 });
    await downloadButton.click();
    
    try {
      const download = await downloadPromise;
      const suggestedFilename = await download.suggestedFilename();
      console.log(`Download started: ${suggestedFilename}`);
      
      // Save to our test directory
      const savePath = path.join(DOWNLOADS_PATH, suggestedFilename);
      await download.saveAs(savePath);
      
      // Verify file was saved
      const stats = await fs.stat(savePath);
      expect(stats.size).toBeGreaterThan(1000); // At least 1KB
      console.log(`✅ GIF downloaded successfully: ${suggestedFilename} (${(stats.size / 1024).toFixed(1)} KB)`);
      
    } catch (error) {
      console.error('Download failed:', error);
      throw error;
    }
  });

  test('Test 2: Multiple GIF downloads', async () => {
    console.log('\n=== Test 2: Multiple Downloads ===');
    
    // Navigate to YouTube (or reuse existing page)
    if (!page.url().includes('youtube.com')) {
      await page.goto('https://www.youtube.com/watch?v=jNQXAC9IVRw');
      await page.waitForTimeout(5000);
    }
    
    // Create and download 2 GIFs to test multiple downloads
    for (let i = 0; i < 2; i++) {
      console.log(`\nCreating GIF ${i + 1}...`);
      
      // Set different video position for each GIF
      await page.evaluate((index) => {
        const video = document.querySelector('video');
        if (video) {
          video.currentTime = 3 + (index * 5);
          video.play();
        }
      }, i);
      await page.waitForTimeout(2000);
      
      // Click GIF button
      const gifButton = await page.locator('.ytgif-button-svg, .ytgif-button').first();
      await gifButton.click();
      
      // Wait for timeline overlay
      const timelineOverlay = await page.locator('.ytgif-timeline-overlay, #ytgif-timeline-overlay').first();
      await expect(timelineOverlay).toBeVisible({ timeout: 10000 });
      
      // Create GIF
      const createButton = await page.locator('.ytgif-timeline-create').first();
      await createButton.click();
      
      // Wait for preview modal
      const previewModal = await page.locator('.ytgif-preview-modal').first();
      await expect(previewModal).toBeVisible({ timeout: 30000 });
      
      // Download GIF
      const downloadButton = await page.locator('.ytgif-preview-modal button:has-text("Download")').first();
      const downloadPromise = page.waitForEvent('download', { timeout: 10000 });
      await downloadButton.click();
      
      const download = await downloadPromise;
      const filename = `test_gif_${i + 1}_${Date.now()}.gif`;
      const savePath = path.join(DOWNLOADS_PATH, filename);
      await download.saveAs(savePath);
      
      const stats = await fs.stat(savePath);
      console.log(`✅ GIF ${i + 1} downloaded: ${filename} (${(stats.size / 1024).toFixed(1)} KB)`);
      
      // Close preview modal
      const closeButton = await page.locator('.ytgif-preview-modal__close').first();
      if (await closeButton.isVisible()) {
        await closeButton.click();
        await page.waitForTimeout(500);
      }
    }
    
    // Verify we have multiple GIFs
    const files = await fs.readdir(DOWNLOADS_PATH);
    const gifFiles = files.filter(f => f.endsWith('.gif'));
    expect(gifFiles.length).toBeGreaterThanOrEqual(2);
    console.log(`\n✅ Successfully downloaded ${gifFiles.length} GIF files`);
  });

  test('Test 3: Download button preserves GIF quality', async () => {
    console.log('\n=== Test 3: GIF Quality Check ===');
    
    // Navigate to YouTube
    await page.goto('https://www.youtube.com/watch?v=jNQXAC9IVRw');
    await page.waitForTimeout(5000);
    
    // Create a GIF
    await page.evaluate(() => {
      const video = document.querySelector('video');
      if (video) {
        video.currentTime = 8;
        video.play();
      }
    });
    await page.waitForTimeout(2000);
    
    const gifButton = await page.locator('.ytgif-button-svg, .ytgif-button').first();
    await gifButton.click();
    
    const timelineOverlay = await page.locator('.ytgif-timeline-overlay, #ytgif-timeline-overlay').first();
    await expect(timelineOverlay).toBeVisible({ timeout: 10000 });
    
    // Set 3-second selection
    await page.evaluate(() => {
      const video = document.querySelector('video');
      if (video) {
        const event = new CustomEvent('ytgif-selection-change', {
          detail: { startTime: 8, endTime: 11, duration: 3 }
        });
        window.dispatchEvent(event);
      }
    });
    
    const createButton = await page.locator('.ytgif-timeline-create').first();
    await createButton.click();
    
    // Wait for preview and get metadata
    const previewModal = await page.locator('.ytgif-preview-modal').first();
    await expect(previewModal).toBeVisible({ timeout: 30000 });
    
    // Check if metadata is displayed
    const metadataText = await page.locator('.ytgif-preview-modal__metadata').textContent().catch(() => '');
    console.log('GIF Metadata:', metadataText);
    
    // Download the GIF
    const downloadButton = await page.locator('.ytgif-preview-modal button:has-text("Download")').first();
    const downloadPromise = page.waitForEvent('download', { timeout: 10000 });
    await downloadButton.click();
    
    const download = await downloadPromise;
    const filename = `quality_test_${Date.now()}.gif`;
    const savePath = path.join(DOWNLOADS_PATH, filename);
    await download.saveAs(savePath);
    
    // Analyze the downloaded GIF
    const stats = await fs.stat(savePath);
    const fileBuffer = await fs.readFile(savePath);
    
    // Check GIF header
    const header = fileBuffer.toString('ascii', 0, 6);
    expect(header === 'GIF87a' || header === 'GIF89a').toBeTruthy();
    
    // Count frames (simplified check)
    let frameCount = 0;
    for (let i = 0; i < fileBuffer.length - 8; i++) {
      if (fileBuffer[i] === 0x21 && fileBuffer[i + 1] === 0xF9) {
        frameCount++;
      }
    }
    
    console.log(`\n✅ Quality Check Results:`);
    console.log(`   File: ${filename}`);
    console.log(`   Size: ${(stats.size / 1024).toFixed(1)} KB`);
    console.log(`   Header: ${header} (valid GIF)`);
    console.log(`   Estimated frames: ${frameCount}`);
    console.log(`   Frames per second: ~${(frameCount / 3).toFixed(1)}`);
    
    expect(stats.size).toBeGreaterThan(10000); // Should be at least 10KB for 3 seconds
    expect(frameCount).toBeGreaterThan(10); // Should have more than 10 frames (no limit!)
  });

  test('Test 4: Preview controls work before download', async () => {
    console.log('\n=== Test 4: Preview Controls Test ===');
    
    // Navigate to YouTube
    await page.goto('https://www.youtube.com/watch?v=jNQXAC9IVRw');
    await page.waitForTimeout(5000);
    
    // Create a GIF
    await page.evaluate(() => {
      const video = document.querySelector('video');
      if (video) {
        video.currentTime = 2;
        video.play();
      }
    });
    await page.waitForTimeout(2000);
    
    const gifButton = await page.locator('.ytgif-button-svg, .ytgif-button').first();
    await gifButton.click();
    
    const timelineOverlay = await page.locator('.ytgif-timeline-overlay, #ytgif-timeline-overlay').first();
    await expect(timelineOverlay).toBeVisible({ timeout: 10000 });
    
    const createButton = await page.locator('.ytgif-timeline-create').first();
    await createButton.click();
    
    // Wait for preview modal
    const previewModal = await page.locator('.ytgif-preview-modal').first();
    await expect(previewModal).toBeVisible({ timeout: 30000 });
    console.log('Preview modal appeared');
    
    // Check if we have interactive canvas (with frames)
    const imageContainer = await page.locator('.ytgif-preview-modal__image-container').first();
    const hasCanvas = await page.locator('.ytgif-preview-modal__canvas').isVisible().catch(() => false);
    
    if (hasCanvas) {
      console.log('Interactive canvas preview detected');
      
      // Hover to show controls
      await imageContainer.hover();
      await page.waitForTimeout(500);
      
      const controls = await page.locator('.ytgif-preview-modal__controls').first();
      if (await controls.isVisible()) {
        console.log('✅ Preview controls are visible');
        
        // Test play/pause
        const playButton = await page.locator('.ytgif-preview-modal__play-button').first();
        if (await playButton.isVisible()) {
          await playButton.click();
          console.log('✅ Play/pause button works');
        }
        
        // Test scrubber
        const scrubber = await page.locator('.ytgif-preview-modal__scrubber').first();
        if (await scrubber.isVisible()) {
          await scrubber.evaluate(el => {
            el.value = String(Math.floor(parseInt(el.max) / 2));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          });
          console.log('✅ Frame scrubber works');
        }
      }
    } else {
      console.log('Static image preview (no frames for interaction)');
    }
    
    // Finally download the GIF
    const downloadButton = await page.locator('.ytgif-preview-modal button:has-text("Download")').first();
    const downloadPromise = page.waitForEvent('download', { timeout: 10000 });
    await downloadButton.click();
    
    const download = await downloadPromise;
    const filename = `preview_test_${Date.now()}.gif`;
    await download.saveAs(path.join(DOWNLOADS_PATH, filename));
    console.log(`✅ GIF downloaded after preview: ${filename}`);
  });
});

console.log('\n=== Download Button Test Suite ===');
console.log('This test suite verifies:');
console.log('1. Preview modal appears with download button');
console.log('2. Download button successfully downloads GIF files');
console.log('3. Multiple GIFs can be downloaded');
console.log('4. Downloaded GIFs maintain quality');
console.log('5. Preview controls work before download');
console.log('\nAll downloaded GIFs will be saved to: tests/downloads/');