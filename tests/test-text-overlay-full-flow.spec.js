const { test, expect, chromium } = require('@playwright/test');
const path = require('path');

test('Debug: Full text overlay flow with logging', async () => {
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
    const text = msg.text();
    if (text.includes('OverlayWizard') || text.includes('TextOverlay') || text.includes('Quick')) {
      console.log('[Browser]', text);
    }
  });

  // Navigate to YouTube video
  await page.goto('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  await page.waitForSelector('.html5-video-player', { timeout: 10000 });
  await page.waitForTimeout(3000); // Wait for extension to initialize

  // Click GIF button
  const gifButton = await page.waitForSelector('.ytgif-button', { timeout: 5000 });
  await gifButton.click();
  console.log('✓ Clicked GIF button');

  // Wait for wizard overlay
  await page.waitForSelector('#ytgif-wizard-overlay', { timeout: 5000 });
  console.log('✓ Wizard overlay appeared');

  // Wait for welcome screen to auto-advance
  console.log('⏳ Waiting for welcome screen to auto-advance...');
  await page.waitForTimeout(2000); // Welcome screen auto-advances after 1.5 seconds

  // Verify we're on quick capture screen
  const quickCaptureScreen = await page.waitForSelector('.ytgif-quick-capture-screen', { timeout: 5000 });
  console.log('✓ Quick capture screen is visible');

  // Take screenshot of quick capture
  await page.screenshot({ path: 'tests/screenshots/quick-capture-screen.png' });

  // Find and click "Create GIF" button
  console.log('🔍 Looking for Create GIF button...');
  
  // Try multiple selectors
  const createGifBtn = await page.waitForSelector('.ytgif-button-primary', { timeout: 5000 });
  
  // Check button text
  const buttonText = await createGifBtn.textContent();
  console.log(`📝 Button text: "${buttonText}"`);
  
  // Click the button
  await createGifBtn.click();
  console.log('✓ Clicked Create GIF button');

  // Wait a moment for navigation
  await page.waitForTimeout(1000);

  // Check what screen we're on now
  const currentScreens = await page.evaluate(() => {
    const screens = [];
    if (document.querySelector('.ytgif-text-overlay-screen')) screens.push('text-overlay');
    if (document.querySelector('.ytgif-processing-screen')) screens.push('processing');
    if (document.querySelector('.ytgif-quick-capture-screen')) screens.push('quick-capture');
    return screens;
  });
  console.log('📍 Current screens visible:', currentScreens);

  // Check if text overlay screen appeared
  const textOverlayScreen = await page.$('.ytgif-text-overlay-screen');
  if (textOverlayScreen) {
    console.log('✅ TEXT OVERLAY SCREEN FOUND!');
    
    // Verify key elements
    const hasPreview = await page.$('.ytgif-text-preview-section');
    const hasEditor = await page.$('.ytgif-text-editor-section');
    const hasSkipBtn = await page.$('button:has-text("Skip Text")');
    const hasApplyBtn = await page.$('button:has-text("Add Text First")');
    
    console.log('Elements found:', {
      preview: !!hasPreview,
      editor: !!hasEditor,
      skipButton: !!hasSkipBtn,
      applyButton: !!hasApplyBtn
    });
    
    // Take screenshot
    await page.screenshot({ path: 'tests/screenshots/text-overlay-screen-success.png' });
  } else {
    console.log('❌ Text overlay screen NOT found');
    
    // Debug - check what's actually on the page
    const visibleElements = await page.evaluate(() => {
      return {
        hasWizard: !!document.querySelector('#ytgif-wizard-overlay'),
        wizardClasses: document.querySelector('.ytgif-wizard-screens')?.innerHTML?.substring(0, 200),
        buttons: Array.from(document.querySelectorAll('button')).map(b => b.textContent),
        screens: Array.from(document.querySelectorAll('[class*="screen"]')).map(s => s.className)
      };
    });
    console.log('Page state:', visibleElements);
    
    await page.screenshot({ path: 'tests/screenshots/text-overlay-missing.png' });
  }

  await browser.close();
});