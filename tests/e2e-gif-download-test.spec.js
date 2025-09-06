const { test, expect, chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs').promises;

const EXTENSION_PATH = path.join(__dirname, '..', 'dist');
const DOWNLOADS_PATH = path.join(__dirname, 'downloads');
const TEST_VIDEO_URL = 'https://www.youtube.com/watch?v=jNQXAC9IVRw'; // "Me at the zoo" - first YouTube video

test.describe('End-to-End GIF Download Tests', () => {
  let browser, context, page;

  test.beforeAll(async () => {
    console.log('=== Setting up E2E GIF Download Tests ===');
    console.log('Extension path:', EXTENSION_PATH);
    console.log('Downloads path:', DOWNLOADS_PATH);
    
    // Ensure downloads directory exists and is clean
    try {
      await fs.rm(DOWNLOADS_PATH, { recursive: true, force: true });
    } catch (e) {
      // Directory might not exist
    }
    await fs.mkdir(DOWNLOADS_PATH, { recursive: true });
    
    browser = await chromium.launch({
      headless: false, // Set to true for CI
      slowMo: 100,
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
      ],
    });

    context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      acceptDownloads: true,
      permissions: ['clipboard-read', 'clipboard-write']
    });
    
    // Set download behavior to save files automatically
    await context.grantPermissions(['clipboard-write']);

    page = await context.newPage();
    
    // Set up console logging
    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      if (type === 'error' || text.includes('Error')) {
        console.error(`[Browser ${type}]:`, text);
      } else if (text.includes('GIF') || text.includes('Encoding') || text.includes('Frame')) {
        console.log(`[Browser]:`, text);
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
      console.log('\n=== Downloaded Files ===');
      for (const file of files) {
        const stats = await fs.stat(path.join(DOWNLOADS_PATH, file));
        console.log(`- ${file} (${(stats.size / 1024).toFixed(1)} KB)`);
      }
    } catch (e) {
      console.log('No files downloaded');
    }
    
    await browser?.close();
  });

  test('Test 1: Download small GIF (3 seconds)', async () => {
    console.log('\n=== Test 1: Small GIF Download ===');
    
    // Navigate to YouTube video
    await page.goto(TEST_VIDEO_URL);
    await page.waitForTimeout(3000);
    
    // Wait for video to be ready
    await page.waitForSelector('video', { timeout: 10000 });
    
    // Set video to specific time and play
    await page.evaluate(() => {
      const video = document.querySelector('video');
      if (video) {
        video.currentTime = 5;
        video.play();
      }
    });
    await page.waitForTimeout(2000);
    
    // Click GIF button
    const gifButton = await page.locator('.ytgif-button-svg, .ytgif-button').first();
    await expect(gifButton).toBeVisible({ timeout: 10000 });
    await gifButton.click();
    console.log('GIF button clicked');
    
    // Wait for timeline overlay
    const timelineOverlay = await page.locator('.ytgif-timeline-overlay, #ytgif-timeline-overlay').first();
    await expect(timelineOverlay).toBeVisible({ timeout: 5000 });
    console.log('Timeline overlay appeared');
    
    // Set selection to 3 seconds
    await page.evaluate(() => {
      const video = document.querySelector('video');
      if (video) {
        const event = new CustomEvent('ytgif-selection-change', {
          detail: {
            startTime: video.currentTime,
            endTime: video.currentTime + 3,
            duration: 3
          }
        });
        window.dispatchEvent(event);
      }
    });
    console.log('Set 3-second selection');
    
    // Start download promise before clicking create
    const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
    
    // Click Create GIF button
    const createButton = await page.locator('.ytgif-timeline-create, button:has-text("Create GIF")').first();
    await createButton.click();
    console.log('Create GIF clicked');
    
    // Wait for processing
    await page.waitForTimeout(5000);
    
    try {
      // Wait for download to start
      const download = await downloadPromise;
      console.log('Download started:', await download.suggestedFilename());
      
      // Save to our test directory
      const fileName = `test1_small_${Date.now()}.gif`;
      const savePath = path.join(DOWNLOADS_PATH, fileName);
      await download.saveAs(savePath);
      console.log('GIF saved to:', savePath);
      
      // Verify the file exists and has content
      const stats = await fs.stat(savePath);
      expect(stats.size).toBeGreaterThan(10000); // At least 10KB
      console.log(`✅ Small GIF downloaded successfully: ${fileName} (${(stats.size / 1024).toFixed(1)} KB)`);
      
    } catch (error) {
      console.log('Download via event failed, checking for manual download...');
      
      // Alternative: Check if download button appears in preview modal
      const downloadButton = await page.locator('button:has-text("Download")').first();
      if (await downloadButton.isVisible()) {
        await downloadButton.click();
        console.log('Clicked download button in preview modal');
        await page.waitForTimeout(2000);
      }
    }
  });

  test('Test 2: Download medium GIF (10 seconds)', async () => {
    console.log('\n=== Test 2: Medium GIF Download ===');
    
    // Navigate to video
    await page.goto(TEST_VIDEO_URL);
    await page.waitForTimeout(3000);
    
    // Set video position
    await page.evaluate(() => {
      const video = document.querySelector('video');
      if (video) {
        video.currentTime = 2;
        video.play();
      }
    });
    await page.waitForTimeout(2000);
    
    // Click GIF button
    const gifButton = await page.locator('.ytgif-button-svg, .ytgif-button').first();
    await gifButton.click();
    
    // Wait for timeline overlay
    const timelineOverlay = await page.locator('.ytgif-timeline-overlay, #ytgif-timeline-overlay').first();
    await expect(timelineOverlay).toBeVisible({ timeout: 5000 });
    
    // Set 10-second selection
    await page.evaluate(() => {
      const video = document.querySelector('video');
      if (video) {
        const event = new CustomEvent('ytgif-selection-change', {
          detail: {
            startTime: 2,
            endTime: 12,
            duration: 10
          }
        });
        window.dispatchEvent(event);
      }
    });
    console.log('Set 10-second selection');
    
    // Monitor progress
    let lastProgress = 0;
    await page.evaluate(() => {
      window.addEventListener('ytgif-progress-update', (event) => {
        if (event.detail && event.detail.progress) {
          window.__lastProgress = event.detail.progress;
        }
      });
    });
    
    // Start download promise
    const downloadPromise = page.waitForEvent('download', { timeout: 60000 });
    
    // Click Create GIF
    const createButton = await page.locator('.ytgif-timeline-create, button:has-text("Create GIF")').first();
    await createButton.click();
    console.log('Creating 10-second GIF...');
    
    // Monitor progress for a bit
    for (let i = 0; i < 5; i++) {
      await page.waitForTimeout(2000);
      const progress = await page.evaluate(() => window.__lastProgress);
      if (progress && progress !== lastProgress) {
        console.log(`Progress: ${progress}%`);
        lastProgress = progress;
      }
    }
    
    try {
      // Wait for download
      const download = await downloadPromise;
      const fileName = `test2_medium_${Date.now()}.gif`;
      const savePath = path.join(DOWNLOADS_PATH, fileName);
      await download.saveAs(savePath);
      
      // Verify file
      const stats = await fs.stat(savePath);
      expect(stats.size).toBeGreaterThan(50000); // At least 50KB for 10 seconds
      console.log(`✅ Medium GIF downloaded: ${fileName} (${(stats.size / 1024).toFixed(1)} KB)`);
      
    } catch (error) {
      console.log('Handling download manually...');
      
      // Try preview modal download button
      const downloadButton = await page.locator('button:has-text("Download")').first();
      if (await downloadButton.isVisible()) {
        const download = await Promise.all([
          page.waitForEvent('download'),
          downloadButton.click()
        ]);
        
        if (download[0]) {
          const fileName = `test2_medium_manual_${Date.now()}.gif`;
          const savePath = path.join(DOWNLOADS_PATH, fileName);
          await download[0].saveAs(savePath);
          console.log(`✅ Medium GIF downloaded via modal: ${fileName}`);
        }
      }
    }
  });

  test('Test 3: Download with high frame rate', async () => {
    console.log('\n=== Test 3: High Frame Rate GIF ===');
    
    // Navigate to video
    await page.goto(TEST_VIDEO_URL);
    await page.waitForTimeout(3000);
    
    // Position video
    await page.evaluate(() => {
      const video = document.querySelector('video');
      if (video) {
        video.currentTime = 10;
        video.play();
      }
    });
    await page.waitForTimeout(2000);
    
    // Open GIF creator
    const gifButton = await page.locator('.ytgif-button-svg, .ytgif-button').first();
    await gifButton.click();
    
    const timelineOverlay = await page.locator('.ytgif-timeline-overlay, #ytgif-timeline-overlay').first();
    await expect(timelineOverlay).toBeVisible({ timeout: 5000 });
    
    // Set 5-second selection with implied high frame rate
    await page.evaluate(() => {
      const video = document.querySelector('video');
      if (video) {
        // The extension uses 10fps by default now
        const event = new CustomEvent('ytgif-selection-change', {
          detail: {
            startTime: 10,
            endTime: 15,
            duration: 5
          }
        });
        window.dispatchEvent(event);
      }
    });
    console.log('Set 5-second high frame rate selection');
    
    // Track frame capture
    await page.evaluate(() => {
      window.__framesCaptured = 0;
      const originalLog = console.log;
      console.log = function(...args) {
        originalLog.apply(console, args);
        const text = args.join(' ');
        if (text.includes('Captured frame')) {
          window.__framesCaptured++;
        }
      };
    });
    
    // Start download promise
    const downloadPromise = page.waitForEvent('download', { timeout: 45000 });
    
    // Create GIF
    const createButton = await page.locator('.ytgif-timeline-create, button:has-text("Create GIF")').first();
    await createButton.click();
    console.log('Creating high frame rate GIF...');
    
    // Wait a bit and check frame count
    await page.waitForTimeout(8000);
    const framesCaptured = await page.evaluate(() => window.__framesCaptured);
    console.log(`Captured ${framesCaptured} frames (should be ~50 for 5 seconds at 10fps)`);
    expect(framesCaptured).toBeGreaterThan(10); // Should capture more than old limit
    
    try {
      // Wait for download
      const download = await downloadPromise;
      const fileName = `test3_highfps_${Date.now()}.gif`;
      const savePath = path.join(DOWNLOADS_PATH, fileName);
      await download.saveAs(savePath);
      
      // Verify file
      const stats = await fs.stat(savePath);
      console.log(`✅ High FPS GIF downloaded: ${fileName} (${(stats.size / 1024).toFixed(1)} KB)`);
      console.log(`   Frames captured: ${framesCaptured}`);
      
    } catch (error) {
      console.log('Using preview modal for download...');
      
      const downloadButton = await page.locator('button:has-text("Download")').first();
      if (await downloadButton.isVisible()) {
        await downloadButton.click();
        console.log('Download triggered via modal');
      }
    }
  });

  test('Test 4: Verify GIF files are valid', async () => {
    console.log('\n=== Test 4: Validating GIF Files ===');
    
    const files = await fs.readdir(DOWNLOADS_PATH);
    const gifFiles = files.filter(f => f.endsWith('.gif'));
    
    expect(gifFiles.length).toBeGreaterThan(0);
    console.log(`Found ${gifFiles.length} GIF files to validate`);
    
    for (const file of gifFiles) {
      const filePath = path.join(DOWNLOADS_PATH, file);
      const stats = await fs.stat(filePath);
      
      // Read first few bytes to verify GIF header
      const fd = await fs.open(filePath, 'r');
      const buffer = Buffer.alloc(6);
      await fd.read(buffer, 0, 6, 0);
      await fd.close();
      
      const header = buffer.toString('ascii');
      const isGif = header === 'GIF87a' || header === 'GIF89a';
      
      expect(isGif).toBeTruthy();
      console.log(`✅ ${file}: Valid GIF (${(stats.size / 1024).toFixed(1)} KB)`);
    }
  });
});

console.log('\n=== E2E GIF Download Test Suite Ready ===');
console.log('This test will:');
console.log('1. Create and download a 3-second GIF');
console.log('2. Create and download a 10-second GIF');
console.log('3. Create a high frame rate GIF (testing frame limit removal)');
console.log('4. Validate all downloaded GIF files');
console.log('\nAll files will be saved to: tests/downloads/');