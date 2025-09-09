const { test, chromium } = require('@playwright/test');
const path = require('path');

test.describe('Extension Icon Click Test', () => {
  let browser;
  let page;

  test('Click extension icon and check wizard', async () => {
    // Launch browser with extension
    const pathToExtension = path.join(__dirname, '../dist');
    browser = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`
      ],
      viewport: { width: 1280, height: 720 }
    });
    
    page = browser.pages()[0] || await browser.newPage();
    
    // Navigate to YouTube video
    await page.goto('https://www.youtube.com/watch?v=jNQXAC9IVRw');
    await page.waitForSelector('.html5-video-player', { timeout: 15000 });
    await page.waitForTimeout(3000);
    
    // Click extension icon in toolbar (manual intervention needed)
    console.log('Please click the extension icon in the toolbar...');
    await page.waitForTimeout(5000); // Give time for manual click
    
    // Then click "Create GIF" in popup
    const popupPage = browser.pages().find(p => p.url().includes('popup.html'));
    if (popupPage) {
      await popupPage.waitForSelector('.create-button', { timeout: 5000 });
      await popupPage.click('.create-button');
      await page.waitForTimeout(2000);
    }
    
    // Check for wizard
    const wizard = await page.$('.ytgif-wizard-overlay');
    if (wizard) {
      console.log('Wizard found! Clicking Quick Capture...');
      
      // Click first action card (Quick Capture)
      const cards = await page.$$('.ytgif-action-card');
      if (cards.length > 0) {
        await cards[0].click();
        await page.waitForTimeout(2000);
        
        // Take screenshot of the scrubber
        const scrubber = await page.$('.ytgif-timeline-scrubber');
        if (scrubber) {
          const box = await scrubber.boundingBox();
          console.log('Scrubber bounding box:', box);
          
          // Take screenshot with extra padding
          await page.screenshot({ 
            path: 'tests/screenshots/scrubber-full-context.png',
            clip: box ? {
              x: Math.max(0, box.x - 50),
              y: Math.max(0, box.y - 100), // Extra space above
              width: box.width + 100,
              height: box.height + 150
            } : undefined
          });
          console.log('Screenshot saved!');
        }
      }
    }
    
    await browser.close();
  });
});
