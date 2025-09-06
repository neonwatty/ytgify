const { test, chromium } = require('@playwright/test');
const path = require('path');

test.describe('Debug Console Logs', () => {
  test('Capture console logs during GIF creation', async () => {
    test.setTimeout(120000); // 2 minutes

    console.log('=== Starting Console Debug Test ===\n');
    
    // Launch browser with extension
    const pathToExtension = path.join(__dirname, '..', 'dist');
    console.log('Loading extension from:', pathToExtension);
    
    const browser = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
      ],
      viewport: { width: 1280, height: 720 }
    });

    // Get extension ID
    let extensionId;
    const serviceWorker = await browser.waitForEvent('serviceworker', { timeout: 10000 });
    if (serviceWorker && serviceWorker.url) {
      const match = serviceWorker.url().match(/chrome-extension:\/\/([^\/]+)/);
      if (match) {
        extensionId = match[1];
        console.log('Extension ID:', extensionId);
      }
    }

    // Capture console logs from content script
    const page = await browser.newPage();
    
    // Listen for console messages
    page.on('console', async msg => {
      const type = msg.type();
      const text = msg.text();
      const location = msg.location();
      
      // Filter for our extension logs
      if (text.includes('[Content]') || 
          text.includes('[ContentScriptFrameExtractor]') || 
          text.includes('[SimpleFrameExtractor]') ||
          text.includes('[InstantCapture]') ||
          text.includes('[VideoProcessor]') ||
          text.includes('GIF') ||
          text.includes('frame')) {
        console.log(`[${type.toUpperCase()}] ${text}`);
        if (location.url) {
          console.log(`  at ${location.url}:${location.lineNumber}`);
        }
      }
    });

    // Also capture service worker logs
    if (extensionId) {
      const swPage = await browser.newPage();
      await swPage.goto(`chrome-extension://${extensionId}/_generated_background_page.html`);
      
      swPage.on('console', async msg => {
        const text = msg.text();
        if (text.includes('[ServiceWorker]') || 
            text.includes('[BackgroundWorker]') ||
            text.includes('[MessageHandler]') ||
            text.includes('frame') ||
            text.includes('GIF')) {
          console.log(`[SERVICE-WORKER] ${text}`);
        }
      });
    }

    // Navigate to YouTube
    console.log('\n1. Navigating to YouTube video...');
    await page.goto('https://www.youtube.com/watch?v=jNQXAC9IVRw', { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });

    // Wait for video to load
    console.log('2. Waiting for video player...');
    await page.waitForSelector('video', { timeout: 15000 });
    
    await page.evaluate(() => {
      const video = document.querySelector('video');
      if (video) {
        video.currentTime = 5;
        video.play();
      }
    });
    
    await page.waitForTimeout(3000);

    // Find and click GIF button
    console.log('3. Looking for GIF button...');
    const gifButton = await page.$('.ytgif-button');
    
    if (!gifButton) {
      console.log('GIF button not found!');
      await browser.close();
      return;
    }
    
    console.log('4. Clicking GIF button...');
    await gifButton.click();
    await page.waitForTimeout(2000);

    // Wait for timeline overlay
    console.log('5. Waiting for timeline overlay...');
    await page.waitForFunction(() => {
      const overlay = document.querySelector('#ytgif-timeline-overlay');
      return overlay && window.getComputedStyle(overlay).display !== 'none';
    }, { timeout: 10000 }).catch(() => {});

    // Click Create GIF
    console.log('6. Starting GIF creation...');
    const createButton = await page.$('.ytgif-timeline-create');
    if (createButton) {
      await createButton.click();
      
      // Wait and monitor for 30 seconds
      console.log('7. Monitoring console logs for 30 seconds...\n');
      console.log('=== CONSOLE OUTPUT DURING GIF CREATION ===\n');
      
      for (let i = 0; i < 30; i++) {
        await page.waitForTimeout(1000);
        
        // Check button status
        const buttonText = await page.$eval('.ytgif-timeline-create', el => el.textContent).catch(() => null);
        if (buttonText && buttonText !== 'Creating...') {
          console.log(`\nButton status changed to: ${buttonText}`);
        }
        
        // Check for completion
        if (await page.$('.ytgif-feedback--success')) {
          console.log('\n✅ GIF creation completed!');
          break;
        }
        
        if (await page.$('.ytgif-feedback--error')) {
          const error = await page.$eval('.ytgif-feedback--error', el => el.textContent).catch(() => '');
          console.log(`\n❌ Error: ${error}`);
          break;
        }
      }
    }

    console.log('\n=== END OF CONSOLE OUTPUT ===\n');
    
    // Keep open for a moment
    await page.waitForTimeout(3000);
    
    await browser.close();
    console.log('Test complete - check console output above for debugging info');
  });
});