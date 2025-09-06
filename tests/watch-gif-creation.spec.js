const { test, expect, chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs').promises;

test.describe('Watch GIF Creation with Status Updates', () => {
  test('Create GIF and monitor all status updates', async () => {
    test.setTimeout(300000); // 5 minutes

    console.log('=== GIF Creation with Live Status Updates ===\n');
    console.log('WATCH THE BROWSER WINDOW TO SEE THE PROGRESS UPDATES!\n');
    
    // Set up downloads folder
    const downloadPath = path.join(__dirname, 'downloads');
    await fs.mkdir(downloadPath, { recursive: true });

    // Launch browser with extension
    const pathToExtension = path.join(__dirname, '..', 'dist');
    console.log('Loading extension from:', pathToExtension);
    
    const browser = await chromium.launchPersistentContext('', {
      headless: false, // IMPORTANT: Running with UI visible
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
      ],
      viewport: { width: 1400, height: 800 },
      slowMo: 500, // Slow down actions so you can see what's happening
    });

    console.log('\n📺 BROWSER LAUNCHED - You should see a Chrome window\n');

    const page = await browser.newPage();
    
    // Log all console messages from the page
    page.on('console', msg => {
      const text = msg.text();
      // Filter for progress-related messages
      if (text.includes('progress') || text.includes('Progress') || 
          text.includes('Stage') || text.includes('stage') ||
          text.includes('Extracting') || text.includes('Encoding') || 
          text.includes('Optimizing') || text.includes('Compressing') ||
          text.includes('%')) {
        console.log('📊 PROGRESS:', text);
      }
    });

    // Navigate to YouTube
    console.log('Step 1: Navigating to YouTube video...');
    console.log('        (Watch the browser window)\n');
    await page.goto('https://www.youtube.com/watch?v=jNQXAC9IVRw', { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });

    // Wait for video player and start playing
    console.log('Step 2: Waiting for video player to load...\n');
    await page.waitForSelector('video', { timeout: 15000 });
    
    // Start video at a specific time
    await page.evaluate(() => {
      const video = document.querySelector('video');
      if (video) {
        video.play();
        video.currentTime = 5; // Jump to 5 seconds
      }
    });
    
    console.log('        ⏸️  Waiting 3 seconds for video to start playing...\n');
    await page.waitForTimeout(3000);

    // Handle cookie dialog if it appears
    try {
      const cookieButton = await page.$('[aria-label*="Accept"], [aria-label*="Reject"]');
      if (cookieButton) {
        await cookieButton.click();
        console.log('        ✓ Handled cookie consent dialog\n');
        await page.waitForTimeout(1000);
      }
    } catch (e) {}

    // Find GIF button
    console.log('Step 3: Looking for the GIF button in player controls...\n');
    let gifButton = await page.$('.ytgif-button, .ytp-button[aria-label*="GIF"], button[title*="Create GIF"]');
    
    if (!gifButton) {
      const controls = await page.$('.ytp-right-controls');
      if (controls) {
        gifButton = await controls.$('.ytgif-button');
      }
    }
    
    if (!gifButton) {
      console.log('❌ ERROR: GIF button not found!');
      console.log('   The extension may not be loaded properly.');
      throw new Error('GIF button not found');
    }
    
    console.log('        ✓ Found GIF button!\n');
    console.log('Step 4: Clicking GIF button to open timeline overlay...\n');
    console.log('        👀 WATCH THE BOTTOM OF THE VIDEO PLAYER\n');
    
    await gifButton.click();
    await page.waitForTimeout(2000);

    // Wait for timeline overlay
    console.log('Step 5: Waiting for timeline overlay to appear...\n');
    await page.waitForFunction(() => {
      const overlay = document.querySelector('#ytgif-timeline-overlay');
      return overlay && window.getComputedStyle(overlay).display !== 'none';
    }, { timeout: 10000 });

    // Display selection info
    const selectionInfo = await page.evaluate(() => {
      const duration = document.querySelector('.ytgif-timeline-duration');
      const range = document.querySelector('.ytgif-timeline-range');
      return {
        duration: duration?.textContent || 'Unknown',
        range: range?.textContent || 'Unknown'
      };
    });
    console.log('        📍 Current GIF Selection:');
    console.log(`           Duration: ${selectionInfo.duration}`);
    console.log(`           Range: ${selectionInfo.range}\n`);

    // Create GIF and monitor progress
    console.log('Step 6: Starting GIF creation...');
    console.log('        🎬 CLICKING CREATE GIF BUTTON NOW!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('⚡ WATCH FOR PROGRESS UPDATES IN THE OVERLAY! ⚡\n');
    console.log('You should see:');
    console.log('  • Progress bar filling up');
    console.log('  • Stage names (Extracting, Encoding, etc.)');
    console.log('  • Percentage updates');
    console.log('  • Status messages\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const createButton = await page.$('.ytgif-timeline-create');
    if (!createButton) {
      throw new Error('Create GIF button not found');
    }
    
    await createButton.click();

    // Monitor progress in detail
    console.log('Monitoring progress (this may take 30-60 seconds):\n');
    
    let lastButtonText = '';
    let lastProgressBar = '';
    let completed = false;
    let attempts = 0;
    const maxAttempts = 120; // 60 seconds max

    while (!completed && attempts < maxAttempts) {
      // Check multiple elements for progress
      const progressInfo = await page.evaluate(() => {
        const button = document.querySelector('.ytgif-timeline-create');
        const progressContainer = document.querySelector('.ytgif-progress-container');
        const progressBar = document.querySelector('.ytgif-progress-bar');
        const stage = document.querySelector('.ytgif-progress-stage');
        const percentage = document.querySelector('.ytgif-progress-percentage');
        const message = document.querySelector('.ytgif-progress-message');
        const successFeedback = document.querySelector('.ytgif-feedback--success');
        const errorFeedback = document.querySelector('.ytgif-feedback--error');
        
        return {
          buttonText: button?.textContent || '',
          hasProgressContainer: !!progressContainer,
          progressBarWidth: progressBar ? window.getComputedStyle(progressBar).width : '0',
          stage: stage?.textContent || '',
          percentage: percentage?.textContent || '',
          message: message?.textContent || '',
          success: !!successFeedback,
          error: !!errorFeedback,
          errorText: errorFeedback?.textContent || ''
        };
      });

      // Log changes in button text
      if (progressInfo.buttonText && progressInfo.buttonText !== lastButtonText) {
        console.log(`  🔘 Button: "${progressInfo.buttonText}"`);
        lastButtonText = progressInfo.buttonText;
      }

      // Log progress container info
      if (progressInfo.hasProgressContainer) {
        if (progressInfo.stage) {
          console.log(`  📊 Stage: ${progressInfo.stage}`);
        }
        if (progressInfo.percentage && progressInfo.percentage !== '0%') {
          console.log(`  📈 Progress: ${progressInfo.percentage}`);
        }
        if (progressInfo.message) {
          console.log(`  💬 Message: ${progressInfo.message}`);
        }
        if (progressInfo.progressBarWidth !== lastProgressBar) {
          console.log(`  ⬛ Progress bar width: ${progressInfo.progressBarWidth}`);
          lastProgressBar = progressInfo.progressBarWidth;
        }
      }

      // Check for completion
      if (progressInfo.success) {
        console.log('\n✅ SUCCESS! GIF creation completed!');
        completed = true;
        break;
      }

      if (progressInfo.error) {
        console.log(`\n❌ ERROR: ${progressInfo.errorText}`);
        completed = true;
        break;
      }

      await page.waitForTimeout(500);
      attempts++;
    }

    if (!completed) {
      console.log('\n⏱️ Timeout: GIF creation took longer than expected');
    }

    // Keep the browser open for a bit so you can see the result
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('GIF creation process complete!');
    console.log('The browser will stay open for 10 seconds...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    await page.waitForTimeout(10000);

    // Take final screenshot
    await page.screenshot({ 
      path: path.join(downloadPath, 'gif-creation-result.png'),
      fullPage: false 
    });
    console.log(`Screenshot saved to: ${path.join(downloadPath, 'gif-creation-result.png')}\n`);

    await browser.close();
    console.log('Test complete! Browser closed.');
  });
});