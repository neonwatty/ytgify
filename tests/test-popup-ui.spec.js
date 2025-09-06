const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Popup UI Test', () => {
  let browser;
  let context;
  let page;

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
  });

  test.afterAll(async () => {
    await context?.close();
    await browser?.close();
  });

  test('should display popup without scrolling', async () => {
    console.log('Opening extension popup...');
    
    // Get extension ID
    const serviceWorker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    const extensionId = serviceWorker.url().split('/')[2];
    console.log('Extension ID:', extensionId);
    
    // Open popup
    const popupUrl = `chrome-extension://${extensionId}/popup.html`;
    page = await context.newPage();
    await page.goto(popupUrl);
    
    console.log('Popup opened!');
    
    // Wait for popup to load
    await page.waitForLoadState('networkidle');
    
    // Check popup dimensions
    const dimensions = await page.evaluate(() => {
      const body = document.body;
      const root = document.getElementById('root');
      return {
        bodyWidth: body.offsetWidth,
        bodyHeight: body.offsetHeight,
        bodyScrollHeight: body.scrollHeight,
        rootHeight: root?.offsetHeight,
        rootScrollHeight: root?.scrollHeight,
        hasVerticalScroll: body.scrollHeight > body.clientHeight,
        rootHasScroll: root ? root.scrollHeight > root.clientHeight : false
      };
    });
    
    console.log('Popup dimensions:', dimensions);
    
    // Verify no scrolling needed
    expect(dimensions.hasVerticalScroll).toBe(false);
    expect(dimensions.bodyHeight).toBeLessThanOrEqual(400);
    
    // Check for main elements
    const header = await page.locator('.bg-gradient-to-r').first();
    expect(await header.isVisible()).toBe(true);
    
    // Check navigation tabs
    const createTab = await page.locator('button:has-text("Create")');
    const libraryTab = await page.locator('button:has-text("Library")');
    const settingsTab = await page.locator('button:has-text("Settings")');
    
    expect(await createTab.isVisible()).toBe(true);
    expect(await libraryTab.isVisible()).toBe(true);
    expect(await settingsTab.isVisible()).toBe(true);
    
    // Check Create view is default
    const createViewContent = await page.locator('text=/Navigate to a YouTube video/');
    expect(await createViewContent.isVisible()).toBe(true);
    
    // Click Library tab
    await libraryTab.click();
    await page.waitForTimeout(500);
    
    // Check Library view dimensions
    const libraryDimensions = await page.evaluate(() => {
      const body = document.body;
      return {
        hasVerticalScroll: body.scrollHeight > body.clientHeight,
        scrollHeight: body.scrollHeight,
        clientHeight: body.clientHeight
      };
    });
    
    console.log('Library view dimensions:', libraryDimensions);
    expect(libraryDimensions.hasVerticalScroll).toBe(false);
    
    // Click Settings tab
    await settingsTab.click();
    await page.waitForTimeout(500);
    
    // Check Settings view dimensions
    const settingsDimensions = await page.evaluate(() => {
      const body = document.body;
      return {
        hasVerticalScroll: body.scrollHeight > body.clientHeight,
        scrollHeight: body.scrollHeight,
        clientHeight: body.clientHeight
      };
    });
    
    console.log('Settings view dimensions:', settingsDimensions);
    expect(settingsDimensions.hasVerticalScroll).toBe(false);
    
    // Take screenshot for reference
    await page.screenshot({ path: 'tests/screenshots/popup-ui.png', fullPage: false });
    console.log('Screenshot saved to tests/screenshots/popup-ui.png');
    
    console.log('✅ Popup UI test complete - no scrolling detected!');
  });
});