const { test, expect, chromium } = require('@playwright/test');
const path = require('path');

test('Debug: Test GIF creation with all routes', async () => {
  const extensionPath = path.join(__dirname, '..', 'dist');
  console.log('Loading extension from:', extensionPath);
  
  const browser = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--no-sandbox'
    ]
  });
  
  const page = await browser.newPage();
  
  // Capture detailed logs
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('Processing') || text.includes('Encoding') || 
        text.includes('Frame') || text.includes('GIF') || 
        text.includes('error') || text.includes('Error')) {
      console.log(`[${msg.type()}]`, text);
    }
  });
  
  page.on('pageerror', error => {
    console.error('[PAGE ERROR]', error.message);
  });
  
  console.log('\n=== Loading YouTube ===');
  await page.goto('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  await page.waitForSelector('.html5-video-player', { timeout: 10000 });
  
  // Wait for extension initialization
  await page.waitForTimeout(3000);
  
  // Click GIF button
  const button = await page.waitForSelector('.ytgif-button', { timeout: 10000 });
  console.log('\n=== Clicking GIF Button ===');
  await button.click();
  await page.waitForTimeout(2000);
  
  // Check what screen we're on
  const screenInfo = await page.evaluate(() => {
    const overlay = document.querySelector('#ytgif-wizard-overlay');
    if (!overlay) return { hasOverlay: false };
    
    const screens = {
      welcome: document.querySelector('.ytgif-welcome-screen'),
      action: document.querySelector('.ytgif-action-screen'),
      quickCapture: document.querySelector('.ytgif-quick-capture-screen'),
      customRange: document.querySelector('.ytgif-custom-range-screen'),
      processing: document.querySelector('.ytgif-processing-screen'),
      success: document.querySelector('.ytgif-success-screen')
    };
    
    const activeScreen = Object.entries(screens).find(([name, el]) => 
      el && window.getComputedStyle(el).display !== 'none'
    );
    
    return {
      hasOverlay: true,
      activeScreen: activeScreen ? activeScreen[0] : 'none',
      allScreens: Object.entries(screens).map(([name, el]) => ({
        name,
        exists: !!el,
        visible: el ? window.getComputedStyle(el).display !== 'none' : false
      }))
    };
  });
  
  console.log('\n=== Screen Info ===');
  console.log('Active screen:', screenInfo.activeScreen);
  console.log('All screens:', screenInfo.allScreens);
  
  // Test Route 1: Quick Capture
  console.log('\n=== Testing Quick Capture Route ===');
  
  if (screenInfo.activeScreen === 'action') {
    const quickCaptureBtn = await page.$('button:has-text("Quick Capture")');
    if (quickCaptureBtn) {
      console.log('Clicking Quick Capture...');
      await quickCaptureBtn.click();
      await page.waitForTimeout(1500);
      
      // Verify we're on quick capture screen
      const onQuickCapture = await page.evaluate(() => {
        const screen = document.querySelector('.ytgif-quick-capture-screen');
        return screen && window.getComputedStyle(screen).display !== 'none';
      });
      
      console.log('On Quick Capture screen:', onQuickCapture);
      
      if (onQuickCapture) {
        // Click Create GIF
        const captureBtn = await page.$('button:has-text("Create GIF")');
        if (captureBtn) {
          console.log('Clicking Create GIF...');
          await captureBtn.click();
          
          // Wait and check for processing
          await page.waitForTimeout(3000);
          
          const processingInfo = await page.evaluate(() => {
            const processingScreen = document.querySelector('.ytgif-processing-screen');
            const progressBar = document.querySelector('.ytgif-progress-fill');
            const statusText = document.querySelector('.ytgif-status-text');
            
            return {
              hasProcessingScreen: !!processingScreen,
              isVisible: processingScreen ? window.getComputedStyle(processingScreen).display !== 'none' : false,
              progressWidth: progressBar ? progressBar.style.width : null,
              statusText: statusText ? statusText.textContent : null
            };
          });
          
          console.log('\n=== Processing Info ===');
          console.log(processingInfo);
          
          // Wait for processing to complete or error
          let attempts = 0;
          while (attempts < 20) {
            await page.waitForTimeout(1000);
            
            const currentStatus = await page.evaluate(() => {
              const statusText = document.querySelector('.ytgif-status-text');
              const progressBar = document.querySelector('.ytgif-progress-fill');
              const successScreen = document.querySelector('.ytgif-success-screen');
              const errorMsg = document.querySelector('.ytgif-error-message');
              
              return {
                status: statusText ? statusText.textContent : null,
                progress: progressBar ? progressBar.style.width : null,
                hasSuccess: !!successScreen && window.getComputedStyle(successScreen).display !== 'none',
                hasError: !!errorMsg,
                errorText: errorMsg ? errorMsg.textContent : null
              };
            });
            
            console.log(`Attempt ${attempts + 1}:`, currentStatus);
            
            if (currentStatus.hasSuccess) {
              console.log('\n=== SUCCESS! GIF Created ===');
              break;
            }
            
            if (currentStatus.hasError) {
              console.error('\n=== ERROR! ===');
              console.error(currentStatus.errorText);
              break;
            }
            
            attempts++;
          }
        }
      }
    }
  }
  
  // Take final screenshot
  await page.screenshot({ path: 'tests/screenshots/gif-creation-debug.png' });
  
  // Check localStorage for any saved data
  const storageData = await page.evaluate(() => {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.includes('ytgif')) {
        data[key] = localStorage.getItem(key);
      }
    }
    return data;
  });
  
  console.log('\n=== Storage Data ===');
  console.log(storageData);
  
  await page.waitForTimeout(2000);
  await browser.close();
});