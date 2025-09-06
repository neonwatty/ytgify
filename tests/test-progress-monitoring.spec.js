const { test, expect, chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs').promises;

test.describe('GIF Creation Progress Monitoring', () => {
  let browser;
  let page;
  let extensionId;

  test.beforeAll(async () => {
    console.log('Setting up browser with extension...');
    
    // Launch browser with extension
    const pathToExtension = path.join(__dirname, '..', 'dist');
    console.log('Loading extension from:', pathToExtension);
    
    browser = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        '--auto-open-devtools-for-tabs'
      ],
      viewport: { width: 1280, height: 720 },
    });

    // Get the extension ID
    await browser.waitForEvent('serviceworker', { timeout: 10000 });
    const pages = browser.pages();
    for (const p of pages) {
      const url = p.url();
      if (url.includes('chrome-extension://')) {
        extensionId = url.split('/')[2];
        console.log('Found Extension ID:', extensionId);
        break;
      }
    }

    page = await browser.newPage();
    
    // Enable console logging
    page.on('console', msg => {
      console.log('PAGE LOG:', msg.text());
    });
    
    page.on('pageerror', err => {
      console.log('PAGE ERROR:', err.message);
    });
  });

  test.afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  test('Monitor GIF creation progress in detail', async () => {
    test.setTimeout(180000); // 3 minutes

    // Navigate to YouTube video (short video for faster testing)
    console.log('\n=== Navigating to YouTube ===');
    await page.goto('https://www.youtube.com/watch?v=jNQXAC9IVRw', { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });

    // Wait for video player
    console.log('Waiting for video player...');
    await page.waitForSelector('video', { timeout: 15000 });
    const video = await page.$('video');
    
    // Play video and wait for it to load
    console.log('Starting video playback...');
    await page.evaluate(() => {
      const v = document.querySelector('video');
      if (v) {
        v.play();
        v.currentTime = 5; // Skip to 5 seconds
      }
    });
    
    await page.waitForTimeout(3000);

    // Accept cookies if present
    try {
      const acceptButton = await page.$('[aria-label*="Accept"], [aria-label*="Reject"]');
      if (acceptButton) {
        await acceptButton.click();
        console.log('Handled cookie dialog');
      }
    } catch (e) {}

    // Look for GIF button with multiple strategies
    console.log('\n=== Looking for GIF button ===');
    let gifButton = null;
    
    // Strategy 1: Look in player controls
    const playerControls = await page.$('.ytp-right-controls, .ytp-chrome-controls');
    if (playerControls) {
      console.log('Found player controls');
      gifButton = await playerControls.$('.ytgif-button, [aria-label*="GIF"], [title*="GIF"]');
    }
    
    // Strategy 2: Global search
    if (!gifButton) {
      gifButton = await page.$('.ytgif-button, .ytp-button[aria-label*="GIF"], button[title*="Create GIF"]');
    }
    
    if (!gifButton) {
      // Take screenshot for debugging
      await page.screenshot({ path: 'tests/downloads/no-gif-button.png', fullPage: false });
      throw new Error('GIF button not found after all strategies');
    }

    console.log('✓ Found GIF button');
    
    // Click the GIF button
    console.log('\n=== Activating GIF Mode ===');
    await gifButton.click();
    await page.waitForTimeout(1500);

    // Verify timeline overlay appeared
    const overlay = await page.$('#ytgif-timeline-overlay');
    if (!overlay) {
      await page.screenshot({ path: 'tests/downloads/no-overlay.png', fullPage: false });
      throw new Error('Timeline overlay did not appear');
    }
    console.log('✓ Timeline overlay appeared');

    // Get initial selection info
    const selectionInfo = await page.evaluate(() => {
      const durationEl = document.querySelector('.ytgif-timeline-duration');
      const rangeEl = document.querySelector('.ytgif-timeline-range');
      return {
        duration: durationEl?.textContent,
        range: rangeEl?.textContent
      };
    });
    console.log('Selection:', selectionInfo);

    // Find and click Create GIF button
    console.log('\n=== Starting GIF Creation ===');
    const createButton = await page.$('.ytgif-timeline-create');
    if (!createButton) {
      throw new Error('Create GIF button not found');
    }
    
    // Set up progress monitoring before clicking
    const progressUpdates = [];
    const checkInterval = setInterval(async () => {
      try {
        const progressData = await page.evaluate(() => {
          const container = document.querySelector('.ytgif-progress-container');
          const button = document.querySelector('.ytgif-timeline-create');
          
          if (container) {
            const stage = document.querySelector('.ytgif-progress-stage')?.textContent;
            const percentage = document.querySelector('.ytgif-progress-percentage')?.textContent;
            const message = document.querySelector('.ytgif-progress-message')?.textContent;
            const progressBar = document.querySelector('.ytgif-progress-bar');
            const width = progressBar ? window.getComputedStyle(progressBar).width : '0';
            
            return {
              stage,
              percentage,
              message,
              progressWidth: width,
              buttonText: button?.textContent,
              visible: true
            };
          }
          
          return {
            buttonText: button?.textContent,
            visible: false
          };
        });
        
        if (progressData.visible || (progressData.buttonText && progressData.buttonText !== 'Create GIF')) {
          progressUpdates.push(progressData);
          console.log(`[PROGRESS] Stage: ${progressData.stage || 'N/A'}, ` +
                     `Percentage: ${progressData.percentage || 'N/A'}, ` +
                     `Message: ${progressData.message || 'N/A'}, ` +
                     `Button: ${progressData.buttonText || 'N/A'}`);
        }
      } catch (e) {
        // Ignore errors during monitoring
      }
    }, 500); // Check every 500ms

    // Click create button
    await createButton.click();
    console.log('✓ Clicked Create GIF button');

    // Wait for completion or timeout
    console.log('\n=== Monitoring Progress ===');
    let completed = false;
    let attempts = 0;
    const maxAttempts = 120; // 60 seconds with 500ms intervals

    while (!completed && attempts < maxAttempts) {
      // Check for completion indicators
      const status = await page.evaluate(() => {
        const successFeedback = document.querySelector('.ytgif-feedback--success');
        const errorFeedback = document.querySelector('.ytgif-feedback--error');
        const createButton = document.querySelector('.ytgif-timeline-create');
        const isCreating = createButton?.classList.contains('loading') || 
                          createButton?.textContent?.includes('Creating') ||
                          createButton?.textContent?.includes('%');
        
        return {
          success: !!successFeedback,
          error: !!errorFeedback,
          errorText: errorFeedback?.textContent,
          isCreating,
          buttonText: createButton?.textContent
        };
      });

      if (status.success) {
        console.log('\n✓ GIF creation completed successfully!');
        completed = true;
        break;
      }

      if (status.error) {
        console.error(`✗ GIF creation failed: ${status.errorText}`);
        completed = true;
        break;
      }

      await page.waitForTimeout(500);
      attempts++;
    }

    clearInterval(checkInterval);

    // Summary of progress updates
    console.log(`\n=== Progress Summary ===`);
    console.log(`Total progress updates captured: ${progressUpdates.length}`);
    
    if (progressUpdates.length > 0) {
      console.log('\nUnique stages observed:');
      const stages = [...new Set(progressUpdates.filter(u => u.stage).map(u => u.stage))];
      stages.forEach(stage => console.log(`  - ${stage}`));
      
      console.log('\nSample messages:');
      const messages = [...new Set(progressUpdates.filter(u => u.message).map(u => u.message))];
      messages.slice(0, 5).forEach(msg => console.log(`  - ${msg}`));
    } else {
      console.log('WARNING: No progress updates were captured!');
    }

    // Try to download the GIF if created
    if (completed && !attempts >= maxAttempts) {
      console.log('\n=== Attempting to Download GIF ===');
      
      await page.waitForTimeout(3000); // Wait for any animations to complete
      
      // Open extension popup
      const popupPage = await browser.newPage();
      await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
      await popupPage.waitForTimeout(2000);
      
      // Check library
      const libraryTab = await popupPage.$('button:has-text("Library")');
      if (libraryTab) {
        await libraryTab.click();
        await popupPage.waitForTimeout(1000);
      }
      
      const gifCount = await popupPage.$$eval('.gif-card, [data-testid="gif-card"], .library-item', 
        elements => elements.length
      );
      console.log(`Found ${gifCount} GIFs in library`);
      
      await popupPage.close();
    }

    // Take final screenshot
    await page.screenshot({ 
      path: 'tests/downloads/final-state.png', 
      fullPage: false 
    });
    
    console.log('\n=== Test Complete ===');
    
    // Assert we got some progress updates
    expect(progressUpdates.length).toBeGreaterThan(0);
  });
});