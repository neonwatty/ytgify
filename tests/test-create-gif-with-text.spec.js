const { test, expect, chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

test.describe('Create GIF with Text Overlay E2E', () => {
  let browser;
  let page;
  let context;

  test.beforeAll(async () => {
    const extensionPath = path.join(__dirname, '..', 'dist');
    console.log('Loading extension from:', extensionPath);
    
    // Set up download path
    const downloadPath = path.join(__dirname, 'downloads');
    
    context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--no-sandbox'
      ],
      viewport: { width: 1280, height: 720 },
      acceptDownloads: true,
      downloadsPath: downloadPath
    });
    
    browser = context;
  });

  test.beforeEach(async () => {
    page = await browser.newPage();
    
    // Capture relevant logs
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('GIF') || text.includes('Overlay') || text.includes('Text') || text.includes('Success')) {
        console.log('[Page]', text);
      }
    });
  });

  test.afterEach(async () => {
    await page.close();
  });

  test.afterAll(async () => {
    await browser.close();
  });

  test('should create a GIF with text overlay and download it', async () => {
    console.log('=== Starting GIF creation with text overlay test ===');
    
    // Navigate to YouTube video
    await page.goto('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    await page.waitForSelector('.html5-video-player', { timeout: 10000 });
    console.log('✓ YouTube page loaded');
    
    // Wait for extension to initialize
    await page.waitForTimeout(3000);
    
    // Click GIF button
    const gifButton = await page.waitForSelector('.ytgif-button', { timeout: 5000 });
    await gifButton.click();
    console.log('✓ Clicked GIF button');
    
    // Wait for wizard overlay
    await page.waitForSelector('#ytgif-wizard-overlay', { timeout: 5000 });
    console.log('✓ Wizard overlay appeared');
    
    // Wait for auto-advance from welcome screen
    console.log('⏳ Waiting for welcome screen to auto-advance...');
    await page.waitForTimeout(2000);
    
    // Verify we're on quick capture screen
    await page.waitForSelector('.ytgif-quick-capture-screen', { timeout: 5000 });
    console.log('✓ Quick capture screen visible');
    
    // Click "Create GIF" to go to text overlay screen
    const createGifBtn = await page.waitForSelector('.ytgif-button-primary:has-text("Create GIF")', { timeout: 5000 });
    await createGifBtn.click();
    console.log('✓ Clicked Create GIF button');
    
    // Wait for text overlay screen
    await page.waitForSelector('.ytgif-text-overlay-screen', { timeout: 5000 });
    console.log('✓ Text overlay screen appeared');
    
    // Add text overlay
    const addTextBtn = await page.$('button:has-text("Add Text")');
    if (addTextBtn) {
      await addTextBtn.click();
      console.log('✓ Clicked Add Text button');
      await page.waitForTimeout(500);
    }
    
    // Find and fill text input
    const textInput = await page.$('.text-overlay-input input[type="text"], .text-overlay-editor input[type="text"], textarea');
    if (textInput) {
      await textInput.fill('Hello from Playwright!');
      console.log('✓ Added text: "Hello from Playwright!"');
    }
    
    // Adjust text properties if available
    const fontSizeInput = await page.$('input[type="number"][name*="size"], input[type="range"][name*="size"]');
    if (fontSizeInput) {
      await fontSizeInput.fill('36');
      console.log('✓ Set font size to 36');
    }
    
    // Set text color if available
    const colorInput = await page.$('input[type="color"], input[name*="color"]');
    if (colorInput) {
      await colorInput.fill('#FF0000');
      console.log('✓ Set text color to red');
    }
    
    // Take screenshot of text overlay screen
    await page.screenshot({ path: 'tests/screenshots/text-overlay-configured.png' });
    
    // Click Apply Text button
    const applyBtn = await page.$('button:has-text("Apply Text")');
    if (applyBtn) {
      await applyBtn.click();
      console.log('✓ Clicked Apply Text button');
    } else {
      // Fallback: look for any button that might apply the text
      const primaryBtn = await page.$('.ytgif-button-primary');
      if (primaryBtn) {
        await primaryBtn.click();
        console.log('✓ Clicked primary button to apply text');
      }
    }
    
    // Wait for processing screen
    await page.waitForSelector('.ytgif-processing-screen', { timeout: 10000 });
    console.log('✓ Processing screen appeared');
    
    // Wait for processing to complete (success screen)
    console.log('⏳ Waiting for GIF processing to complete...');
    const successScreen = await page.waitForSelector('.ytgif-success-screen', { 
      timeout: 60000 // Give it up to 60 seconds for processing
    });
    console.log('✓ Success screen appeared - GIF created!');
    
    // Take screenshot of success screen
    await page.screenshot({ path: 'tests/screenshots/gif-success-with-text.png' });
    
    // Set up download promise before clicking download
    const downloadPromise = page.waitForEvent('download');
    
    // Click download button
    const downloadBtn = await page.waitForSelector('button:has-text("Download")', { timeout: 5000 });
    await downloadBtn.click();
    console.log('✓ Clicked Download button');
    
    // Wait for download to complete
    const download = await downloadPromise;
    console.log('✓ Download started');
    
    // Save the downloaded file to our test downloads directory
    const timestamp = Date.now();
    const fileName = `test-gif-with-text-${timestamp}.gif`;
    const savePath = path.join(__dirname, 'downloads', fileName);
    await download.saveAs(savePath);
    console.log(`✓ GIF saved to: ${savePath}`);
    
    // Verify the file exists and has content
    const fileExists = fs.existsSync(savePath);
    expect(fileExists).toBeTruthy();
    
    const stats = fs.statSync(savePath);
    console.log(`✓ GIF file size: ${(stats.size / 1024).toFixed(2)} KB`);
    expect(stats.size).toBeGreaterThan(0);
    
    // Also try to click "Save to Library" if available
    const saveToLibraryBtn = await page.$('button:has-text("Save to Library")');
    if (saveToLibraryBtn) {
      await saveToLibraryBtn.click();
      console.log('✓ Clicked Save to Library button');
      await page.waitForTimeout(1000);
    }
    
    console.log('=== Test completed successfully! ===');
  });

  test('should create GIF with multiple text overlays', async () => {
    console.log('=== Starting multiple text overlays test ===');
    
    // Navigate to YouTube video
    await page.goto('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    await page.waitForSelector('.html5-video-player', { timeout: 10000 });
    await page.waitForTimeout(3000);
    
    // Click GIF button
    const gifButton = await page.waitForSelector('.ytgif-button', { timeout: 5000 });
    await gifButton.click();
    
    // Wait for wizard and auto-advance
    await page.waitForSelector('#ytgif-wizard-overlay', { timeout: 5000 });
    await page.waitForTimeout(2000);
    
    // Go to text overlay screen
    await page.waitForSelector('.ytgif-quick-capture-screen', { timeout: 5000 });
    const createGifBtn = await page.waitForSelector('.ytgif-button-primary:has-text("Create GIF")', { timeout: 5000 });
    await createGifBtn.click();
    
    // Wait for text overlay screen
    await page.waitForSelector('.ytgif-text-overlay-screen', { timeout: 5000 });
    console.log('✓ On text overlay screen');
    
    // Add first text overlay
    let addTextBtn = await page.$('button:has-text("Add Text")');
    if (addTextBtn) {
      await addTextBtn.click();
      await page.waitForTimeout(500);
      
      const textInput = await page.$('input[type="text"], textarea');
      if (textInput) {
        await textInput.fill('Top Text');
        console.log('✓ Added first text: "Top Text"');
      }
    }
    
    // Try to add second text overlay
    addTextBtn = await page.$('button:has-text("Add Text")');
    if (addTextBtn) {
      await addTextBtn.click();
      await page.waitForTimeout(500);
      
      // Find the second text input (might be in a list)
      const textInputs = await page.$$('input[type="text"], textarea');
      if (textInputs.length > 1) {
        await textInputs[1].fill('Bottom Text');
        console.log('✓ Added second text: "Bottom Text"');
      }
    }
    
    // Apply text and process
    const applyBtn = await page.$('button:has-text("Apply Text")');
    if (applyBtn) {
      await applyBtn.click();
    } else {
      const primaryBtn = await page.$('.ytgif-button-primary');
      if (primaryBtn) await primaryBtn.click();
    }
    
    // Wait for processing
    await page.waitForSelector('.ytgif-processing-screen', { timeout: 10000 });
    console.log('✓ Processing GIF with multiple text overlays');
    
    // Wait for success
    await page.waitForSelector('.ytgif-success-screen', { timeout: 60000 });
    console.log('✓ GIF with multiple texts created successfully');
    
    // Download the GIF
    const downloadPromise = page.waitForEvent('download');
    const downloadBtn = await page.waitForSelector('button:has-text("Download")', { timeout: 5000 });
    await downloadBtn.click();
    
    const download = await downloadPromise;
    const fileName = `test-gif-multiple-text-${Date.now()}.gif`;
    const savePath = path.join(__dirname, 'downloads', fileName);
    await download.saveAs(savePath);
    console.log(`✓ Multi-text GIF saved to: ${savePath}`);
    
    // Verify file
    expect(fs.existsSync(savePath)).toBeTruthy();
    const stats = fs.statSync(savePath);
    expect(stats.size).toBeGreaterThan(0);
    console.log(`✓ Multi-text GIF size: ${(stats.size / 1024).toFixed(2)} KB`);
  });

  test('should skip text overlay and still download GIF', async () => {
    console.log('=== Testing GIF creation without text ===');
    
    // Navigate to YouTube
    await page.goto('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    await page.waitForSelector('.html5-video-player', { timeout: 10000 });
    await page.waitForTimeout(3000);
    
    // Open wizard
    const gifButton = await page.waitForSelector('.ytgif-button', { timeout: 5000 });
    await gifButton.click();
    await page.waitForSelector('#ytgif-wizard-overlay', { timeout: 5000 });
    await page.waitForTimeout(2000);
    
    // Go to text overlay screen
    await page.waitForSelector('.ytgif-quick-capture-screen', { timeout: 5000 });
    const createGifBtn = await page.waitForSelector('.ytgif-button-primary:has-text("Create GIF")', { timeout: 5000 });
    await createGifBtn.click();
    await page.waitForSelector('.ytgif-text-overlay-screen', { timeout: 5000 });
    
    // Skip text overlay
    const skipBtn = await page.waitForSelector('button:has-text("Skip Text")', { timeout: 5000 });
    await skipBtn.click();
    console.log('✓ Skipped text overlay');
    
    // Wait for processing
    await page.waitForSelector('.ytgif-processing-screen', { timeout: 10000 });
    console.log('✓ Processing GIF without text');
    
    // Wait for success
    await page.waitForSelector('.ytgif-success-screen', { timeout: 60000 });
    console.log('✓ GIF created successfully');
    
    // Download
    const downloadPromise = page.waitForEvent('download');
    const downloadBtn = await page.waitForSelector('button:has-text("Download")', { timeout: 5000 });
    await downloadBtn.click();
    
    const download = await downloadPromise;
    const fileName = `test-gif-no-text-${Date.now()}.gif`;
    const savePath = path.join(__dirname, 'downloads', fileName);
    await download.saveAs(savePath);
    console.log(`✓ GIF without text saved to: ${savePath}`);
    
    // Verify
    expect(fs.existsSync(savePath)).toBeTruthy();
    const stats = fs.statSync(savePath);
    expect(stats.size).toBeGreaterThan(0);
    console.log(`✓ GIF size: ${(stats.size / 1024).toFixed(2)} KB`);
  });
});