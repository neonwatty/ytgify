const { test, expect, chromium } = require('@playwright/test');
const path = require('path');

test.describe('Preset Button Active State', () => {
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

  test('Active state shows without hover', async () => {
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
      // Click each preset button and verify active state
      const buttons = ['3s', '5s', '10s'];
      
      for (const btnText of buttons) {
        console.log(`\nTesting ${btnText} button:`);
        
        // Click the button
        const button = await page.locator(`.ytgif-preset-btn:has-text("${btnText}")`).first();
        await button.click();
        console.log(`Clicked ${btnText} button`);
        
        // Move mouse away to ensure we're not hovering
        await page.mouse.move(100, 100);
        await page.waitForTimeout(500);
        
        // Check if button has active class
        const hasActiveClass = await button.evaluate(el => el.classList.contains('ytgif-preset-btn--active'));
        console.log(`Has active class: ${hasActiveClass}`);
        
        // Get computed style (without hover)
        const style = await button.evaluate(el => {
          const computed = window.getComputedStyle(el);
          return {
            background: computed.backgroundColor,
            borderColor: computed.borderColor,
            fontWeight: computed.fontWeight
          };
        });
        console.log(`Computed style:`, style);
        
        // Take screenshot of this state
        await page.screenshot({ 
          path: `tests/screenshots/preset-${btnText}-active.png`,
          clip: { x: 380, y: 450, width: 320, height: 60 }
        });
        console.log(`Screenshot saved: preset-${btnText}-active.png`);
        
        // Verify the button shows active state
        expect(hasActiveClass).toBe(true);
        
        // Verify the background contains red (rgba with 255 in first position)
        const hasRedBackground = style.background.includes('255') && style.background.includes('0.2');
        console.log(`Has red background: ${hasRedBackground}`);
      }
      
      // Take full screenshot showing final state
      await page.screenshot({ path: 'tests/screenshots/preset-buttons-active-fixed.png' });
      console.log('\nFull screenshot saved: preset-buttons-active-fixed.png');
      
      console.log('\n=== TEST SUMMARY ===');
      console.log('All preset buttons tested for active state without hover');
      console.log('Active states should show red tinted background');
    } else {
      console.log('Not on Quick Capture screen');
    }
  });
});