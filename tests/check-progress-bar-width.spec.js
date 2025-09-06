const { test, expect, chromium } = require('@playwright/test');
const path = require('path');

test.describe('Progress Bar Width Check', () => {
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
    
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('progress') || text.includes('Progress')) {
        console.log('PROGRESS LOG:', text);
      }
    });
  });

  test.afterAll(async () => {
    await browser.close();
  });

  test('Progress bar should fill to 100% width', async () => {
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
    
    // Monitor progress bar width
    let maxWidth = 0;
    let wrapperWidth = 0;
    let maxProgressValue = 0;
    
    for (let i = 0; i < 60; i++) {
      const progressBar = await page.$('.ytgif-progress-bar');
      const wrapper = await page.$('.ytgif-progress-bar-wrapper');
      
      if (progressBar && wrapper) {
        // Get progress text first
        const progressText = await page.textContent('.ytgif-progress-percentage').catch(() => '0%');
        
        // Get computed styles
        const barWidth = await progressBar.evaluate(el => {
          const style = window.getComputedStyle(el);
          return {
            width: style.width,
            percentWidth: el.style.width,
            offsetWidth: el.offsetWidth
          };
        });
        
        const wrapperInfo = await wrapper.evaluate(el => {
          return {
            width: window.getComputedStyle(el).width,
            offsetWidth: el.offsetWidth
          };
        });
        
        console.log(`Progress check ${i}:`, {
          bar: barWidth,
          wrapper: wrapperInfo,
          progress: progressText
        });
        
        // Track max width percentage
        if (barWidth.percentWidth) {
          const percent = parseFloat(barWidth.percentWidth);
          if (percent > maxWidth) {
            maxWidth = percent;
          }
        }
        
        wrapperWidth = wrapperInfo.offsetWidth;
        
        // Check if progress completed or about to complete
        const progressValue = parseInt(progressText);
        if (progressValue > maxProgressValue) {
          maxProgressValue = progressValue;
        }
        
        if (progressValue >= 90 && progressValue < 100) {
          console.log(`Progress reached ${progressValue}%`);
          
          // Get final width check before it disappears
          const finalBarWidth = await progressBar.evaluate(el => el.offsetWidth);
          const ratio = finalBarWidth / wrapperWidth;
          
          console.log(`Width ratio at ${progressValue}%: ${ratio.toFixed(2)} (${finalBarWidth}px / ${wrapperWidth}px)`);
          
          // The bar should be close to the progress value
          const expectedRatio = progressValue / 100;
          const tolerance = 0.05; // 5% tolerance
          expect(Math.abs(ratio - expectedRatio)).toBeLessThan(tolerance);
          
          // If we're at 95%, the bar should be at least 90% width
          if (progressValue >= 95) {
            expect(ratio).toBeGreaterThan(0.9);
            break;
          }
        }
      }
      
      await page.waitForTimeout(200);
    }
    
    console.log(`Maximum width percentage seen: ${maxWidth}%`);
    console.log(`Maximum progress value seen: ${maxProgressValue}%`);
    console.log(`Wrapper width: ${wrapperWidth}px`);
  });
});