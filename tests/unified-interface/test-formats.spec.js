const { test, expect, chromium } = require('@playwright/test');
const path = require('path');

test.describe('Format Testing - GIF Creation', () => {
  let browser;
  let page;
  const extensionPath = path.join(__dirname, '..', '..', 'dist');
  
  test.beforeEach(async () => {
    browser = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--no-sandbox',
        '--disable-dev-shm-usage',
      ],
      viewport: { width: 1280, height: 720 }
    });
    
    page = await browser.newPage();
    
    // Navigate to YouTube and open unified interface
    await page.goto('https://www.youtube.com/watch?v=dQw4w9WgXcQ', { 
      waitUntil: 'networkidle' 
    });
    await page.waitForSelector('#movie_player', { timeout: 15000 });
    await page.waitForTimeout(2000);
    
    const gifButton = await page.waitForSelector('.ytgif-button', { timeout: 10000 });
    await gifButton.click();
    await page.waitForTimeout(2000);
    
    // Select a time segment
    const presetButtons = await page.$$('.ytgif-preset-btn');
    if (presetButtons.length > 0) {
      await presetButtons[0].click(); // 3s preset
      await page.waitForTimeout(3000); // Wait for frame extraction
    }
  });
  
  test.afterEach(async () => {
    await browser.close();
  });

  test('GIF format creation with default settings', async () => {
    console.log('📸 Testing GIF format creation...');
    
    // No format buttons exist anymore since only GIF is supported
    const formatButtons = await page.$$('.ytgif-unified-format-btn');
    expect(formatButtons.length).toBe(0);
    
    // Initially, only Create GIF button should exist
    const createButton = await page.$('.ytgif-unified-btn-create');
    expect(createButton).toBeTruthy();
    console.log('   ✅ Create GIF button available');
    
    // Verify loop checkbox is enabled
    const loopCheckbox = await page.$('.ytgif-unified-checkbox');
    const isDisabled = await loopCheckbox.evaluate(el => el.disabled);
    expect(isDisabled).toBe(false);
    
    // Create GIF
    await createButton.click();
    
    // Monitor progress and wait for completion
    let progressDetected = false;
    let completed = false;
    
    for (let i = 0; i < 30; i++) {
      await page.waitForTimeout(1000);
      
      const progressBar = await page.$('.ytgif-unified-progress-fill');
      if (progressBar) {
        progressDetected = true;
        const width = await progressBar.evaluate(el => el.style.width);
        if (width && width !== '0%') {
          console.log(`   Progress: ${width}`);
        }
      }
      
      // Check if creation completed - Export button should appear
      const exportButton = await page.$('.ytgif-unified-btn-export');
      const saveButton = await page.$('.ytgif-unified-btn-save');
      
      if (exportButton && saveButton) {
        completed = true;
        const exportText = await exportButton.evaluate(el => el.textContent);
        expect(exportText).toContain('GIF');
        console.log('   ✅ GIF created successfully - Export and Save buttons available');
        break;
      }
    }
    
    expect(progressDetected).toBe(true);
    expect(completed).toBe(true);
  });

  test('Loop checkbox functionality', async () => {
    console.log('🔁 Testing loop checkbox...');
    
    const loopCheckbox = await page.$('.ytgif-unified-checkbox');
    expect(loopCheckbox).toBeTruthy();
    
    // Check initial state (should be checked)
    const initialChecked = await loopCheckbox.evaluate(el => el.checked);
    console.log(`   Initial loop state: ${initialChecked ? 'ON' : 'OFF'}`);
    expect(initialChecked).toBe(true);
    
    // Toggle off
    await loopCheckbox.click();
    await page.waitForTimeout(500);
    const afterToggle = await loopCheckbox.evaluate(el => el.checked);
    expect(afterToggle).toBe(false);
    console.log('   ✅ Loop toggled OFF');
    
    // Toggle back on
    await loopCheckbox.click();
    await page.waitForTimeout(500);
    const finalState = await loopCheckbox.evaluate(el => el.checked);
    expect(finalState).toBe(true);
    console.log('   ✅ Loop toggled ON');
  });

  test('Quality settings affect file size estimate', async () => {
    console.log('📊 Testing quality settings...');
    
    const qualityButtons = await page.$$('.ytgif-unified-quality-btn');
    expect(qualityButtons.length).toBe(3); // Low, Medium, High
    
    // Get initial file size estimate
    const getEstimatedSize = async () => {
      const sizeText = await page.$eval('.ytgif-unified-size-estimate', el => el.textContent);
      return sizeText;
    };
    
    // Test Low quality
    await qualityButtons[0].click();
    await page.waitForTimeout(500);
    const lowSize = await getEstimatedSize();
    console.log(`   Low quality: ${lowSize}`);
    
    // Test High quality
    await qualityButtons[2].click();
    await page.waitForTimeout(500);
    const highSize = await getEstimatedSize();
    console.log(`   High quality: ${highSize}`);
    
    // High quality should have larger estimated size
    expect(highSize).not.toBe(lowSize);
    console.log('   ✅ Quality affects file size estimate');
  });

});