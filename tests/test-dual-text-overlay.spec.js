const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Dual Text Overlay Feature', () => {
  let page, context;

  test.beforeEach(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();

    // Load extension
    const extensionPath = path.join(__dirname, '..', 'dist');
    const extensionId = 'your-extension-id'; // Replace with actual ID
    
    // Navigate to YouTube
    await page.goto('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    await page.waitForTimeout(3000);
  });

  test.afterEach(async () => {
    await context.close();
  });

  test('should display both top and bottom text input fields', async () => {
    // Click GIF button
    const gifButton = await page.waitForSelector('.ytgif-button', { timeout: 10000 });
    await gifButton.click();

    // Wait for wizard to open
    await page.waitForSelector('.ytgif-wizard', { timeout: 5000 });

    // Click Quick Capture or proceed to text overlay screen
    const quickCapture = await page.waitForSelector('button:has-text("Quick Capture")', { timeout: 5000 });
    await quickCapture.click();

    // Wait for text overlay screen
    await page.waitForSelector('.ytgif-text-overlay-screen', { timeout: 10000 });

    // Check for both text input fields
    const topTextInput = await page.waitForSelector('input[placeholder*="top text"]', { timeout: 5000 });
    const bottomTextInput = await page.waitForSelector('input[placeholder*="bottom text"]', { timeout: 5000 });

    expect(topTextInput).toBeTruthy();
    expect(bottomTextInput).toBeTruthy();

    // Verify labels
    const topLabel = await page.locator('label:has-text("Top Text")');
    const bottomLabel = await page.locator('label:has-text("Bottom Text")');
    
    await expect(topLabel).toBeVisible();
    await expect(bottomLabel).toBeVisible();
  });

  test('should create GIF with both text overlays', async () => {
    // Navigate to text overlay screen (similar to above)
    const gifButton = await page.waitForSelector('.ytgif-button', { timeout: 10000 });
    await gifButton.click();
    
    await page.waitForSelector('.ytgif-wizard', { timeout: 5000 });
    
    const quickCapture = await page.waitForSelector('button:has-text("Quick Capture")', { timeout: 5000 });
    await quickCapture.click();
    
    await page.waitForSelector('.ytgif-text-overlay-screen', { timeout: 10000 });

    // Enter text in both fields
    const topTextInput = await page.waitForSelector('input[placeholder*="top text"]', { timeout: 5000 });
    const bottomTextInput = await page.waitForSelector('input[placeholder*="bottom text"]', { timeout: 5000 });

    await topTextInput.fill('TOP MEME TEXT');
    await bottomTextInput.fill('BOTTOM MEME TEXT');

    // Check preview shows both texts
    const topPreview = await page.locator('.ytgif-text-preview-overlay').first();
    const bottomPreview = await page.locator('.ytgif-text-preview-overlay').nth(1);
    
    await expect(topPreview).toContainText('TOP MEME TEXT');
    await expect(bottomPreview).toContainText('BOTTOM MEME TEXT');

    // Click create button
    const createButton = await page.locator('button:has-text("Add Text & Create")');
    await createButton.click();

    // Wait for GIF creation
    await page.waitForSelector('.ytgif-success-screen', { timeout: 30000 });
    
    console.log('✅ GIF created with dual text overlays successfully');
  });

  test('should allow independent styling for each text', async () => {
    // Navigate to text overlay screen
    const gifButton = await page.waitForSelector('.ytgif-button', { timeout: 10000 });
    await gifButton.click();
    
    await page.waitForSelector('.ytgif-wizard', { timeout: 5000 });
    
    const quickCapture = await page.waitForSelector('button:has-text("Quick Capture")', { timeout: 5000 });
    await quickCapture.click();
    
    await page.waitForSelector('.ytgif-text-overlay-screen', { timeout: 10000 });

    // Enter text
    const topTextInput = await page.waitForSelector('input[placeholder*="top text"]', { timeout: 5000 });
    const bottomTextInput = await page.waitForSelector('input[placeholder*="bottom text"]', { timeout: 5000 });

    await topTextInput.fill('STYLED TOP');
    await bottomTextInput.fill('STYLED BOTTOM');

    // Open style options for top text
    const topStyleButton = await page.locator('button:has-text("Top Text Style")');
    await topStyleButton.click();

    // Verify top text style controls are visible
    const topSizeSlider = await page.locator('.ytgif-text-section').first().locator('input[type="range"]');
    const topColorPicker = await page.locator('.ytgif-text-section').first().locator('input[type="color"]');
    
    await expect(topSizeSlider).toBeVisible();
    await expect(topColorPicker).toBeVisible();

    // Open style options for bottom text
    const bottomStyleButton = await page.locator('button:has-text("Bottom Text Style")');
    await bottomStyleButton.click();

    // Verify bottom text style controls are visible
    const bottomSizeSlider = await page.locator('.ytgif-text-section').nth(1).locator('input[type="range"]');
    const bottomColorPicker = await page.locator('.ytgif-text-section').nth(1).locator('input[type="color"]');
    
    await expect(bottomSizeSlider).toBeVisible();
    await expect(bottomColorPicker).toBeVisible();

    console.log('✅ Independent styling controls verified for both texts');
  });

  test('should allow creating GIF with only top or bottom text', async () => {
    // Navigate to text overlay screen
    const gifButton = await page.waitForSelector('.ytgif-button', { timeout: 10000 });
    await gifButton.click();
    
    await page.waitForSelector('.ytgif-wizard', { timeout: 5000 });
    
    const quickCapture = await page.waitForSelector('button:has-text("Quick Capture")', { timeout: 5000 });
    await quickCapture.click();
    
    await page.waitForSelector('.ytgif-text-overlay-screen', { timeout: 10000 });

    // Enter only top text
    const topTextInput = await page.waitForSelector('input[placeholder*="top text"]', { timeout: 5000 });
    await topTextInput.fill('ONLY TOP TEXT');

    // Verify preview shows only top text
    const textPreviews = await page.locator('.ytgif-text-preview-overlay').all();
    expect(textPreviews.length).toBe(1);
    
    const topPreview = await page.locator('.ytgif-text-preview-overlay').first();
    await expect(topPreview).toContainText('ONLY TOP TEXT');

    // Click create button
    const createButton = await page.locator('button:has-text("Add Text & Create")');
    await createButton.click();

    // Wait for GIF creation
    await page.waitForSelector('.ytgif-success-screen', { timeout: 30000 });
    
    console.log('✅ GIF created with only top text successfully');
  });
});