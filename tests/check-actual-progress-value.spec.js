const { test, expect, chromium } = require('@playwright/test');
const path = require('path');

test.describe('Check Actual Progress Value', () => {
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

  test('Check processingStatus object', async () => {
    // Navigate to YouTube
    await page.goto('https://www.youtube.com/watch?v=jNQXAC9IVRw');
    
    // Wait for video player and button
    await page.waitForSelector('.html5-video-player', { timeout: 10000 });
    await page.waitForSelector('.ytgif-button', { timeout: 10000 });
    
    // Click GIF button
    await page.click('.ytgif-button');
    await page.waitForSelector('.ytgif-timeline-overlay', { timeout: 5000 });
    
    // Inject a script to capture the React props
    await page.evaluate(() => {
      window.__DEBUG_PROGRESS = [];
      const originalLog = console.log;
      console.log = function(...args) {
        originalLog.apply(console, args);
        const str = args[0];
        if (typeof str === 'string' && str.includes('[TimelineOverlay] Props updated:')) {
          window.__DEBUG_PROGRESS.push(args[1]);
        }
      };
    });
    
    // Click Create GIF
    await page.click('.ytgif-timeline-create');
    await page.waitForSelector('.ytgif-progress-bar', { timeout: 5000 });
    
    // Wait for completion
    await page.waitForTimeout(10000);
    
    // Get captured progress values
    const progressData = await page.evaluate(() => window.__DEBUG_PROGRESS);
    
    console.log('Captured progress updates:');
    progressData.forEach((data, i) => {
      if (data.processingStatus) {
        console.log(`Update ${i}: progress=${data.processingStatus.progress}, stage=${data.processingStatus.stage}`);
      }
    });
    
    // Find max progress value
    const maxProgress = Math.max(...progressData
      .filter(d => d.processingStatus)
      .map(d => d.processingStatus.progress));
    
    console.log(`\nMaximum progress value in props: ${maxProgress}`);
    
    // Also check the final DOM state
    const finalState = await page.evaluate(() => {
      const bar = document.querySelector('.ytgif-progress-bar');
      const text = document.querySelector('.ytgif-progress-percentage');
      return {
        barStyleWidth: bar ? bar.style.width : null,
        progressText: text ? text.textContent : null,
        barOffsetWidth: bar ? bar.offsetWidth : null,
        wrapperWidth: document.querySelector('.ytgif-progress-bar-wrapper')?.offsetWidth
      };
    });
    
    console.log('\nFinal DOM state:', finalState);
  });
});