const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Multi-Screen Wizard Flow Test', () => {
  let browser;
  let context;
  let page;
  let extensionId;

  test.beforeAll(async ({ playwright }) => {
    const extensionPath = path.join(__dirname, '..', 'dist');
    console.log('Loading extension from:', extensionPath);
    
    // Launch browser with extension
    browser = await playwright.chromium.launch({
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--no-sandbox'
      ]
    });
    
    context = await browser.newContext();
    
    // Wait a bit for extension to initialize
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Get extension ID from manifest
    const extensions = await browser.newContext();
    const page = await extensions.newPage();
    await page.goto('chrome://extensions/');
    await page.waitForTimeout(1000);
    
    // For testing, we'll use a fixed pattern since service worker might not be accessible
    // The extension ID will be dynamic but we can construct the popup URL
    extensionId = 'test-extension-id'; // This will be replaced by actual extension ID
  });

  test.afterAll(async () => {
    await context?.close();
    await browser?.close();
  });

  test('Navigate through wizard screens', async () => {
    console.log('🎬 Testing Multi-Screen Wizard Flow');
    
    // First navigate to YouTube
    page = await context.newPage();
    await page.goto('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    await page.waitForLoadState('networkidle');
    console.log('📺 YouTube video loaded');
    
    // Wait for video player to be ready
    await page.waitForSelector('.html5-video-player', { timeout: 10000 });
    
    // Open extension popup
    const popupUrl = `chrome-extension://${extensionId}/popup.html`;
    const popupPage = await context.newPage();
    await popupPage.goto(popupUrl);
    await popupPage.waitForLoadState('networkidle');
    console.log('🎯 Extension popup opened');
    
    // Screen 1: Welcome Screen
    console.log('\n📍 Screen 1: Welcome Screen');
    const welcomeTitle = await popupPage.locator('h1:has-text("YouTube GIF Maker")');
    expect(await welcomeTitle.isVisible()).toBe(true);
    
    // Should detect video
    await popupPage.waitForSelector('text=/Video detected/', { timeout: 5000 });
    console.log('✅ Video detected on Welcome screen');
    
    // Should have Get Started button
    const getStartedBtn = await popupPage.locator('button:has-text("Get Started")');
    expect(await getStartedBtn.isVisible()).toBe(true);
    
    // Check for auto-progression or click Get Started
    await Promise.race([
      popupPage.waitForSelector('text=/Choose Capture Mode/', { timeout: 2000 }),
      getStartedBtn.click()
    ]);
    
    // Screen 2: Action Select Screen
    console.log('\n📍 Screen 2: Action Select Screen');
    await popupPage.waitForSelector('h2:has-text("Choose Capture Mode")', { timeout: 5000 });
    
    // Should show two options
    const quickCapture = await popupPage.locator('text=/Quick Capture/');
    const customRange = await popupPage.locator('text=/Custom Range/');
    expect(await quickCapture.isVisible()).toBe(true);
    expect(await customRange.isVisible()).toBe(true);
    console.log('✅ Both capture options visible');
    
    // Click Quick Capture
    await quickCapture.click();
    
    // Screen 3: Quick Capture Preview
    console.log('\n📍 Screen 3: Quick Capture Preview');
    await popupPage.waitForSelector('h2:has-text("Quick Capture Preview")', { timeout: 5000 });
    
    // Should show duration
    const duration = await popupPage.locator('text=/4.*s/').first();
    expect(await duration.isVisible()).toBe(true);
    console.log('✅ Quick capture duration shown');
    
    // Should have Create GIF button
    const createGifBtn = await popupPage.locator('button:has-text("Create GIF")');
    expect(await createGifBtn.isVisible()).toBe(true);
    
    // Test Back navigation
    console.log('\n🔄 Testing Back Navigation');
    const backBtn = await popupPage.locator('button:has-text("Back")');
    await backBtn.click();
    
    // Should be back on Action Select
    await popupPage.waitForSelector('h2:has-text("Choose Capture Mode")', { timeout: 5000 });
    console.log('✅ Back navigation works');
    
    // Now test Custom Range
    console.log('\n📍 Testing Custom Range Flow');
    await customRange.click();
    
    // Screen 3B: Custom Range Screen
    await popupPage.waitForSelector('h2:has-text("Select Range")', { timeout: 5000 });
    
    // Should have timeline scrubber
    const timeline = await popupPage.locator('.bg-gray-100.rounded-lg');
    expect(await timeline.isVisible()).toBe(true);
    
    // Should have time inputs
    const startTimeInput = await popupPage.locator('input').first();
    const endTimeInput = await popupPage.locator('input').nth(1);
    expect(await startTimeInput.isVisible()).toBe(true);
    expect(await endTimeInput.isVisible()).toBe(true);
    console.log('✅ Custom range controls visible');
    
    // Test progress indicator
    console.log('\n📊 Testing Progress Indicator');
    const progressDots = await popupPage.locator('.w-1\\.5.h-1\\.5.rounded-full.bg-white');
    const dotCount = await progressDots.count();
    console.log(`✅ Progress indicator shows ${dotCount} filled dots`);
    
    // Test header back button
    console.log('\n🔙 Testing Header Back Button');
    const headerBackBtn = await popupPage.locator('svg').first().locator('..');
    await headerBackBtn.click();
    await popupPage.waitForSelector('h2:has-text("Choose Capture Mode")', { timeout: 5000 });
    console.log('✅ Header back button works');
    
    // Test Library/Settings quick access
    console.log('\n📚 Testing Quick Access Links');
    // Go back to welcome screen
    await headerBackBtn.click();
    await popupPage.waitForSelector('h1:has-text("YouTube GIF Maker")', { timeout: 5000 });
    
    // Check for Library and Settings buttons
    const libraryBtn = await popupPage.locator('button:has-text("Library")');
    const settingsBtn = await popupPage.locator('button:has-text("Settings")');
    expect(await libraryBtn.isVisible()).toBe(true);
    expect(await settingsBtn.isVisible()).toBe(true);
    console.log('✅ Library and Settings buttons accessible');
    
    // Take screenshot of final state
    await popupPage.screenshot({ path: 'tests/screenshots/wizard-flow.png' });
    console.log('\n📸 Screenshot saved: tests/screenshots/wizard-flow.png');
    
    console.log('\n🎉 Multi-Screen Wizard Flow Test Complete!');
  });
});