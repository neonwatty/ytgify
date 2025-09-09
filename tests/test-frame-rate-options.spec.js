const { test, expect, chromium } = require('@playwright/test');
const path = require('path');

test.describe('Frame Rate Options in Quick Capture', () => {
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

  test('Frame rate options are present and selectable', async () => {
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
      // Check for frame rate section
      const frameRateSection = await page.locator('.ytgif-frame-rate-section');
      const sectionExists = await frameRateSection.isVisible();
      console.log('Frame rate section visible:', sectionExists);
      
      // Get frame rate button information
      const frameRateInfo = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('.ytgif-frame-rate-btn'));
        const activeButton = document.querySelector('.ytgif-frame-rate-btn--active');
        
        return {
          buttons: buttons.map(btn => {
            const text = btn.textContent?.trim().split('\n')[0];
            const isActive = btn.classList.contains('ytgif-frame-rate-btn--active');
            return { text, isActive };
          }),
          activeButtonText: activeButton?.textContent?.trim().split('\n')[0],
          sectionLabel: document.querySelector('.ytgif-frame-rate-label span')?.textContent
        };
      });
      
      console.log('Frame rate info:', frameRateInfo);
      
      // Test clicking different frame rate options
      const fiveButton = await page.locator('.ytgif-frame-rate-btn:has-text("5 fps")').first();
      if (await fiveButton.isVisible()) {
        await fiveButton.click();
        console.log('Clicked 5 fps button');
        
        // Check if it becomes active
        const isActive5 = await fiveButton.evaluate(el => el.classList.contains('ytgif-frame-rate-btn--active'));
        console.log('5 fps button active:', isActive5);
        
        // Check frame count update
        const frameCount5 = await page.locator('.ytgif-info-value').nth(1).textContent();
        console.log('Frame count at 5 fps:', frameCount5);
      }
      
      // Click 15 fps button
      const fifteenButton = await page.locator('.ytgif-frame-rate-btn:has-text("15 fps")').first();
      if (await fifteenButton.isVisible()) {
        await fifteenButton.click();
        console.log('Clicked 15 fps button');
        
        // Check if it becomes active
        const isActive15 = await fifteenButton.evaluate(el => el.classList.contains('ytgif-frame-rate-btn--active'));
        console.log('15 fps button active:', isActive15);
        
        // Check frame count update
        const frameCount15 = await page.locator('.ytgif-info-value').nth(1).textContent();
        console.log('Frame count at 15 fps:', frameCount15);
        
        // Check estimated size update
        const estSize = await page.locator('.ytgif-info-value').nth(2).textContent();
        console.log('Estimated size at 15 fps:', estSize);
      }
      
      // Take screenshot
      await page.screenshot({ path: 'tests/screenshots/frame-rate-options.png' });
      console.log('Screenshot saved to tests/screenshots/frame-rate-options.png');
      
      console.log('\n=== TEST RESULTS ===');
      console.log('Frame rate section exists:', sectionExists);
      console.log('Frame rate buttons found:', frameRateInfo.buttons.length);
      console.log('Expected buttons: 5 fps, 10 fps, 15 fps');
      console.log('Default active button:', frameRateInfo.activeButtonText);
      
      // Assertions
      expect(sectionExists).toBe(true);
      expect(frameRateInfo.buttons.length).toBe(3);
      expect(frameRateInfo.activeButtonText).toContain('10 fps'); // Default should be 10 fps
    } else {
      console.log('Not on Quick Capture screen');
    }
  });
});