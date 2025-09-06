const { test, expect, chromium } = require('@playwright/test');
const path = require('path');

test.describe('Debug Progress Bar Issue', () => {
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

  test('Check actual CSS values at different progress points', async () => {
    await page.goto('https://www.youtube.com/watch?v=jNQXAC9IVRw');
    await page.waitForSelector('.html5-video-player', { timeout: 10000 });
    await page.waitForSelector('.ytgif-button', { timeout: 10000 });
    
    await page.click('.ytgif-button');
    await page.waitForSelector('.ytgif-timeline-overlay', { timeout: 5000 });
    
    await page.click('.ytgif-timeline-create');
    await page.waitForSelector('.ytgif-progress-bar', { timeout: 5000 });
    
    const capturedStates = [];
    const checkpoints = [30, 50, 70, 90];
    let capturedCheckpoints = new Set();
    
    // Monitor for specific progress values
    for (let i = 0; i < 100; i++) {
      const state = await page.evaluate(() => {
        const bar = document.querySelector('.ytgif-progress-bar');
        const wrapper = document.querySelector('.ytgif-progress-bar-wrapper');
        const percentElement = document.querySelector('.ytgif-progress-percentage');
        
        if (!bar || !wrapper || !percentElement) return null;
        
        const percentText = percentElement.textContent;
        const percentValue = parseInt(percentText);
        
        // Get all CSS properties that might affect width
        const barStyles = window.getComputedStyle(bar);
        const wrapperStyles = window.getComputedStyle(wrapper);
        
        return {
          percentValue,
          percentText,
          bar: {
            inlineStyle: bar.style.width,
            offsetWidth: bar.offsetWidth,
            clientWidth: bar.clientWidth,
            scrollWidth: bar.scrollWidth,
            computedWidth: barStyles.width,
            computedMaxWidth: barStyles.maxWidth,
            computedMinWidth: barStyles.minWidth,
            computedPosition: barStyles.position,
            computedDisplay: barStyles.display,
            computedBoxSizing: barStyles.boxSizing,
            computedTransform: barStyles.transform,
            computedTransition: barStyles.transition,
            getAttribute: bar.getAttribute('style')
          },
          wrapper: {
            offsetWidth: wrapper.offsetWidth,
            clientWidth: wrapper.clientWidth,
            scrollWidth: wrapper.scrollWidth,
            computedWidth: wrapperStyles.width,
            computedMaxWidth: wrapperStyles.maxWidth,
            computedPosition: wrapperStyles.position,
            computedDisplay: wrapperStyles.display,
            computedBoxSizing: wrapperStyles.boxSizing
          },
          actualFillPercentage: ((bar.offsetWidth / wrapper.offsetWidth) * 100).toFixed(1)
        };
      });
      
      if (state) {
        // Capture specific checkpoints
        for (const checkpoint of checkpoints) {
          if (state.percentValue >= checkpoint && !capturedCheckpoints.has(checkpoint)) {
            capturedCheckpoints.add(checkpoint);
            capturedStates.push({checkpoint, ...state});
            
            console.log(`\n=== CHECKPOINT ${checkpoint}% (actual: ${state.percentValue}%) ===`);
            console.log(`Progress bar fills: ${state.actualFillPercentage}% of wrapper`);
            console.log(`Inline style width: ${state.bar.inlineStyle}`);
            console.log(`Bar offset width: ${state.bar.offsetWidth}px`);
            console.log(`Wrapper offset width: ${state.wrapper.offsetWidth}px`);
            console.log(`Style attribute: ${state.bar.getAttribute}`);
            
            // Check if there's a mismatch
            const expectedFill = state.percentValue;
            const actualFill = parseFloat(state.actualFillPercentage);
            const mismatch = Math.abs(expectedFill - actualFill);
            
            if (mismatch > 5) {
              console.log(`⚠️ MISMATCH: Expected ${expectedFill}% but got ${actualFill}%`);
              console.log(`Bar computed width: ${state.bar.computedWidth}`);
              console.log(`Bar max-width: ${state.bar.computedMaxWidth}`);
              console.log(`Bar transform: ${state.bar.computedTransform}`);
              console.log(`Bar transition: ${state.bar.computedTransition}`);
            }
          }
        }
        
        // Stop if we've captured all checkpoints or reached 100%
        if (capturedCheckpoints.size === checkpoints.length || state.percentValue >= 95) {
          break;
        }
      }
      
      await page.waitForTimeout(200);
    }
    
    // Final analysis
    console.log('\n=== FINAL ANALYSIS ===');
    if (capturedStates.length > 0) {
      const lastState = capturedStates[capturedStates.length - 1];
      console.log(`Last captured progress: ${lastState.percentValue}%`);
      console.log(`Last bar fill: ${lastState.actualFillPercentage}%`);
      
      // Check if the issue is consistent
      let allMismatched = true;
      for (const state of capturedStates) {
        const expectedFill = state.percentValue;
        const actualFill = parseFloat(state.actualFillPercentage);
        const mismatch = Math.abs(expectedFill - actualFill);
        
        if (mismatch < 5) {
          allMismatched = false;
          console.log(`✓ At ${state.percentValue}%: Bar correctly fills ${actualFill}%`);
        } else {
          console.log(`✗ At ${state.percentValue}%: Bar only fills ${actualFill}% (${mismatch.toFixed(1)}% off)`);
        }
      }
      
      if (allMismatched) {
        console.log('\n⚠️ CONSISTENT ISSUE: Progress bar is approximately HALF the expected width at all checkpoints');
        
        // Check if it's exactly half
        const ratios = capturedStates.map(s => 
          parseFloat(s.actualFillPercentage) / s.percentValue
        );
        const avgRatio = ratios.reduce((a, b) => a + b, 0) / ratios.length;
        console.log(`Average fill ratio: ${avgRatio.toFixed(2)} (should be 1.0)`);
        
        if (Math.abs(avgRatio - 0.5) < 0.1) {
          console.log('🔍 The bar is filling at approximately HALF the expected rate!');
        }
      }
    }
  });
});