const { test, expect, chromium } = require('@playwright/test');
const path = require('path');

test.describe('From Current Button Removal', () => {
  let browser;
  let page;

  test.beforeAll(async () => {
    // Launch browser with extension
    const pathToExtension = path.join(__dirname, '..', 'dist');
    browser = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`
      ],
      viewport: { width: 1280, height: 720 }
    });
    
    page = browser.pages()[0] || await browser.newPage();
  });

  test.afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  test('From Current button should not exist in Quick Capture Preview', async () => {
    // Go to YouTube video
    await page.goto('https://www.youtube.com/watch?v=jNQXAC9IVRw');
    
    // Wait for video player to load
    await page.waitForSelector('.html5-video-player', { timeout: 10000 });
    
    // Wait for extension to inject
    await page.waitForTimeout(5000);
    
    console.log('Looking for GIF button...');
    
    // Find and click GIF button
    const gifButton = await page.locator('.ytgif-button').first();
    await gifButton.click();
    console.log('Clicked GIF button');
    
    // Wait for wizard
    await page.waitForSelector('.ytgif-overlay-wizard', { timeout: 5000 });
    console.log('Wizard opened');
    
    // Wait for auto-advance to Quick Capture
    await page.waitForTimeout(4000);
    
    // Check if we're on Quick Capture screen
    const screenTitle = await page.locator('.ytgif-wizard-title').textContent();
    console.log('Current screen:', screenTitle);
    
    if (screenTitle.includes('Quick Capture')) {
      // Check for preset buttons
      const presetButtons = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('.ytgif-preset-btn')).map(btn => btn.textContent?.trim());
      });
      
      console.log('Preset buttons found:', presetButtons);
      
      // Verify "From Current" is not present
      const hasFromCurrent = presetButtons.some(btn => btn?.includes('From Current') || btn?.includes('At Current'));
      
      console.log('\n=== TEST RESULTS ===');
      console.log('Preset buttons:', presetButtons);
      console.log('Has "From Current" button:', hasFromCurrent);
      console.log('Expected buttons: 3s, 5s, 10s');
      
      // Take screenshot for verification
      await page.screenshot({ path: 'tests/screenshots/no-from-current-button.png' });
      console.log('Screenshot saved to tests/screenshots/no-from-current-button.png');
      
      // Assert that From Current button does not exist
      expect(hasFromCurrent).toBe(false);
      expect(presetButtons).toEqual(['3s', '5s', '10s']);
    } else {
      console.log('Not on Quick Capture screen');
    }
  });
});