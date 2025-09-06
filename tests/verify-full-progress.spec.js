const { test, expect, chromium } = require('@playwright/test');
const path = require('path');

test.describe('Verify Full Progress', () => {
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
      if (text.includes('progress')) {
        console.log('PAGE:', text);
      }
    });
  });

  test.afterAll(async () => {
    await browser.close();
  });

  test('Progress should reach 95%+', async () => {
    // Navigate to YouTube
    await page.goto('https://www.youtube.com/watch?v=jNQXAC9IVRw');
    
    // Wait for video player and button
    await page.waitForSelector('.html5-video-player', { timeout: 10000 });
    await page.waitForSelector('.ytgif-button', { timeout: 10000 });
    
    // Click GIF button
    await page.click('.ytgif-button');
    await page.waitForSelector('.ytgif-timeline-overlay', { timeout: 5000 });
    
    // Click Create GIF
    await page.click('.ytgif-timeline-create');
    await page.waitForSelector('.ytgif-progress-bar', { timeout: 5000 });
    
    // Monitor progress
    let maxProgress = 0;
    let maxBarWidth = 0;
    let samples = [];
    
    for (let i = 0; i < 60; i++) {
      const progressText = await page.textContent('.ytgif-progress-percentage').catch(() => null);
      
      if (progressText) {
        const progressValue = parseInt(progressText);
        
        // Get bar width
        const barData = await page.evaluate(() => {
          const bar = document.querySelector('.ytgif-progress-bar');
          const wrapper = document.querySelector('.ytgif-progress-bar-wrapper');
          if (!bar || !wrapper) return null;
          
          return {
            barWidth: bar.offsetWidth,
            wrapperWidth: wrapper.offsetWidth,
            styleWidth: bar.style.width,
            progress: parseInt(document.querySelector('.ytgif-progress-percentage')?.textContent || '0')
          };
        });
        
        if (barData) {
          const widthRatio = (barData.barWidth / barData.wrapperWidth) * 100;
          
          samples.push({
            progress: barData.progress,
            widthRatio: widthRatio.toFixed(1),
            styleWidth: barData.styleWidth
          });
          
          if (barData.progress > maxProgress) {
            maxProgress = barData.progress;
            maxBarWidth = widthRatio;
          }
          
          // Log significant milestones
          if (barData.progress === 50 || barData.progress === 75 || barData.progress === 90 || barData.progress >= 95) {
            console.log(`At ${barData.progress}%: Bar fills ${widthRatio.toFixed(1)}% of wrapper (style: ${barData.styleWidth})`);
          }
        }
        
        // Stop if we hit 100% or completion
        if (progressValue >= 100 || progressText === '100%') {
          console.log('Progress completed at 100%');
          break;
        }
      }
      
      await page.waitForTimeout(200);
    }
    
    // Show summary
    console.log('\n=== SUMMARY ===');
    console.log(`Maximum progress reached: ${maxProgress}%`);
    console.log(`Maximum bar width: ${maxBarWidth.toFixed(1)}% of wrapper`);
    
    // Show a few sample points
    console.log('\nSample progress points:');
    const milestones = [25, 50, 75, 90, 95];
    milestones.forEach(target => {
      const sample = samples.find(s => s.progress >= target);
      if (sample) {
        console.log(`  ${sample.progress}%: bar width = ${sample.widthRatio}% (matches: ${Math.abs(sample.progress - parseFloat(sample.widthRatio)) < 5 ? 'YES' : 'NO'})`);
      }
    });
    
    // Verify progress reached at least 95%
    expect(maxProgress).toBeGreaterThanOrEqual(95);
    
    // Verify bar width matches progress (within tolerance)
    const tolerance = 5; // 5% tolerance
    const difference = Math.abs(maxProgress - maxBarWidth);
    console.log(`\nWidth accuracy: ${difference.toFixed(1)}% difference (tolerance: ${tolerance}%)`);
    expect(difference).toBeLessThan(tolerance);
  });
});