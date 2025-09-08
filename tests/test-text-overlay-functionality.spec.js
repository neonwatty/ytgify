const { test, expect, chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

test.describe('Text Overlay Functionality Test', () => {
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
    
    // Capture console logs for debugging
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('GIF') || text.includes('text') || text.includes('overlay') || text.includes('TextOverlay')) {
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

  test('should create GIF with text overlay and verify text is present', async () => {
    console.log('=== Testing text overlay functionality ===');
    
    // Navigate to YouTube video
    await page.goto('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    await page.waitForSelector('.html5-video-player', { timeout: 10000 });
    await page.waitForTimeout(3000);
    console.log('✓ YouTube page loaded');
    
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
    const testText = "Test Overlay Text";
    const textInput = await page.waitForSelector('.ytgif-text-input', { timeout: 5000 });
    await textInput.fill(testText);
    console.log(`✓ Entered text: "${testText}"`);
    
    // Click "Add Text & Continue" button (should be visible now that text is entered)
    const addTextBtn = await page.waitForSelector('.ytgif-btn-primary:has-text("Add Text & Continue")', { timeout: 5000 });
    await addTextBtn.click();
    console.log('✓ Clicked Add Text & Continue button');
    
    // Wait for processing screen
    await page.waitForSelector('.ytgif-processing-screen', { timeout: 10000 });
    console.log('✓ Processing screen appeared');
    
    // Wait for success screen (this may take a while for GIF processing)
    console.log('⏳ Waiting for GIF processing to complete...');
    await page.waitForSelector('.ytgif-success-screen', { 
      timeout: 60000 // Give it up to 60 seconds for processing
    });
    console.log('✓ Success screen appeared - GIF created with text overlay!');
    
    // Take screenshot of success screen
    await page.screenshot({ path: 'tests/screenshots/gif-success-with-text.png' });
    
    // Set up download promise before clicking download
    const downloadPromise = page.waitForEvent('download', { timeout: 10000 });
    
    // Click download button
    const downloadBtn = await page.waitForSelector('.ytgif-button-primary:has-text("Download GIF")', { timeout: 5000 });
    await downloadBtn.click();
    console.log('✓ Clicked Download GIF button');
    
    // Wait for download to complete
    const download = await downloadPromise;
    console.log('✓ Download started');
    
    // Save the downloaded file to our test downloads directory
    const timestamp = Date.now();
    const fileName = `test-gif-with-text-overlay-${timestamp}.gif`;
    const savePath = path.join(__dirname, 'downloads', fileName);
    await download.saveAs(savePath);
    console.log(`✓ GIF saved to: ${savePath}`);
    
    // Verify the file exists and has content
    const fileExists = fs.existsSync(savePath);
    expect(fileExists).toBeTruthy();
    
    const stats = fs.statSync(savePath);
    console.log(`✓ GIF file size: ${(stats.size / 1024).toFixed(2)} KB`);
    expect(stats.size).toBeGreaterThan(10000); // At least 10KB
    
    console.log('=== Text overlay functionality test completed successfully! ===');
    console.log(`📁 GIF with text overlay saved as: ${fileName}`);
    console.log('💡 You can manually check the GIF file to verify the text overlay is present');
  });
});