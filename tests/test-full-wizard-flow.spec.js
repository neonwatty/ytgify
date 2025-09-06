const { test, expect, chromium } = require('@playwright/test');
const path = require('path');

test('Test: Complete wizard flow to GIF creation', async () => {
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
  
  // Capture all logs
  const logs = [];
  page.on('console', msg => {
    const text = msg.text();
    logs.push({ type: msg.type(), text });
    if (text.includes('GIF') || text.includes('Wizard') || text.includes('Processing') || text.includes('error')) {
      console.log(`[${msg.type()}]`, text);
    }
  });
  
  console.log('Navigating to YouTube...');
  await page.goto('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  
  // Wait for video player
  await page.waitForSelector('.html5-video-player', { timeout: 10000 });
  console.log('Video player loaded');
  
  // Wait for button
  await page.waitForTimeout(3000);
  const button = await page.$('.ytgif-button');
  expect(button).toBeTruthy();
  
  console.log('Clicking GIF button...');
  await button.click();
  
  // Wait for overlay
  await page.waitForTimeout(2000);
  
  // Check current screen
  const currentScreen = await page.evaluate(() => {
    const screens = [
      { name: 'welcome', selector: '.ytgif-welcome-screen' },
      { name: 'action', selector: '.ytgif-action-screen' },
      { name: 'quick-capture', selector: '.ytgif-quick-capture-screen' },
      { name: 'custom-range', selector: '.ytgif-custom-range-screen' },
      { name: 'processing', selector: '.ytgif-processing-screen' }
    ];
    
    for (const screen of screens) {
      const element = document.querySelector(screen.selector);
      if (element && element.style.display !== 'none') {
        return screen.name;
      }
    }
    return 'none';
  });
  
  console.log('Current screen:', currentScreen);
  
  // Navigate based on current screen
  if (currentScreen === 'welcome') {
    const getStarted = await page.$('button:has-text("Get Started")');
    if (getStarted) {
      await getStarted.click();
      await page.waitForTimeout(1000);
    }
  }
  
  // Should be on action screen now
  const quickCaptureBtn = await page.$('button:has-text("Quick Capture")');
  if (quickCaptureBtn) {
    console.log('Selecting Quick Capture...');
    await quickCaptureBtn.click();
    await page.waitForTimeout(1500);
    
    // Should be on quick capture screen
    const captureNowBtn = await page.$('button:has-text("Capture Now")');
    if (captureNowBtn) {
      console.log('Clicking Capture Now...');
      await captureNowBtn.click();
      
      // Wait for processing
      await page.waitForTimeout(3000);
      
      // Check if processing started
      const processingScreen = await page.$('.ytgif-processing-screen');
      console.log('Processing screen visible:', !!processingScreen);
      
      if (processingScreen) {
        // Wait for progress updates
        await page.waitForTimeout(10000);
        
        // Check progress
        const progressInfo = await page.evaluate(() => {
          const progressBar = document.querySelector('.ytgif-progress-fill');
          const statusText = document.querySelector('.ytgif-status-text');
          return {
            progressWidth: progressBar ? progressBar.style.width : null,
            statusText: statusText ? statusText.textContent : null
          };
        });
        
        console.log('Progress info:', progressInfo);
      }
    }
  }
  
  // Check for any errors
  const errors = logs.filter(log => log.type === 'error');
  if (errors.length > 0) {
    console.log('\n=== ERRORS FOUND ===');
    errors.forEach(err => console.log(err.text));
  }
  
  // Take final screenshot
  await page.screenshot({ path: 'tests/screenshots/wizard-flow-final.png' });
  
  await page.waitForTimeout(2000);
  await browser.close();
});