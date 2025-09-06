const { test, expect, chromium } = require('@playwright/test');
const path = require('path');

test.describe('Test Direct Style', () => {
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

  test('Directly manipulate progress bar style', async () => {
    await page.goto('https://www.youtube.com/watch?v=jNQXAC9IVRw');
    await page.waitForSelector('.html5-video-player', { timeout: 10000 });
    await page.waitForSelector('.ytgif-button', { timeout: 10000 });
    
    await page.click('.ytgif-button');
    await page.waitForSelector('.ytgif-timeline-overlay', { timeout: 5000 });
    
    await page.click('.ytgif-timeline-create');
    await page.waitForSelector('.ytgif-progress-bar', { timeout: 5000 });
    
    // Wait a moment 
    await page.waitForTimeout(1000);
    
    console.log('=== BEFORE MANIPULATION ===');
    let state = await page.evaluate(() => {
      const bar = document.querySelector('.ytgif-progress-bar');
      const wrapper = document.querySelector('.ytgif-progress-bar-wrapper');
      return {
        barWidth: bar?.offsetWidth,
        wrapperWidth: wrapper?.offsetWidth,
        barStyle: bar?.style.width,
        ratio: bar && wrapper ? (bar.offsetWidth / wrapper.offsetWidth * 100).toFixed(1) : null
      };
    });
    console.log(state);
    
    // Now directly set the bar width to 100%
    await page.evaluate(() => {
      const bar = document.querySelector('.ytgif-progress-bar');
      if (bar) {
        bar.style.width = '100%';
        console.log('Set bar width to 100%');
      }
    });
    
    await page.waitForTimeout(500); // Wait for transition
    
    console.log('\n=== AFTER SETTING TO 100% ===');
    state = await page.evaluate(() => {
      const bar = document.querySelector('.ytgif-progress-bar');
      const wrapper = document.querySelector('.ytgif-progress-bar-wrapper');
      return {
        barWidth: bar?.offsetWidth,
        wrapperWidth: wrapper?.offsetWidth,
        barStyle: bar?.style.width,
        ratio: bar && wrapper ? (bar.offsetWidth / wrapper.offsetWidth * 100).toFixed(1) : null
      };
    });
    console.log(state);
    
    // Try setting an absolute width
    await page.evaluate(() => {
      const bar = document.querySelector('.ytgif-progress-bar');
      const wrapper = document.querySelector('.ytgif-progress-bar-wrapper');
      if (bar && wrapper) {
        const wrapperWidth = wrapper.offsetWidth;
        bar.style.width = `${wrapperWidth}px`;
        console.log(`Set bar width to ${wrapperWidth}px (wrapper width)`);
      }
    });
    
    await page.waitForTimeout(500); // Wait for transition
    
    console.log('\n=== AFTER SETTING TO WRAPPER WIDTH ===');
    state = await page.evaluate(() => {
      const bar = document.querySelector('.ytgif-progress-bar');
      const wrapper = document.querySelector('.ytgif-progress-bar-wrapper');
      return {
        barWidth: bar?.offsetWidth,
        wrapperWidth: wrapper?.offsetWidth,
        barStyle: bar?.style.width,
        ratio: bar && wrapper ? (bar.offsetWidth / wrapper.offsetWidth * 100).toFixed(1) : null
      };
    });
    console.log(state);
    
    // Check if there's a max-width being applied from somewhere
    const computedStyles = await page.evaluate(() => {
      const bar = document.querySelector('.ytgif-progress-bar');
      if (!bar) return null;
      
      const styles = window.getComputedStyle(bar);
      return {
        width: styles.width,
        maxWidth: styles.maxWidth,
        minWidth: styles.minWidth,
        padding: styles.padding,
        boxSizing: styles.boxSizing,
        position: styles.position,
        left: styles.left,
        right: styles.right
      };
    });
    
    console.log('\n=== COMPUTED STYLES ===');
    console.log(computedStyles);
    
    // Check if parent has any transforms or scales
    const parentStyles = await page.evaluate(() => {
      const wrapper = document.querySelector('.ytgif-progress-bar-wrapper');
      if (!wrapper) return null;
      
      const styles = window.getComputedStyle(wrapper);
      return {
        transform: styles.transform,
        scale: styles.scale,
        width: styles.width,
        overflow: styles.overflow
      };
    });
    
    console.log('\n=== WRAPPER STYLES ===');
    console.log(parentStyles);
  });
});