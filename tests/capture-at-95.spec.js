const { test, expect, chromium } = require('@playwright/test');
const path = require('path');

test.describe('Capture at 95%', () => {
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

  test('Capture state at 95%', async () => {
    await page.goto('https://www.youtube.com/watch?v=jNQXAC9IVRw');
    await page.waitForSelector('.html5-video-player', { timeout: 10000 });
    await page.waitForSelector('.ytgif-button', { timeout: 10000 });
    
    await page.click('.ytgif-button');
    await page.waitForSelector('.ytgif-timeline-overlay', { timeout: 5000 });
    
    await page.click('.ytgif-timeline-create');
    await page.waitForSelector('.ytgif-progress-bar', { timeout: 5000 });
    
    // Wait for 95%
    for (let i = 0; i < 100; i++) {
      const progressText = await page.textContent('.ytgif-progress-percentage').catch(() => null);
      
      if (progressText) {
        const progressValue = parseInt(progressText);
        
        if (progressValue === 95) {
          // Capture everything at 95%
          const state = await page.evaluate(() => {
            const bar = document.querySelector('.ytgif-progress-bar');
            const wrapper = document.querySelector('.ytgif-progress-bar-wrapper');
            const container = document.querySelector('.ytgif-progress-container');
            
            const barComputed = window.getComputedStyle(bar);
            const wrapperComputed = window.getComputedStyle(wrapper);
            
            return {
              progress: document.querySelector('.ytgif-progress-percentage')?.textContent,
              message: document.querySelector('.ytgif-progress-message')?.textContent,
              bar: {
                styleWidth: bar.style.width,
                offsetWidth: bar.offsetWidth,
                clientWidth: bar.clientWidth,
                computedWidth: barComputed.width,
                computedMaxWidth: barComputed.maxWidth,
                computedPosition: barComputed.position,
                computedDisplay: barComputed.display
              },
              wrapper: {
                offsetWidth: wrapper.offsetWidth,
                clientWidth: wrapper.clientWidth,
                computedWidth: wrapperComputed.width,
                computedPosition: wrapperComputed.position,
                computedDisplay: wrapperComputed.display
              },
              actualRatio: (bar.offsetWidth / wrapper.offsetWidth * 100).toFixed(1)
            };
          });
          
          console.log('=== STATE AT 95% ===');
          console.log('Progress Text:', state.progress);
          console.log('Message:', state.message);
          console.log('\nBar:');
          console.log('  Style width:', state.bar.styleWidth);
          console.log('  Offset width:', state.bar.offsetWidth);
          console.log('  Computed width:', state.bar.computedWidth);
          console.log('  Computed max-width:', state.bar.computedMaxWidth);
          console.log('\nWrapper:');
          console.log('  Offset width:', state.wrapper.offsetWidth);
          console.log('  Computed width:', state.wrapper.computedWidth);
          console.log('\nActual fill ratio:', state.actualRatio + '%');
          
          // Check if the widths match
          const expectedWidth = state.wrapper.offsetWidth * 0.95;
          const actualWidth = state.bar.offsetWidth;
          const difference = Math.abs(expectedWidth - actualWidth);
          
          console.log('\nExpected bar width (95% of wrapper):', expectedWidth.toFixed(1) + 'px');
          console.log('Actual bar width:', actualWidth + 'px');
          console.log('Difference:', difference.toFixed(1) + 'px');
          
          break;
        }
      }
      
      await page.waitForTimeout(100);
    }
  });
});