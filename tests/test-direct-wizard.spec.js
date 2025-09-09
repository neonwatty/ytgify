const { test, expect, chromium } = require('@playwright/test');
const path = require('path');

test.describe('Direct Wizard Test', () => {
  let browser;
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
    
    page = browser.pages()[0] || await browser.newPage();
  });

  test.afterAll(async () => {
    await browser.close();
  });

  test('Open wizard and check scrubber', async () => {
    // Navigate to a YouTube video
    await page.goto('https://www.youtube.com/watch?v=jNQXAC9IVRw');
    
    // Wait for video to load
    await page.waitForSelector('.html5-video-player', { timeout: 15000 });
    await page.waitForTimeout(3000);
    
    // Try to trigger wizard via console
    await page.evaluate(() => {
      window.postMessage({ type: 'TRIGGER_GIF_WIZARD' }, '*');
    });
    
    // Wait a moment
    await page.waitForTimeout(2000);
    
    // Try keyboard shortcut
    await page.keyboard.down('Control');
    await page.keyboard.down('Shift');
    await page.keyboard.press('G');
    await page.keyboard.up('Shift');
    await page.keyboard.up('Control');
    
    await page.waitForTimeout(2000);
    
    // Check if wizard is open
    const wizardVisible = await page.$('.ytgif-wizard-overlay');
    if (wizardVisible) {
      console.log('Wizard is visible!');
      
      // Try to click quick capture
      const actionCard = await page.$('.ytgif-action-card');
      if (actionCard) {
        await actionCard.click();
        await page.waitForTimeout(1500);
        
        // Take screenshot
        await page.screenshot({ path: 'tests/screenshots/direct-wizard-test.png', fullPage: true });
        console.log('Screenshot saved!');
      }
    } else {
      console.log('Wizard not found, taking debug screenshot');
      await page.screenshot({ path: 'tests/screenshots/no-wizard-debug.png', fullPage: true });
    }
  });
});
