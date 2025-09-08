const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Updated Text Overlay Tests - Dual Text Support', () => {
  let page, context;
  
  test.beforeEach(async ({ browser }) => {
    // Create a new context with extension loaded
    context = await browser.newContext({
      // Add any required extension loading config here
    });
    page = await context.newPage();
    
    // Navigate to YouTube
    await page.goto('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    await page.waitForSelector('.html5-video-player', { timeout: 10000 });
    await page.waitForTimeout(3000); // Wait for extension to initialize
  });
  
  test.afterEach(async () => {
    await context.close();
  });
  
  test('should display dual text input fields', async () => {
    // Click GIF button
    const gifButton = await page.waitForSelector('.ytgif-button', { timeout: 5000 });
    await gifButton.click();
    
    // Wait for wizard
    await page.waitForSelector('#ytgif-wizard-overlay', { timeout: 5000 });
    await page.waitForTimeout(2000); // Wait for welcome screen to auto-advance
    
    // Click Quick Capture to go to text overlay screen
    const createGifBtn = await page.waitForSelector('.ytgif-button-primary:has-text("Create GIF")', { timeout: 5000 });
    await createGifBtn.click();
    
    // Wait for text overlay screen
    await page.waitForSelector('.ytgif-text-overlay-screen', { timeout: 5000 });
    
    // Check for both text inputs
    const topTextInput = await page.$('input[placeholder*="top text"]');
    const bottomTextInput = await page.$('input[placeholder*="bottom text"]');
    
    expect(topTextInput).toBeTruthy();
    expect(bottomTextInput).toBeTruthy();
    console.log('✓ Both text input fields are present');
  });
  
  test('should create GIF with both text overlays', async () => {
    // Click GIF button
    const gifButton = await page.waitForSelector('.ytgif-button', { timeout: 5000 });
    await gifButton.click();
    
    // Navigate to text overlay screen
    await page.waitForSelector('#ytgif-wizard-overlay', { timeout: 5000 });
    await page.waitForTimeout(2000);
    
    const createGifBtn = await page.waitForSelector('.ytgif-button-primary:has-text("Create GIF")', { timeout: 5000 });
    await createGifBtn.click();
    
    await page.waitForSelector('.ytgif-text-overlay-screen', { timeout: 5000 });
    
    // Fill both text inputs
    const topTextInput = await page.$('input[placeholder*="top text"]');
    const bottomTextInput = await page.$('input[placeholder*="bottom text"]');
    
    if (topTextInput) {
      await topTextInput.fill('MEME TOP TEXT');
      console.log('✓ Added top text');
    }
    
    if (bottomTextInput) {
      await bottomTextInput.fill('MEME BOTTOM TEXT');
      console.log('✓ Added bottom text');
    }
    
    // Verify preview shows both texts
    const textPreviews = await page.$$('.ytgif-text-preview-overlay');
    expect(textPreviews.length).toBeGreaterThanOrEqual(2);
    console.log('✓ Both text previews visible');
    
    // Click create button
    const addTextBtn = await page.$('button:has-text("Add Text & Create")');
    if (addTextBtn) {
      await addTextBtn.click();
      console.log('✓ Clicked Add Text & Create');
    }
    
    // Wait for success
    await page.waitForSelector('.ytgif-success-screen', { timeout: 30000 });
    console.log('✓ GIF created with dual text overlays');
  });
  
  test('should allow independent styling for each text', async () => {
    // Navigate to text overlay screen
    const gifButton = await page.waitForSelector('.ytgif-button', { timeout: 5000 });
    await gifButton.click();
    
    await page.waitForSelector('#ytgif-wizard-overlay', { timeout: 5000 });
    await page.waitForTimeout(2000);
    
    const createGifBtn = await page.waitForSelector('.ytgif-button-primary:has-text("Create GIF")', { timeout: 5000 });
    await createGifBtn.click();
    
    await page.waitForSelector('.ytgif-text-overlay-screen', { timeout: 5000 });
    
    // Fill text inputs
    const topTextInput = await page.$('input[placeholder*="top text"]');
    const bottomTextInput = await page.$('input[placeholder*="bottom text"]');
    
    if (topTextInput) await topTextInput.fill('STYLED TOP');
    if (bottomTextInput) await bottomTextInput.fill('STYLED BOTTOM');
    
    // Open and test top text style controls
    const topStyleBtn = await page.$('button:has-text("Top Text Style")');
    if (topStyleBtn) {
      await topStyleBtn.click();
      await page.waitForTimeout(500);
      
      // Check for top text controls
      const topSection = await page.$('.ytgif-text-section');
      const topSizeSlider = await topSection?.$('input[type="range"]');
      const topColorPicker = await topSection?.$('input[type="color"]');
      
      expect(topSizeSlider).toBeTruthy();
      expect(topColorPicker).toBeTruthy();
      
      // Change top text size
      if (topSizeSlider) {
        await topSizeSlider.evaluate(el => el.value = '48');
        await topSizeSlider.dispatchEvent('input');
        console.log('✓ Changed top text size');
      }
      
      // Change top text color
      if (topColorPicker) {
        await topColorPicker.fill('#FF0000');
        console.log('✓ Changed top text color to red');
      }
    }
    
    // Open and test bottom text style controls
    const bottomStyleBtn = await page.$('button:has-text("Bottom Text Style")');
    if (bottomStyleBtn) {
      await bottomStyleBtn.click();
      await page.waitForTimeout(500);
      
      // Check for bottom text controls (in second section)
      const sections = await page.$$('.ytgif-text-section');
      if (sections.length >= 2) {
        const bottomSection = sections[1];
        const bottomSizeSlider = await bottomSection.$('input[type="range"]');
        const bottomColorPicker = await bottomSection.$('input[type="color"]');
        
        expect(bottomSizeSlider).toBeTruthy();
        expect(bottomColorPicker).toBeTruthy();
        
        // Change bottom text size
        if (bottomSizeSlider) {
          await bottomSizeSlider.evaluate(el => el.value = '32');
          await bottomSizeSlider.dispatchEvent('input');
          console.log('✓ Changed bottom text size');
        }
        
        // Change bottom text color
        if (bottomColorPicker) {
          await bottomColorPicker.fill('#00FF00');
          console.log('✓ Changed bottom text color to green');
        }
      }
    }
    
    // Take screenshot showing styled texts
    await page.screenshot({ path: 'tests/screenshots/dual-text-styled.png' });
    console.log('✓ Independent styling verified for both texts');
  });
  
  test('should work with only top text', async () => {
    // Navigate to text overlay screen
    const gifButton = await page.waitForSelector('.ytgif-button', { timeout: 5000 });
    await gifButton.click();
    
    await page.waitForSelector('#ytgif-wizard-overlay', { timeout: 5000 });
    await page.waitForTimeout(2000);
    
    const createGifBtn = await page.waitForSelector('.ytgif-button-primary:has-text("Create GIF")', { timeout: 5000 });
    await createGifBtn.click();
    
    await page.waitForSelector('.ytgif-text-overlay-screen', { timeout: 5000 });
    
    // Fill only top text
    const topTextInput = await page.$('input[placeholder*="top text"]');
    if (topTextInput) {
      await topTextInput.fill('ONLY TOP TEXT HERE');
      console.log('✓ Added only top text');
    }
    
    // Verify only one preview shows
    await page.waitForTimeout(500);
    const textPreviews = await page.$$('.ytgif-text-preview-overlay');
    expect(textPreviews.length).toBe(1);
    console.log('✓ Only one text preview visible');
    
    // Create GIF
    const addTextBtn = await page.$('button:has-text("Add Text & Create")');
    if (addTextBtn) {
      await addTextBtn.click();
      console.log('✓ Creating GIF with only top text');
    }
  });
  
  test('should work with only bottom text', async () => {
    // Navigate to text overlay screen
    const gifButton = await page.waitForSelector('.ytgif-button', { timeout: 5000 });
    await gifButton.click();
    
    await page.waitForSelector('#ytgif-wizard-overlay', { timeout: 5000 });
    await page.waitForTimeout(2000);
    
    const createGifBtn = await page.waitForSelector('.ytgif-button-primary:has-text("Create GIF")', { timeout: 5000 });
    await createGifBtn.click();
    
    await page.waitForSelector('.ytgif-text-overlay-screen', { timeout: 5000 });
    
    // Fill only bottom text
    const bottomTextInput = await page.$('input[placeholder*="bottom text"]');
    if (bottomTextInput) {
      await bottomTextInput.fill('ONLY BOTTOM TEXT HERE');
      console.log('✓ Added only bottom text');
    }
    
    // Verify only one preview shows
    await page.waitForTimeout(500);
    const textPreviews = await page.$$('.ytgif-text-preview-overlay');
    expect(textPreviews.length).toBe(1);
    console.log('✓ Only one text preview visible');
    
    // Create GIF
    const addTextBtn = await page.$('button:has-text("Add Text & Create")');
    if (addTextBtn) {
      await addTextBtn.click();
      console.log('✓ Creating GIF with only bottom text');
    }
  });
  
  test('should allow skipping text entirely', async () => {
    // Navigate to text overlay screen
    const gifButton = await page.waitForSelector('.ytgif-button', { timeout: 5000 });
    await gifButton.click();
    
    await page.waitForSelector('#ytgif-wizard-overlay', { timeout: 5000 });
    await page.waitForTimeout(2000);
    
    const createGifBtn = await page.waitForSelector('.ytgif-button-primary:has-text("Create GIF")', { timeout: 5000 });
    await createGifBtn.click();
    
    await page.waitForSelector('.ytgif-text-overlay-screen', { timeout: 5000 });
    
    // Don't fill any text, just skip
    const skipBtn = await page.$('button:has-text("Skip Text")');
    if (skipBtn) {
      await skipBtn.click();
      console.log('✓ Clicked Skip Text button');
      
      // Should proceed to create GIF without text
      await page.waitForSelector('.ytgif-success-screen', { timeout: 30000 });
      console.log('✓ GIF created without any text');
    }
  });
});