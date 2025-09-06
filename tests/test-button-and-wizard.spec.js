const { test, expect, chromium } = require('@playwright/test');
const path = require('path');

test('Test: Click GIF button and verify wizard overlay', async () => {
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
  
  // Capture logs
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('YTGif') || text.includes('[Content]') || text.includes('Wizard') || text.includes('overlay')) {
      console.log('[Page]', text);
    }
  });
  
  console.log('Navigating to YouTube...');
  await page.goto('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  
  // Wait for video player and extension
  await page.waitForSelector('.html5-video-player', { timeout: 10000 });
  console.log('Video player loaded');
  
  // Wait for button to be injected
  await page.waitForTimeout(3000);
  
  // Check for button
  const button = await page.$('.ytgif-button');
  if (!button) {
    console.error('GIF button not found!');
    await browser.close();
    return;
  }
  
  console.log('GIF button found, clicking...');
  await button.click();
  
  // Wait for overlay
  await page.waitForTimeout(2000);
  
  // Check what appeared
  const overlayState = await page.evaluate(() => {
    const wizardOverlay = document.querySelector('#ytgif-wizard-overlay');
    const oldOverlay = document.querySelector('#ytgif-timeline-overlay');
    const welcomeScreen = document.querySelector('.ytgif-welcome-screen');
    const actionScreen = document.querySelector('.ytgif-action-screen');
    
    return {
      hasWizardOverlay: !!wizardOverlay,
      hasOldOverlay: !!oldOverlay,
      hasWelcomeScreen: !!welcomeScreen,
      hasActionScreen: !!actionScreen,
      wizardVisible: wizardOverlay ? wizardOverlay.style.display !== 'none' : false,
      overlayClasses: wizardOverlay ? wizardOverlay.className : null
    };
  });
  
  console.log('Overlay state:', overlayState);
  
  // If wizard overlay exists, try to navigate
  if (overlayState.hasWizardOverlay) {
    console.log('Wizard overlay found!');
    
    // Try to find and click "Get Started" button
    const getStartedBtn = await page.$('.ytgif-welcome-screen button:has-text("Get Started")');
    if (getStartedBtn) {
      console.log('Clicking Get Started...');
      await getStartedBtn.click();
      await page.waitForTimeout(1000);
      
      // Check if we're on action screen
      const actionScreen = await page.$('.ytgif-action-screen');
      console.log('Action screen visible:', !!actionScreen);
      
      if (actionScreen) {
        // Try quick capture
        const quickCaptureBtn = await page.$('button:has-text("Quick Capture")');
        if (quickCaptureBtn) {
          console.log('Clicking Quick Capture...');
          await quickCaptureBtn.click();
          await page.waitForTimeout(1000);
          
          // Check quick capture screen
          const quickCaptureScreen = await page.$('.ytgif-quick-capture-screen');
          console.log('Quick capture screen visible:', !!quickCaptureScreen);
        }
      }
    }
  }
  
  // Take screenshot
  await page.screenshot({ path: 'tests/screenshots/button-and-wizard.png' });
  console.log('Screenshot saved');
  
  await browser.close();
});