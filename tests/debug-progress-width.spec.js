const { test, expect, chromium } = require('@playwright/test');
const path = require('path');

test.describe('Debug Progress Width', () => {
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

  test('Debug progress bar container widths', async () => {
    // Navigate to YouTube
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
    
    // Wait a moment for progress to start
    await page.waitForTimeout(2000);
    
    // Get all container widths
    const dimensions = await page.evaluate(() => {
      const overlay = document.querySelector('.ytgif-timeline-overlay');
      const container = document.querySelector('.ytgif-progress-container');
      const wrapper = document.querySelector('.ytgif-progress-bar-wrapper');
      const bar = document.querySelector('.ytgif-progress-bar');
      
      return {
        overlay: overlay ? {
          offsetWidth: overlay.offsetWidth,
          clientWidth: overlay.clientWidth,
          computedWidth: window.getComputedStyle(overlay).width,
          computedMaxWidth: window.getComputedStyle(overlay).maxWidth
        } : null,
        container: container ? {
          offsetWidth: container.offsetWidth,
          clientWidth: container.clientWidth,
          computedWidth: window.getComputedStyle(container).width,
          computedPadding: window.getComputedStyle(container).padding
        } : null,
        wrapper: wrapper ? {
          offsetWidth: wrapper.offsetWidth,
          clientWidth: wrapper.clientWidth,
          computedWidth: window.getComputedStyle(wrapper).width
        } : null,
        bar: bar ? {
          offsetWidth: bar.offsetWidth,
          clientWidth: bar.clientWidth,
          computedWidth: window.getComputedStyle(bar).width,
          styleWidth: bar.style.width
        } : null,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        }
      };
    });
    
    console.log('Container Dimensions:');
    console.log('===================');
    console.log('Viewport:', dimensions.viewport);
    console.log('Overlay:', dimensions.overlay);
    console.log('Progress Container:', dimensions.container);
    console.log('Progress Wrapper:', dimensions.wrapper);
    console.log('Progress Bar:', dimensions.bar);
    
    // Check if wrapper is full width of container
    if (dimensions.wrapper && dimensions.container) {
      const containerContentWidth = dimensions.container.clientWidth;
      const wrapperWidth = dimensions.wrapper.offsetWidth;
      const ratio = wrapperWidth / containerContentWidth;
      console.log(`\nWrapper to container ratio: ${ratio.toFixed(2)}`);
      
      // Wrapper should be nearly 100% of container content width
      expect(ratio).toBeGreaterThan(0.95);
    }
  });
});