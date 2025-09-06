const { test, expect, chromium } = require('@playwright/test');
const path = require('path');

test('Debug timeline overlay visibility', async () => {
  const extensionPath = path.join(__dirname, '..', 'dist');
  
  const browser = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--no-sandbox',
      '--disable-dev-shm-usage',
    ],
    viewport: { width: 1280, height: 720 }
  });

  const page = await browser.newPage();
  
  // Navigate to YouTube
  await page.goto('https://www.youtube.com/watch?v=dQw4w9WgXcQ', { 
    waitUntil: 'networkidle' 
  });

  await page.waitForSelector('#movie_player', { timeout: 15000 });
  await page.waitForTimeout(3000);

  // Find and click button
  const gifButton = await page.waitForSelector('.ytgif-button', { timeout: 10000 });
  await gifButton.click();
  
  // Wait for overlay to be created (not necessarily visible)
  await page.waitForSelector('#ytgif-timeline-overlay', { 
    state: 'attached', 
    timeout: 10000 
  });
  
  // Detailed analysis of overlay visibility
  const overlayAnalysis = await page.evaluate(() => {
    const overlay = document.querySelector('#ytgif-timeline-overlay');
    if (!overlay) return { error: 'No overlay found' };
    
    const computedStyle = window.getComputedStyle(overlay);
    const rect = overlay.getBoundingClientRect();
    
    // Check all possible reasons for invisibility
    return {
      exists: !!overlay,
      innerHTML: overlay.innerHTML.substring(0, 200) + '...',
      style: {
        display: computedStyle.display,
        visibility: computedStyle.visibility,
        opacity: computedStyle.opacity,
        width: computedStyle.width,
        height: computedStyle.height,
        position: computedStyle.position,
        top: computedStyle.top,
        left: computedStyle.left,
        zIndex: computedStyle.zIndex,
        transform: computedStyle.transform
      },
      rect: {
        width: rect.width,
        height: rect.height,
        top: rect.top,
        left: rect.left,
        bottom: rect.bottom,
        right: rect.right
      },
      offsetParent: overlay.offsetParent ? {
        tagName: overlay.offsetParent.tagName,
        id: overlay.offsetParent.id,
        className: overlay.offsetParent.className
      } : null,
      parentElement: overlay.parentElement ? {
        tagName: overlay.parentElement.tagName,
        id: overlay.parentElement.id,
        className: overlay.parentElement.className
      } : null,
      classList: Array.from(overlay.classList),
      attributes: Array.from(overlay.attributes).map(attr => ({ 
        name: attr.name, 
        value: attr.value 
      }))
    };
  });
  
  console.log('🔍 Overlay Analysis:');
  console.log(JSON.stringify(overlayAnalysis, null, 2));
  
  // Check if there are multiple overlays
  const allOverlays = await page.$$eval('#ytgif-timeline-overlay, [class*="ytgif-timeline-overlay"]', elements =>
    elements.map(el => ({
      tagName: el.tagName,
      id: el.id,
      className: el.className,
      visible: el.offsetParent !== null,
      display: window.getComputedStyle(el).display,
      visibility: window.getComputedStyle(el).visibility,
      opacity: window.getComputedStyle(el).opacity
    }))
  );
  
  console.log('📋 All timeline overlay elements:');
  console.table(allOverlays);
  
  // Check if CSS classes are properly applied
  const cssCheck = await page.evaluate(() => {
    const styles = [];
    const sheets = Array.from(document.styleSheets);
    
    for (const sheet of sheets) {
      try {
        const rules = Array.from(sheet.cssRules || sheet.rules || []);
        for (const rule of rules) {
          if (rule.selectorText && rule.selectorText.includes('ytgif-timeline-overlay')) {
            styles.push({
              selector: rule.selectorText,
              cssText: rule.style.cssText || rule.cssText
            });
          }
        }
      } catch (e) {
        // Skip stylesheets we can't access
      }
    }
    return styles;
  });
  
  console.log('🎨 Relevant CSS rules:');
  cssCheck.forEach(rule => {
    console.log(`${rule.selector}: ${rule.cssText}`);
  });
  
  // Check if overlay visibility changes over time
  console.log('⏱️  Checking visibility changes over time...');
  for (let i = 0; i < 5; i++) {
    await page.waitForTimeout(1000);
    const visibility = await page.evaluate(() => {
      const overlay = document.querySelector('#ytgif-timeline-overlay');
      return overlay ? {
        visible: overlay.offsetParent !== null,
        display: window.getComputedStyle(overlay).display,
        opacity: window.getComputedStyle(overlay).opacity
      } : null;
    });
    console.log(`Time ${i + 1}s: ${JSON.stringify(visibility)}`);
  }
  
  await browser.close();
});