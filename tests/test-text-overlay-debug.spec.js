const { test, expect, chromium } = require('@playwright/test');
const path = require('path');

test('Debug: Text overlay screen navigation', async () => {
  const extensionPath = path.join(__dirname, '..', 'dist');
  console.log('Loading extension from:', extensionPath);
  
  const browser = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--no-sandbox'
    ],
    viewport: { width: 1280, height: 720 }
  });

  const page = await browser.newPage();
  
  // Capture all console logs
  page.on('console', msg => {
    console.log('[Browser Console]', msg.text());
  });

  // Navigate to YouTube video
  await page.goto('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  await page.waitForSelector('.html5-video-player', { timeout: 10000 });
  await page.waitForTimeout(3000); // Wait for extension to initialize

  // Click GIF button
  const gifButton = await page.waitForSelector('.ytgif-button', { timeout: 5000 });
  await gifButton.click();
  console.log('Clicked GIF button');

  // Wait for wizard overlay
  await page.waitForSelector('#ytgif-wizard-overlay', { timeout: 5000 });
  console.log('Wizard overlay appeared');

  // Check current screen
  let currentScreen = await page.evaluate(() => {
    const screens = document.querySelectorAll('.ytgif-wizard-screen');
    for (const screen of screens) {
      if (screen && screen.offsetParent !== null) {
        return screen.className;
      }
    }
    // Check for specific screen classes
    if (document.querySelector('.ytgif-welcome-screen')) return 'welcome';
    if (document.querySelector('.ytgif-quick-capture-screen')) return 'quick-capture';
    if (document.querySelector('.ytgif-text-overlay-screen')) return 'text-overlay';
    return 'unknown';
  });
  console.log('Current screen after opening:', currentScreen);

  // Find and click the primary button (continue/confirm)
  await page.waitForTimeout(1000);
  
  // Try different selectors for the continue button
  const continueSelectors = [
    '.ytgif-wizard-btn-primary',
    'button.ytgif-wizard-btn-primary',
    '.ytgif-wizard-actions button:last-child',
    'button:has-text("Continue")',
    'button:has-text("Get Started")'
  ];

  let continueBtn = null;
  for (const selector of continueSelectors) {
    continueBtn = await page.$(selector);
    if (continueBtn) {
      console.log(`Found continue button with selector: ${selector}`);
      break;
    }
  }

  if (continueBtn) {
    await continueBtn.click();
    console.log('Clicked continue/get started button');
    await page.waitForTimeout(1000);

    // Check screen after first click
    currentScreen = await page.evaluate(() => {
      if (document.querySelector('.ytgif-welcome-screen')) return 'welcome';
      if (document.querySelector('.ytgif-quick-capture-screen')) return 'quick-capture';
      if (document.querySelector('.ytgif-text-overlay-screen')) return 'text-overlay';
      return 'unknown';
    });
    console.log('Current screen after first click:', currentScreen);

    // If we're on quick capture, try to confirm
    if (currentScreen === 'quick-capture') {
      const confirmBtn = await page.$('.ytgif-wizard-btn-primary:has-text("Confirm")');
      if (confirmBtn) {
        console.log('Found confirm button on quick capture screen');
        await confirmBtn.click();
        console.log('Clicked confirm button');
        await page.waitForTimeout(2000);

        // Check screen after confirm
        currentScreen = await page.evaluate(() => {
          if (document.querySelector('.ytgif-welcome-screen')) return 'welcome';
          if (document.querySelector('.ytgif-quick-capture-screen')) return 'quick-capture';
          if (document.querySelector('.ytgif-text-overlay-screen')) return 'text-overlay';
          if (document.querySelector('.ytgif-processing-screen')) return 'processing';
          return 'unknown';
        });
        console.log('Current screen after confirm:', currentScreen);

        // Check if text overlay screen elements exist
        const textOverlayElements = await page.evaluate(() => {
          return {
            hasTextOverlayScreen: !!document.querySelector('.ytgif-text-overlay-screen'),
            hasTextEditor: !!document.querySelector('.ytgif-text-editor-section'),
            hasTextPreview: !!document.querySelector('.ytgif-text-preview-section'),
            hasSkipButton: !!document.querySelector('button:has-text("Skip Text")'),
            visibleScreenClasses: Array.from(document.querySelectorAll('[class*="screen"]')).map(el => el.className)
          };
        });
        console.log('Text overlay elements:', textOverlayElements);
      }
    }
  }

  // Take screenshot
  await page.screenshot({ path: 'tests/screenshots/text-overlay-debug.png' });
  console.log('Screenshot saved');

  await browser.close();
});