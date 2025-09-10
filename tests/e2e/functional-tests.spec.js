// Functional Tests for YouTube GIF Maker Extension
const { test, expect, chromium } = require('@playwright/test');
const path = require('path');

// Extension path
const extensionPath = path.join(__dirname, '..', 'dist');

// Test configuration
const TEST_VIDEOS = {
  short: 'https://www.youtube.com/watch?v=jNQXAC9IVRw', // 19 seconds - "Me at the zoo"
  medium: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', // Rick Roll - well known
  long: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ', // Big Buck Bunny
};

test.describe('YouTube GIF Maker - Functional Tests', () => {
  let browser;
  let context;
  let page;

  test.beforeAll(async () => {
    // Launch browser with extension
    browser = await chromium.launch({
      headless: false, // Set to true for CI/CD
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--no-sandbox'
      ]
    });
  });

  test.beforeEach(async () => {
    context = await browser.newContext();
    page = await context.newPage();
  });

  test.afterEach(async () => {
    await context.close();
  });

  test.afterAll(async () => {
    await browser.close();
  });

  test.describe('Core Functionality', () => {
    test('FUNC-001: Basic GIF Creation', async () => {
      // Navigate to test video
      await page.goto(TEST_VIDEOS.short);
      
      // Wait for video player to load
      await page.waitForSelector('video', { timeout: 10000 });
      
      // Wait for GIF button to appear
      const gifButton = await page.waitForSelector('.gif-button, [aria-label*="GIF"], button:has-text("GIF")', {
        timeout: 10000
      });
      
      expect(gifButton).toBeTruthy();
      
      // Click GIF button
      await gifButton.click();
      
      // Check if overlay appears
      const overlay = await page.waitForSelector('.gif-overlay, .timeline-overlay, [data-gif-overlay]', {
        timeout: 5000
      });
      
      expect(overlay).toBeTruthy();
    });

    test('FUNC-002: Timeline Selection', async () => {
      await page.goto(TEST_VIDEOS.short);
      await page.waitForSelector('video');
      
      // Open GIF creator
      const gifButton = await page.waitForSelector('.gif-button, [aria-label*="GIF"]');
      await gifButton.click();
      
      // Check timeline elements
      const timeline = await page.waitForSelector('.timeline, .scrubber, [data-timeline]');
      expect(timeline).toBeTruthy();
      
      // Check for selection handles
      const handles = await page.$$('.timeline-handle, .selection-handle, [data-handle]');
      expect(handles.length).toBeGreaterThanOrEqual(2);
    });

    test('FUNC-003: Text Overlay', async () => {
      await page.goto(TEST_VIDEOS.short);
      await page.waitForSelector('video');
      
      // Open GIF creator
      const gifButton = await page.waitForSelector('.gif-button, [aria-label*="GIF"]');
      await gifButton.click();
      
      // Look for text input
      const textInput = await page.waitForSelector('input[type="text"], textarea, [data-text-input]', {
        timeout: 5000
      });
      
      if (textInput) {
        await textInput.type('Test Text');
        const value = await textInput.inputValue();
        expect(value).toBe('Test Text');
      }
    });
  });

  test.describe('Video Type Compatibility', () => {
    test('VID-001: Regular Video', async () => {
      await page.goto(TEST_VIDEOS.medium);
      await page.waitForSelector('video');
      
      const gifButton = await page.$('.gif-button, [aria-label*="GIF"]');
      expect(gifButton).toBeTruthy();
    });

    test('VID-002: Short Video', async () => {
      await page.goto(TEST_VIDEOS.short);
      await page.waitForSelector('video');
      
      const gifButton = await page.$('.gif-button, [aria-label*="GIF"]');
      expect(gifButton).toBeTruthy();
    });
  });

  test.describe('Quality Settings', () => {
    test('QUAL-001: Quality Presets Available', async () => {
      await page.goto(TEST_VIDEOS.short);
      await page.waitForSelector('video');
      
      // Open GIF creator
      const gifButton = await page.waitForSelector('.gif-button, [aria-label*="GIF"]');
      await gifButton.click();
      
      // Check for quality options
      const qualityOptions = await page.$$('button:has-text("Fast"), button:has-text("Balanced"), button:has-text("High")');
      expect(qualityOptions.length).toBeGreaterThan(0);
    });
  });

  test.describe('Extension Popup', () => {
    test('POPUP-001: Extension Popup Opens', async () => {
      // Get extension ID
      const extensions = await browser.contexts()[0].serviceWorkers();
      if (extensions.length > 0) {
        const extensionId = extensions[0].url.split('/')[2];
        
        // Open popup
        const popupPage = await context.newPage();
        await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
        
        // Check popup loaded
        const title = await popupPage.title();
        expect(title).toContain('GIF');
      }
    });
  });

  test.describe('Performance', () => {
    test('PERF-001: Page Load Performance', async () => {
      const startTime = Date.now();
      
      await page.goto(TEST_VIDEOS.short);
      await page.waitForSelector('video');
      await page.waitForSelector('.gif-button, [aria-label*="GIF"]');
      
      const loadTime = Date.now() - startTime;
      
      // Should load within 5 seconds
      expect(loadTime).toBeLessThan(5000);
    });

    test('PERF-002: Memory Usage Check', async () => {
      await page.goto(TEST_VIDEOS.short);
      
      // Get initial memory
      const metrics1 = await page.metrics();
      
      // Open GIF creator
      const gifButton = await page.waitForSelector('.gif-button, [aria-label*="GIF"]');
      await gifButton.click();
      
      // Wait a bit
      await page.waitForTimeout(2000);
      
      // Get memory after opening
      const metrics2 = await page.metrics();
      
      // Memory increase should be reasonable (< 50MB)
      const memoryIncrease = (metrics2.JSHeapUsedSize - metrics1.JSHeapUsedSize) / 1024 / 1024;
      expect(memoryIncrease).toBeLessThan(50);
    });
  });

  test.describe('Error Handling', () => {
    test('ERR-001: Invalid Video URL', async () => {
      // Try non-YouTube URL
      await page.goto('https://www.google.com');
      
      // GIF button should not appear
      const gifButton = await page.$('.gif-button, [aria-label*="GIF"]');
      expect(gifButton).toBeFalsy();
    });
  });
});

// Export test results formatter
module.exports = {
  reporter: [
    ['list'],
    ['junit', { outputFile: 'test-results/functional-tests.xml' }],
    ['html', { outputFolder: 'test-results/html' }]
  ]
};