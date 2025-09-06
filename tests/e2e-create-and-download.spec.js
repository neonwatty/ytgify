const { test, expect, chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs').promises;

const EXTENSION_PATH = path.join(__dirname, '..', 'dist');
const DOWNLOADS_PATH = path.join(__dirname, 'downloads');

test('End-to-End: Create 3-second GIF and Download via Button', async () => {
  console.log('\n=== End-to-End GIF Creation and Download Test ===\n');
  console.log('This test will:');
  console.log('1. Navigate to YouTube');
  console.log('2. Click the GIF button');
  console.log('3. Create a 3-second GIF');
  console.log('4. Wait for completion');
  console.log('5. Download via the preview modal button\n');

  // Clean downloads directory
  try {
    await fs.rm(DOWNLOADS_PATH, { recursive: true, force: true });
  } catch (e) {}
  await fs.mkdir(DOWNLOADS_PATH, { recursive: true });
  console.log(`Downloads directory: ${DOWNLOADS_PATH}\n`);

  // Launch browser with extension
  console.log('Step 1: Launching browser with extension...');
  const browser = await chromium.launch({
    headless: false, // Set to true for CI
    slowMo: 200, // Slow down for visibility
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--auto-open-devtools-for-tabs'
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    acceptDownloads: true,
    downloadsPath: DOWNLOADS_PATH,
    permissions: ['clipboard-read', 'clipboard-write']
  });

  const page = await context.newPage();
  
  // Set up console logging to track progress
  page.on('console', msg => {
    const text = msg.text();
    const type = msg.type();
    
    // Log key events
    if (text.includes('GIF') || text.includes('Created') || 
        text.includes('Encoding') || text.includes('Frame') ||
        text.includes('Preview') || text.includes('Download') ||
        text.includes('Saved')) {
      console.log(`  [${type}]: ${text}`);
    }
    
    if (type === 'error') {
      console.error(`  [ERROR]: ${text}`);
    }
  });

  page.on('pageerror', error => {
    console.error('  [Page Error]:', error.message);
  });

  try {
    // Navigate to YouTube
    console.log('\nStep 2: Navigating to YouTube...');
    await page.goto('https://www.youtube.com/watch?v=jNQXAC9IVRw'); // "Me at the zoo" - first YouTube video
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    console.log('  ✓ YouTube page loaded');
    
    // Wait for video player to be ready
    console.log('\nStep 3: Waiting for video player...');
    await page.waitForSelector('video', { timeout: 15000 });
    
    // Set video to a specific position and ensure it's playing
    await page.evaluate(() => {
      const video = document.querySelector('video');
      if (video) {
        video.currentTime = 5; // Start at 5 seconds
        if (video.paused) {
          video.play();
        }
        console.log(`Video set to ${video.currentTime}s, playing: ${!video.paused}`);
        return true;
      }
      return false;
    });
    
    // Wait a moment for video to stabilize
    await page.waitForTimeout(3000);
    console.log('  ✓ Video player ready');
    
    // Find and click GIF button
    console.log('\nStep 4: Looking for GIF button...');
    
    // Try multiple selectors for the GIF button
    const gifButtonSelectors = [
      'button.ytgif-button',
      'button[aria-label*="Create GIF"]',
      '.ytp-right-controls button.ytgif-button',
      'button:has(svg.ytgif-button-icon)',
      '.ytp-chrome-controls button.ytgif-button'
    ];
    
    let gifButton = null;
    for (const selector of gifButtonSelectors) {
      try {
        gifButton = await page.waitForSelector(selector, { timeout: 5000 });
        if (gifButton) {
          console.log(`  ✓ Found GIF button with selector: ${selector}`);
          break;
        }
      } catch (e) {
        // Try next selector
      }
    }
    
    if (!gifButton) {
      // Last resort: wait a bit more and try to find any button with GIF-related content
      await page.waitForTimeout(5000);
      gifButton = await page.locator('button').filter({ hasText: /gif/i }).first();
    }
    
    expect(gifButton).toBeTruthy();
    await gifButton.click();
    console.log('  ✓ GIF button clicked');
    
    // Wait for timeline overlay
    console.log('\nStep 5: Waiting for timeline overlay...');
    const timelineOverlay = await page.waitForSelector('.ytgif-timeline-overlay, #ytgif-timeline-overlay', { 
      timeout: 10000 
    });
    expect(timelineOverlay).toBeTruthy();
    console.log('  ✓ Timeline overlay appeared');
    
    // Set 3-second selection
    console.log('\nStep 6: Setting 3-second selection...');
    await page.evaluate(() => {
      const video = document.querySelector('video');
      if (video) {
        const startTime = video.currentTime;
        const endTime = startTime + 3;
        
        // Dispatch selection event
        const event = new CustomEvent('ytgif-selection-change', {
          detail: {
            startTime: startTime,
            endTime: endTime,
            duration: 3
          }
        });
        window.dispatchEvent(event);
        
        console.log(`GIF selection set: ${startTime.toFixed(1)}s to ${endTime.toFixed(1)}s (3 seconds)`);
        return true;
      }
      return false;
    });
    await page.waitForTimeout(500);
    console.log('  ✓ 3-second selection configured');
    
    // Click Create GIF button
    console.log('\nStep 7: Creating GIF...');
    const createButton = await page.waitForSelector('.ytgif-timeline-create, button:has-text("Create GIF")', {
      timeout: 5000
    });
    expect(createButton).toBeTruthy();
    await createButton.click();
    console.log('  ✓ Create GIF button clicked');
    
    // Monitor progress
    console.log('\nStep 8: Processing GIF...');
    let lastProgress = 0;
    let progressCheckCount = 0;
    
    // Set up progress monitoring
    await page.evaluate(() => {
      window.__gifProgress = 0;
      window.addEventListener('ytgif-progress-update', (event) => {
        if (event.detail && event.detail.progress) {
          window.__gifProgress = event.detail.progress;
          console.log(`Progress: ${event.detail.progress}% - ${event.detail.message}`);
        }
      });
    });
    
    // Wait for progress updates (max 30 seconds)
    const maxWaitTime = 30000;
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
      const currentProgress = await page.evaluate(() => window.__gifProgress);
      
      if (currentProgress > lastProgress) {
        console.log(`  Progress: ${currentProgress}%`);
        lastProgress = currentProgress;
      }
      
      // Check if preview modal has appeared (indicates completion)
      const previewModal = await page.$('.ytgif-preview-modal');
      if (previewModal) {
        console.log('  ✓ GIF processing complete!');
        break;
      }
      
      await page.waitForTimeout(1000);
      progressCheckCount++;
    }
    
    // Wait for preview modal
    console.log('\nStep 9: Waiting for preview modal...');
    const previewModal = await page.waitForSelector('.ytgif-preview-modal', { 
      timeout: 10000 
    });
    expect(previewModal).toBeTruthy();
    console.log('  ✓ Preview modal appeared');
    
    // Verify GIF is displayed
    const gifImage = await page.$('.ytgif-preview-modal__image');
    const gifCanvas = await page.$('.ytgif-preview-modal__canvas');
    expect(gifImage || gifCanvas).toBeTruthy();
    console.log(`  ✓ GIF preview displayed as: ${gifCanvas ? 'animated canvas' : 'static image'}`);
    
    // Check metadata if available
    const metadata = await page.$('.ytgif-preview-modal__metadata');
    if (metadata) {
      const metadataText = await metadata.textContent();
      console.log(`  GIF metadata: ${metadataText}`);
    }
    
    // Find and click download button
    console.log('\nStep 10: Downloading GIF...');
    const downloadButton = await page.waitForSelector('.ytgif-preview-modal button:has-text("Download")', {
      timeout: 5000
    });
    expect(downloadButton).toBeTruthy();
    console.log('  ✓ Download button found');
    
    // Set up download promise before clicking
    const downloadPromise = page.waitForEvent('download', { timeout: 10000 });
    
    // Click download button
    await downloadButton.click();
    console.log('  ✓ Download button clicked');
    
    // Wait for download to complete
    const download = await downloadPromise;
    const suggestedFilename = await download.suggestedFilename();
    console.log(`  Download started: ${suggestedFilename}`);
    
    // Save to our test directory
    const savePath = path.join(DOWNLOADS_PATH, suggestedFilename);
    await download.saveAs(savePath);
    console.log(`  ✓ GIF saved to: ${savePath}`);
    
    // Verify the downloaded file
    console.log('\nStep 11: Verifying downloaded GIF...');
    const stats = await fs.stat(savePath);
    console.log(`  File size: ${(stats.size / 1024).toFixed(1)} KB`);
    
    // Read file header to verify it's a valid GIF
    const fileBuffer = await fs.readFile(savePath);
    const header = fileBuffer.toString('ascii', 0, 6);
    const isValidGif = header === 'GIF87a' || header === 'GIF89a';
    expect(isValidGif).toBeTruthy();
    console.log(`  ✓ Valid GIF file (header: ${header})`);
    
    // Count frames (basic check)
    let frameCount = 0;
    for (let i = 0; i < fileBuffer.length - 8; i++) {
      if (fileBuffer[i] === 0x21 && fileBuffer[i + 1] === 0xF9) {
        frameCount++;
      }
    }
    console.log(`  Estimated frames: ${frameCount}`);
    console.log(`  Frame rate: ~${(frameCount / 3).toFixed(1)} fps`);
    
    // Final verification
    expect(stats.size).toBeGreaterThan(10000); // Should be at least 10KB
    expect(frameCount).toBeGreaterThan(10); // Should have multiple frames (no limit!)
    
    console.log('\n✅ SUCCESS! End-to-end test complete:');
    console.log(`   • Created 3-second GIF`);
    console.log(`   • Preview modal appeared`);
    console.log(`   • Downloaded via button click`);
    console.log(`   • File saved: ${suggestedFilename}`);
    console.log(`   • File size: ${(stats.size / 1024).toFixed(1)} KB`);
    console.log(`   • Frames: ${frameCount}`);
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    
    // Take screenshot for debugging
    const screenshotPath = path.join(DOWNLOADS_PATH, 'error-screenshot.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`Screenshot saved to: ${screenshotPath}`);
    
    throw error;
    
  } finally {
    // Clean up
    console.log('\nCleaning up...');
    await browser.close();
    
    // List final downloads
    try {
      const files = await fs.readdir(DOWNLOADS_PATH);
      if (files.length > 0) {
        console.log('\nFiles in downloads directory:');
        for (const file of files) {
          const filePath = path.join(DOWNLOADS_PATH, file);
          const stats = await fs.stat(filePath);
          console.log(`  - ${file} (${(stats.size / 1024).toFixed(1)} KB)`);
        }
      }
    } catch (e) {}
  }
});

console.log('\n=== E2E Test: Create and Download 3-second GIF ===');
console.log('Ready to run the complete workflow test.');