const { test, expect, chromium } = require('@playwright/test');
const path = require('path');

test.describe('Scrubber Timestamp Visibility', () => {
  let browser;
  let context;
  let page;

  test.beforeAll(async () => {
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
    
    // Get the first page
    page = browser.pages()[0] || await browser.newPage();
  });

  test.afterAll(async () => {
    await browser.close();
  });

  test('Check scrubber timestamp visibility', async () => {
    // Navigate to a YouTube video
    await page.goto('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    
    // Wait for video player to load
    await page.waitForSelector('.html5-video-player', { timeout: 10000 });
    
    // Wait a bit for the extension to initialize
    await page.waitForTimeout(3000);
    
    // Click the GIF button in the player controls
    const gifButton = await page.$('.ytgif-button');
    if (gifButton) {
      await gifButton.click();
      await page.waitForTimeout(1000);
    } else {
      // Try keyboard shortcut as fallback
      await page.keyboard.press('Control+Shift+G');
      await page.waitForTimeout(1000);
    }
    
    // Wait for wizard overlay to appear
    await page.waitForSelector('.ytgif-wizard-overlay', { timeout: 5000 });
    
    // Click Quick Capture
    const quickCaptureBtn = await page.$('.ytgif-action-card');
    if (quickCaptureBtn) {
      await quickCaptureBtn.click();
      await page.waitForTimeout(1000);
    }
    
    // Wait for the scrubber to appear
    await page.waitForSelector('.ytgif-timeline-scrubber', { timeout: 5000 });
    
    // Take a screenshot of the scrubber area
    const scrubber = await page.$('.ytgif-timeline-scrubber');
    if (scrubber) {
      await scrubber.screenshot({ path: 'tests/screenshots/scrubber-timestamps.png' });
      console.log('Screenshot saved to tests/screenshots/scrubber-timestamps.png');
    }
    
    // Also take a full wizard screenshot for context
    const wizard = await page.$('.ytgif-wizard-overlay');
    if (wizard) {
      await wizard.screenshot({ path: 'tests/screenshots/wizard-full.png' });
      console.log('Full wizard screenshot saved');
    }
    
    // Check if timestamp labels are visible
    const timestampLabels = await page.$$('.ytgif-handle-timestamp');
    console.log(`Found ${timestampLabels.length} timestamp labels`);
    
    // Check their visibility
    for (let i = 0; i < timestampLabels.length; i++) {
      const isVisible = await timestampLabels[i].isVisible();
      const boundingBox = await timestampLabels[i].boundingBox();
      console.log(`Timestamp ${i}: visible=${isVisible}, bounds=`, boundingBox);
    }
  });
});