const { test, expect, chromium } = require('@playwright/test');
const path = require('path');

test.describe('Progress Bar Final Check', () => {
  let browser;
  let page;

  test.beforeAll(async () => {
    const pathToExtension = path.join(__dirname, '..', 'dist');
    
    browser = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
      ],
      viewport: { width: 1280, height: 720 },
    });

    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await browser.close();
  });

  test('Progress bar should reach 95% width', async () => {
    // Navigate to a short YouTube video
    await page.goto('https://www.youtube.com/watch?v=jNQXAC9IVRw');
    
    // Wait for video player
    await page.waitForSelector('.html5-video-player', { timeout: 10000 });
    
    // Wait for GIF button
    await page.waitForSelector('.ytgif-button', { timeout: 10000 });
    
    // Click GIF button
    await page.click('.ytgif-button');
    
    // Wait for timeline overlay
    await page.waitForSelector('.ytgif-timeline-overlay', { timeout: 5000 });
    
    // Click Create GIF
    await page.click('.ytgif-timeline-create');
    
    // Wait for progress bar to appear
    await page.waitForSelector('.ytgif-progress-bar', { timeout: 5000 });
    
    // Wait for high progress value
    let found95 = false;
    for (let i = 0; i < 100; i++) {
      const progressText = await page.textContent('.ytgif-progress-percentage').catch(() => null);
      
      if (progressText) {
        const progressValue = parseInt(progressText);
        
        if (progressValue >= 95 && progressValue < 100) {
          // Check bar width at 95%
          const progressBar = await page.$('.ytgif-progress-bar');
          const wrapper = await page.$('.ytgif-progress-bar-wrapper');
          
          if (progressBar && wrapper) {
            const barWidth = await progressBar.evaluate(el => el.offsetWidth);
            const wrapperWidth = await wrapper.evaluate(el => el.offsetWidth);
            const ratio = barWidth / wrapperWidth;
            
            console.log(`At ${progressValue}%: Bar width = ${barWidth}px, Wrapper = ${wrapperWidth}px, Ratio = ${ratio.toFixed(2)}`);
            
            // The bar should be at least 90% of wrapper width when progress is 95%
            expect(ratio).toBeGreaterThan(0.9);
            found95 = true;
            break;
          }
        }
      }
      
      await page.waitForTimeout(100);
    }
    
    expect(found95).toBe(true);
  });
});