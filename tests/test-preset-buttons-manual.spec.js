const { test, expect, chromium } = require('@playwright/test');
const path = require('path');

test.describe('Manual Test - Preset Buttons', () => {
  test('Manual navigation to Custom Range screen', async () => {
    // Launch browser with extension
    const pathToExtension = path.join(__dirname, '..', 'dist');
    const browser = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`
      ],
      viewport: { width: 1280, height: 720 },
      slowMo: 500 // Slow down for manual observation
    });
    
    const page = browser.pages()[0] || await browser.newPage();
    
    // Go to YouTube video
    await page.goto('https://www.youtube.com/watch?v=jNQXAC9IVRw');
    
    // Wait for video player
    await page.waitForSelector('.html5-video-player', { timeout: 10000 });
    
    console.log('=== MANUAL TEST INSTRUCTIONS ===');
    console.log('1. Wait for the GIF button to appear in the YouTube player');
    console.log('2. Click the GIF button');
    console.log('3. When wizard opens, navigate to Custom Range screen');
    console.log('4. Test the 5s and 10s preset buttons');
    console.log('5. Observe if clicking 10s button multiple times changes the duration');
    console.log('');
    console.log('The browser will stay open for 60 seconds for testing...');
    
    // Keep browser open for manual testing
    await page.waitForTimeout(60000);
    
    console.log('Test complete. Closing browser...');
    await browser.close();
  });
});