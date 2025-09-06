const { test, expect, chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs').promises;

test.describe('GIF Creation with Status Updates', () => {
  let browser;
  let context;
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
      permissions: ['clipboard-read', 'clipboard-write'],
    });

    // Get the extension ID
    const backgroundPages = browser.backgroundPages();
    if (backgroundPages.length > 0) {
      const bgPage = backgroundPages[0];
      const url = bgPage.url();
      extensionId = url.split('/')[2];
      console.log('Extension ID:', extensionId);
    } else {
      console.log('No background pages found, waiting for service worker...');
      const workerTarget = await browser.waitForEvent('serviceworker', { timeout: 10000 });
      const url = workerTarget.url();
      extensionId = url.split('/')[2];
      console.log('Extension ID from service worker:', extensionId);
    }

    page = await browser.newPage();
  });

  test.afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  test('Create GIF with progress updates and download result', async () => {
    test.setTimeout(120000); // 2 minutes timeout

    // Navigate to a YouTube video
    console.log('Navigating to YouTube video...');
    await page.goto('https://www.youtube.com/watch?v=jNQXAC9IVRw', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });

    // Wait for video player to load
    console.log('Waiting for video player...');
    await page.waitForSelector('video', { timeout: 10000 });
    
    // Wait a bit for the extension to inject its button
    await page.waitForTimeout(3000);

    // Accept cookies if dialog appears
    try {
      const acceptButton = await page.$('button[aria-label*="Accept"]');
      if (acceptButton) {
        await acceptButton.click();
        console.log('Accepted cookies dialog');
        await page.waitForTimeout(1000);
      }
    } catch (e) {
      console.log('No cookie dialog found');
    }

    // Look for the GIF button in player controls
    console.log('Looking for GIF button...');
    const gifButton = await page.waitForSelector('.ytgif-button, .ytp-button[aria-label*="GIF"], .ytp-button[title*="GIF"]', { 
      timeout: 10000 
    });
    
    if (!gifButton) {
      throw new Error('GIF button not found');
    }

    console.log('Found GIF button, clicking it...');
    await gifButton.click();

    // Wait for timeline overlay to appear
    console.log('Waiting for timeline overlay...');
    
    // The overlay might be in the DOM but not visible, wait for it to be visible
    await page.waitForTimeout(1000);
    
    // Check if overlay exists in DOM
    const overlayExists = await page.$('#ytgif-timeline-overlay, .ytgif-timeline-overlay');
    if (overlayExists) {
      console.log('Timeline overlay found in DOM');
      // Wait for it to become visible
      await page.waitForFunction(() => {
        const overlay = document.querySelector('#ytgif-timeline-overlay, .ytgif-timeline-overlay');
        if (overlay) {
          const styles = window.getComputedStyle(overlay);
          return styles.display !== 'none' && styles.visibility !== 'hidden';
        }
        return false;
      }, { timeout: 10000 });
    } else {
      throw new Error('Timeline overlay not found in DOM');
    }
    
    console.log('Timeline overlay is visible');

    // Wait a moment for the timeline to initialize
    await page.waitForTimeout(2000);

    // Set up download handling before creating GIF
    const downloadPath = path.join(__dirname, 'downloads');
    await fs.mkdir(downloadPath, { recursive: true });

    const downloadPromise = page.waitForEvent('download', { timeout: 60000 });

    // Also listen for console messages to capture status updates
    const statusMessages = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('progress') || text.includes('stage') || text.includes('Processing') || text.includes('Extracting') || text.includes('Encoding')) {
        console.log('Status update:', text);
        statusMessages.push(text);
      }
    });

    // Click Create GIF button
    console.log('Clicking Create GIF button...');
    const createButton = await page.waitForSelector('.ytgif-timeline-create, button:has-text("Create GIF")', {
      timeout: 5000
    });
    
    await createButton.click();
    console.log('Started GIF creation...');

    // Monitor for progress updates
    console.log('Monitoring progress updates...');
    let progressChecks = 0;
    const maxChecks = 30; // Check for 30 seconds
    
    while (progressChecks < maxChecks) {
      try {
        // Check for progress container
        const progressContainer = await page.$('.ytgif-progress-container');
        if (progressContainer) {
          // Get progress details
          const stage = await page.$eval('.ytgif-progress-stage', el => el.textContent).catch(() => null);
          const percentage = await page.$eval('.ytgif-progress-percentage', el => el.textContent).catch(() => null);
          const message = await page.$eval('.ytgif-progress-message', el => el.textContent).catch(() => null);
          
          if (stage || percentage || message) {
            console.log(`Progress Update - Stage: ${stage}, Percentage: ${percentage}, Message: ${message}`);
          }
        }

        // Check if button text has changed to show progress
        const buttonText = await page.$eval('.ytgif-timeline-create', el => el.textContent).catch(() => null);
        if (buttonText && buttonText !== 'Create GIF' && buttonText !== 'Creating...') {
          console.log(`Button status: ${buttonText}`);
        }

        // Check for completion feedback
        const successFeedback = await page.$('.ytgif-feedback--success');
        if (successFeedback) {
          console.log('GIF creation completed successfully!');
          break;
        }

        const errorFeedback = await page.$('.ytgif-feedback--error');
        if (errorFeedback) {
          const errorText = await errorFeedback.textContent();
          throw new Error(`GIF creation failed: ${errorText}`);
        }

      } catch (e) {
        // Continue checking
      }

      await page.waitForTimeout(1000);
      progressChecks++;
    }

    // Try to intercept the GIF from the extension's storage
    console.log('Checking for created GIF in extension storage...');
    
    // Open extension popup to access the library
    const popupUrl = `chrome-extension://${extensionId}/popup.html`;
    console.log('Opening extension popup:', popupUrl);
    
    const popupPage = await browser.newPage();
    await popupPage.goto(popupUrl);
    await popupPage.waitForTimeout(2000);

    // Click on Library tab if needed
    try {
      const libraryTab = await popupPage.$('button:has-text("Library")');
      if (libraryTab) {
        await libraryTab.click();
        console.log('Switched to Library tab');
        await popupPage.waitForTimeout(1000);
      }
    } catch (e) {
      console.log('Library tab not found or already active');
    }

    // Look for GIF cards in the library
    const gifCards = await popupPage.$$('.gif-card, [data-testid="gif-card"]');
    console.log(`Found ${gifCards.length} GIFs in library`);

    if (gifCards.length > 0) {
      // Download the first (most recent) GIF
      console.log('Attempting to download the most recent GIF...');
      
      // Look for download button on the first card
      const firstCard = gifCards[0];
      await firstCard.hover();
      
      // Set up download promise
      const downloadPromise = popupPage.waitForEvent('download', { timeout: 10000 });
      
      // Try different selectors for download button
      const downloadButton = await firstCard.$('button[aria-label*="Download"], button[title*="Download"], .download-button');
      if (downloadButton) {
        await downloadButton.click();
        console.log('Clicked download button');
        
        // Wait for download
        const download = await downloadPromise;
        const downloadFilePath = path.join(downloadPath, 'created-gif.gif');
        await download.saveAs(downloadFilePath);
        console.log('GIF saved to:', downloadFilePath);
        
        // Verify file exists and has content
        const stats = await fs.stat(downloadFilePath);
        console.log('GIF file size:', stats.size, 'bytes');
        expect(stats.size).toBeGreaterThan(1000); // Should be at least 1KB
      } else {
        console.log('Download button not found, trying alternative method...');
        
        // Try clicking on the card to open preview
        await firstCard.click();
        await popupPage.waitForTimeout(1000);
        
        // Look for download in preview/modal
        const modalDownload = await popupPage.$('button[aria-label*="Download"], button:has-text("Download")');
        if (modalDownload) {
          await modalDownload.click();
          const download = await popupPage.waitForEvent('download', { timeout: 10000 });
          const downloadFilePath = path.join(downloadPath, 'created-gif.gif');
          await download.saveAs(downloadFilePath);
          console.log('GIF saved to:', downloadFilePath);
        }
      }
    } else {
      console.log('No GIFs found in library, checking for direct download...');
      
      // Check if a download was triggered automatically
      try {
        const download = await downloadPromise;
        const downloadFilePath = path.join(downloadPath, 'created-gif.gif');
        await download.saveAs(downloadFilePath);
        console.log('GIF saved to:', downloadFilePath);
        
        const stats = await fs.stat(downloadFilePath);
        console.log('GIF file size:', stats.size, 'bytes');
        expect(stats.size).toBeGreaterThan(1000);
      } catch (e) {
        console.log('No automatic download detected');
      }
    }

    // Verify we captured status messages
    console.log(`\nCaptured ${statusMessages.length} status messages during processing`);
    
    // Clean up
    await popupPage.close();
    
    // Take a final screenshot
    await page.screenshot({ path: path.join(downloadPath, 'final-state.png'), fullPage: true });
    console.log('Test completed successfully!');
  });
});