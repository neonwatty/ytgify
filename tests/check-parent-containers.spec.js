const { test, expect, chromium } = require('@playwright/test');
const path = require('path');

test.describe('Check Parent Containers', () => {
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

  test('Inspect parent container hierarchy', async () => {
    await page.goto('https://www.youtube.com/watch?v=jNQXAC9IVRw');
    await page.waitForSelector('.html5-video-player', { timeout: 10000 });
    await page.waitForSelector('.ytgif-button', { timeout: 10000 });
    
    await page.click('.ytgif-button');
    await page.waitForSelector('.ytgif-timeline-overlay', { timeout: 5000 });
    
    await page.click('.ytgif-timeline-create');
    await page.waitForSelector('.ytgif-progress-bar', { timeout: 5000 });
    
    // Wait a moment for progress to start
    await page.waitForTimeout(2000);
    
    // Inspect the entire hierarchy
    const hierarchy = await page.evaluate(() => {
      const bar = document.querySelector('.ytgif-progress-bar');
      if (!bar) return null;
      
      const elements = [];
      let current = bar;
      
      // Walk up the DOM tree
      while (current) {
        const styles = window.getComputedStyle(current);
        const rect = current.getBoundingClientRect();
        
        elements.push({
          tagName: current.tagName,
          className: current.className,
          id: current.id || '(no id)',
          offsetWidth: current.offsetWidth,
          clientWidth: current.clientWidth,
          scrollWidth: current.scrollWidth,
          boundingWidth: rect.width,
          style: {
            width: styles.width,
            maxWidth: styles.maxWidth,
            minWidth: styles.minWidth,
            display: styles.display,
            position: styles.position,
            boxSizing: styles.boxSizing,
            padding: styles.padding,
            margin: styles.margin,
            transform: styles.transform,
            overflow: styles.overflow
          },
          inlineStyle: current.style.cssText
        });
        
        // Stop at the overlay container
        if (current.classList.contains('ytgif-timeline-overlay')) {
          break;
        }
        
        current = current.parentElement;
      }
      
      return elements;
    });
    
    if (hierarchy) {
      console.log('=== DOM HIERARCHY FROM PROGRESS BAR TO OVERLAY ===\n');
      
      hierarchy.forEach((elem, index) => {
        const indent = '  '.repeat(index);
        console.log(`${indent}[${index}] ${elem.tagName}.${elem.className || '(no class)'}`);
        console.log(`${indent}    Offset Width: ${elem.offsetWidth}px`);
        console.log(`${indent}    Computed Width: ${elem.style.width}`);
        console.log(`${indent}    Max Width: ${elem.style.maxWidth}`);
        
        if (elem.inlineStyle) {
          console.log(`${indent}    Inline Style: ${elem.inlineStyle}`);
        }
        
        // Check for width constraints
        if (elem.style.maxWidth !== 'none' || 
            elem.style.width.includes('%') && index > 0 ||
            elem.offsetWidth < hierarchy[Math.max(0, index - 1)]?.offsetWidth) {
          console.log(`${indent}    ⚠️ POTENTIAL CONSTRAINT DETECTED`);
        }
        
        console.log('');
      });
      
      // Check if there's a specific issue
      const bar = hierarchy[0];
      const wrapper = hierarchy[1];
      
      if (bar && wrapper) {
        const barWidthPx = bar.offsetWidth;
        const wrapperWidthPx = wrapper.offsetWidth;
        const actualPercentage = (barWidthPx / wrapperWidthPx * 100).toFixed(1);
        
        console.log('=== WIDTH ANALYSIS ===');
        console.log(`Progress Bar: ${barWidthPx}px`);
        console.log(`Wrapper: ${wrapperWidthPx}px`);
        console.log(`Actual Fill: ${actualPercentage}%`);
        
        // Check if bar inline style is being applied correctly
        if (bar.inlineStyle.includes('width')) {
          const match = bar.inlineStyle.match(/width:\s*([^;]+)/);
          if (match) {
            console.log(`Inline style width: ${match[1]}`);
            
            // If inline style is percentage, calculate what it should be
            if (match[1].includes('%')) {
              const expectedPercentage = parseFloat(match[1]);
              const expectedPx = wrapperWidthPx * (expectedPercentage / 100);
              console.log(`Expected width: ${expectedPx.toFixed(1)}px (${expectedPercentage}% of ${wrapperWidthPx}px)`);
              console.log(`Actual width: ${barWidthPx}px`);
              console.log(`Difference: ${(expectedPx - barWidthPx).toFixed(1)}px`);
              
              if (Math.abs(expectedPx - barWidthPx) > 10) {
                console.log('\n🔴 ISSUE CONFIRMED: Inline percentage style is not being applied correctly!');
                console.log('The bar should be ' + expectedPx.toFixed(0) + 'px but is only ' + barWidthPx + 'px');
              }
            }
          }
        }
      }
    }
  });
});