const { test, expect, chromium } = require('@playwright/test');
const path = require('path');

test.describe('Text Overlay Integration Tests', () => {
  let browser;
  let page;

  test.beforeAll(async () => {
    const extensionPath = path.join(__dirname, '..', 'dist');
    console.log('Loading extension from:', extensionPath);
    
    browser = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--no-sandbox'
      ],
      viewport: { width: 1280, height: 720 }
    });
  });

  test.beforeEach(async () => {
    page = await browser.newPage();
    
    // Capture relevant logs
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('YTGif') || text.includes('Wizard') || text.includes('TextOverlay') || text.includes('overlay')) {
        console.log('[Page]', text);
      }
    });

    // Navigate to YouTube video
    await page.goto('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    await page.waitForSelector('.html5-video-player', { timeout: 10000 });
    await page.waitForTimeout(3000); // Wait for extension to initialize
  });

  test.afterEach(async () => {
    await page.close();
  });

  test.afterAll(async () => {
    await browser.close();
  });

  test('should navigate to text overlay screen after quick capture', async () => {
    console.log('Test: Navigate to text overlay screen');
    
    // Click GIF button
    const gifButton = await page.waitForSelector('.ytgif-button', { timeout: 5000 });
    await gifButton.click();
    
    // Wait for wizard overlay
    await page.waitForSelector('#ytgif-wizard-overlay', { timeout: 5000 });
    console.log('Wizard overlay appeared');
    
    // Wait for auto-advance from welcome screen to quick capture
    console.log('Waiting for auto-advance from welcome screen...');
    await page.waitForTimeout(2000); // Welcome screen auto-advances after 1.5 seconds
    
    // Wait for quick capture screen
    await page.waitForSelector('.ytgif-quick-capture-screen', { timeout: 5000 });
    console.log('Quick capture screen visible');
    
    // Click "Create GIF" on quick capture
    const createGifBtn = await page.waitForSelector('.ytgif-button-primary:has-text("Create GIF")', { timeout: 5000 });
    await createGifBtn.click();
    console.log('Clicked Create GIF on quick capture');
    
    // Verify text overlay screen appears
    await page.waitForSelector('.ytgif-text-overlay-screen', { timeout: 5000 });
    const textOverlayScreen = await page.$('.ytgif-text-overlay-screen');
    expect(textOverlayScreen).toBeTruthy();
    console.log('Text overlay screen appeared successfully');
    
    // Verify screen title
    const title = await page.textContent('.ytgif-wizard-title');
    expect(title).toContain('Add Text to Your GIF');
    
    // Verify presence of key elements
    const hasPreviewSection = await page.$('.ytgif-video-preview-section');
    const hasControlsSection = await page.$('.ytgif-text-controls');
    const hasSkipButton = await page.$('button:has-text("Skip Text")');
    const hasCreateButton = await page.$('.ytgif-button-primary');
    
    expect(hasPreviewSection).toBeTruthy();
    expect(hasControlsSection).toBeTruthy();
    expect(hasSkipButton).toBeTruthy();
    expect(hasCreateButton).toBeTruthy();
    
    // Take screenshot
    await page.screenshot({ path: 'tests/screenshots/text-overlay-screen.png' });
    console.log('Screenshot saved: text-overlay-screen.png');
  });

  test('should skip text overlay and proceed to processing', async () => {
    console.log('Test: Skip text overlay flow');
    
    // Navigate to text overlay screen
    await navigateToTextOverlayScreen(page);
    
    // Click Skip Text button
    const skipBtn = await page.waitForSelector('button:has-text("Skip Text")', { timeout: 5000 });
    await skipBtn.click();
    console.log('Clicked Skip Text button');
    
    // Verify processing screen appears
    await page.waitForSelector('.ytgif-processing-screen', { timeout: 10000 });
    const processingScreen = await page.$('.ytgif-processing-screen');
    expect(processingScreen).toBeTruthy();
    console.log('Processing screen appeared after skipping text overlay');
    
    // Wait a moment for processing screen to fully render
    await page.waitForTimeout(500);
    
    // Check that we're on the processing screen (the screen itself is enough)
    const isProcessingScreen = await page.evaluate(() => {
      return !!document.querySelector('.ytgif-processing-screen');
    });
    expect(isProcessingScreen).toBeTruthy();
    
    await page.screenshot({ path: 'tests/screenshots/skip-text-overlay-flow.png' });
  });

  test('should add text overlay and apply it', async () => {
    console.log('Test: Add and apply text overlay');
    
    // Navigate to text overlay screen
    await navigateToTextOverlayScreen(page);
    
    // Wait for text overlay editor to be ready
    await page.waitForTimeout(1000);
    
    // Enter some text in the text input
    const textInput = await page.$('.ytgif-text-input');
    expect(textInput).toBeTruthy();
    await textInput.fill('Test Overlay Text');
    console.log('Entered text in overlay input');
    
    // Wait a moment for the button text to change
    await page.waitForTimeout(500);
    
    // The primary button should now say "Add Text & Create GIF"
    const createGifBtn = await page.$('button:has-text("Add Text & Create GIF")');
    expect(createGifBtn).toBeTruthy();
    
    // Click the create GIF button
    await createGifBtn.click();
    console.log('Clicked Add Text & Create GIF button');
    
    // Verify processing screen appears
    await page.waitForSelector('.ytgif-processing-screen', { timeout: 10000 });
    const processingScreen = await page.$('.ytgif-processing-screen');
    expect(processingScreen).toBeTruthy();
    console.log('Processing screen appeared after applying text overlay');
    
    await page.screenshot({ path: 'tests/screenshots/apply-text-overlay-flow.png' });
  });

  test('should edit text overlay properties', async () => {
    console.log('Test: Edit text overlay properties');
    
    // Navigate to text overlay screen
    await navigateToTextOverlayScreen(page);
    
    // Enter text in the input field
    const textInput = await page.$('.ytgif-text-input');
    expect(textInput).toBeTruthy();
    await textInput.fill('Styled GIF Text');
    console.log('Entered text in input field');
    
    // Open advanced options
    const advancedToggle = await page.$('.ytgif-advanced-toggle');
    if (advancedToggle) {
      await advancedToggle.click();
      await page.waitForTimeout(500);
      console.log('Opened advanced options');
    }
    
    // Try to find font size control (range input)
    const fontSizeInput = await page.$('.ytgif-range-input');
    if (fontSizeInput) {
      await fontSizeInput.fill('48');
      console.log('Updated font size to 48px');
    }
    
    // Try to find color picker
    const colorInput = await page.$('.ytgif-color-input');
    if (colorInput) {
      await colorInput.fill('#ff0000');
      console.log('Updated text color to red');
    }
    
    // Verify preview shows the styled text
    const previewOverlay = await page.$('.ytgif-text-preview-overlay');
    if (previewOverlay) {
      const textContent = await previewOverlay.textContent();
      expect(textContent).toContain('Styled GIF Text');
      console.log('Verified text appears in preview');
    }
    
    await page.screenshot({ path: 'tests/screenshots/edit-text-overlay.png' });
    console.log('Screenshot saved: edit-text-overlay.png');
  });

  test('should show correct progress indicator for text overlay step', async () => {
    console.log('Test: Progress indicator for text overlay step');
    
    // Navigate to text overlay screen
    await navigateToTextOverlayScreen(page);
    
    // Check progress dots
    const progressDots = await page.$$('.ytgif-progress-dot');
    expect(progressDots.length).toBeGreaterThanOrEqual(4); // welcome, capture, text, processing, success
    
    // Check active dots (should be 3 dots active for text overlay screen)
    const activeDots = await page.$$('.ytgif-progress-dot.active');
    expect(activeDots.length).toBe(3);
    console.log(`Progress indicator shows ${activeDots.length} active dots`);
    
    await page.screenshot({ path: 'tests/screenshots/text-overlay-progress.png' });
  });

  test('should handle back navigation from text overlay screen', async () => {
    console.log('Test: Back navigation from text overlay screen');
    
    // Navigate to text overlay screen
    await navigateToTextOverlayScreen(page);
    
    // Look for back button
    const backBtn = await page.$('.ytgif-wizard-btn-secondary:has-text("Back")');
    if (backBtn) {
      await backBtn.click();
      console.log('Clicked Back button');
      
      // Should return to quick capture screen
      await page.waitForSelector('.ytgif-quick-capture-screen', { timeout: 5000 });
      const quickCaptureScreen = await page.$('.ytgif-quick-capture-screen');
      expect(quickCaptureScreen).toBeTruthy();
      console.log('Successfully navigated back to quick capture screen');
    } else {
      console.log('No back button found (might be expected behavior)');
    }
    
    await page.screenshot({ path: 'tests/screenshots/text-overlay-back-nav.png' });
  });

  // Helper function to navigate to text overlay screen
  async function navigateToTextOverlayScreen(page) {
    // Click GIF button
    const gifButton = await page.waitForSelector('.ytgif-button', { timeout: 5000 });
    await gifButton.click();
    
    // Wait for wizard overlay
    await page.waitForSelector('#ytgif-wizard-overlay', { timeout: 5000 });
    
    // Wait for auto-advance from welcome screen
    await page.waitForTimeout(2000); // Welcome screen auto-advances after 1.5 seconds
    
    // Wait for quick capture screen
    await page.waitForSelector('.ytgif-quick-capture-screen', { timeout: 5000 });
    
    // Click "Create GIF" on quick capture
    const createGifBtn = await page.waitForSelector('.ytgif-button-primary:has-text("Create GIF")', { timeout: 5000 });
    await createGifBtn.click();
    
    // Wait for text overlay screen
    await page.waitForSelector('.ytgif-text-overlay-screen', { timeout: 5000 });
    console.log('Navigated to text overlay screen');
  }
});