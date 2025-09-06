const { test, expect, chromium } = require('@playwright/test');
const path = require('path');

test.describe('Quality Settings Testing', () => {
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
    
    // Set up console logging to capture file sizes
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('GIF created') || text.includes('size')) {
        console.log(`   📊 ${text}`);
      }
    });
    
    // Navigate to YouTube and open unified interface
    await page.goto('https://www.youtube.com/watch?v=dQw4w9WgXcQ', { 
      waitUntil: 'networkidle' 
    });
    await page.waitForSelector('#movie_player', { timeout: 15000 });
    await page.waitForTimeout(2000);
    
    const gifButton = await page.waitForSelector('.ytgif-button', { timeout: 10000 });
    await gifButton.click();
    await page.waitForTimeout(2000);
    
    // Select a consistent time segment
    const presetButtons = await page.$$('.ytgif-preset-btn');
    if (presetButtons.length > 0) {
      await presetButtons[0].click(); // 3s preset
      await page.waitForTimeout(3000); // Wait for frame extraction
    }
  });
  
  test.afterEach(async () => {
    await browser.close();
  });

  test('Low quality setting', async () => {
    console.log('📉 Testing Low quality setting...');
    
    // Select Low quality
    const qualityButtons = await page.$$('.ytgif-unified-quality-btn');
    expect(qualityButtons.length).toBe(3);
    
    await qualityButtons[0].click(); // Low
    await page.waitForTimeout(500);
    
    // Verify Low is selected
    const isActive = await qualityButtons[0].evaluate(el => el.classList.contains('active'));
    expect(isActive).toBe(true);
    console.log('   ✅ Low quality selected');
    
    // Create GIF and measure time
    const startTime = Date.now();
    const createButton = await page.$('.ytgif-unified-btn-create');
    await createButton.click();
    
    // Wait for completion
    let completed = false;
    for (let i = 0; i < 30; i++) {
      await page.waitForTimeout(1000);
      const saveButton = await page.$('.ytgif-unified-btn-save');
      if (saveButton) {
        completed = true;
        break;
      }
    }
    
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    
    expect(completed).toBe(true);
    console.log(`   ✅ Low quality GIF created in ${duration.toFixed(1)}s`);
    
    // Check file size estimate
    const sizeEstimate = await page.$('.ytgif-unified-size-estimate');
    if (sizeEstimate) {
      const size = await sizeEstimate.evaluate(el => el.textContent);
      console.log(`   📦 Estimated size: ${size}`);
    }
  });

  test('Medium quality setting', async () => {
    console.log('📊 Testing Medium quality setting...');
    
    // Select Medium quality
    const qualityButtons = await page.$$('.ytgif-unified-quality-btn');
    await qualityButtons[1].click(); // Medium
    await page.waitForTimeout(500);
    
    // Verify Medium is selected
    const isActive = await qualityButtons[1].evaluate(el => el.classList.contains('active'));
    expect(isActive).toBe(true);
    console.log('   ✅ Medium quality selected');
    
    // Create GIF and measure time
    const startTime = Date.now();
    const createButton = await page.$('.ytgif-unified-btn-create');
    await createButton.click();
    
    // Wait for completion
    let completed = false;
    for (let i = 0; i < 30; i++) {
      await page.waitForTimeout(1000);
      const saveButton = await page.$('.ytgif-unified-btn-save');
      if (saveButton) {
        completed = true;
        break;
      }
    }
    
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    
    expect(completed).toBe(true);
    console.log(`   ✅ Medium quality GIF created in ${duration.toFixed(1)}s`);
    
    // Check file size estimate
    const sizeEstimate = await page.$('.ytgif-unified-size-estimate');
    if (sizeEstimate) {
      const size = await sizeEstimate.evaluate(el => el.textContent);
      console.log(`   📦 Estimated size: ${size}`);
    }
  });

  test('High quality setting', async () => {
    console.log('📈 Testing High quality setting...');
    
    // Select High quality
    const qualityButtons = await page.$$('.ytgif-unified-quality-btn');
    await qualityButtons[2].click(); // High
    await page.waitForTimeout(500);
    
    // Verify High is selected
    const isActive = await qualityButtons[2].evaluate(el => el.classList.contains('active'));
    expect(isActive).toBe(true);
    console.log('   ✅ High quality selected');
    
    // Create GIF and measure time
    const startTime = Date.now();
    const createButton = await page.$('.ytgif-unified-btn-create');
    await createButton.click();
    
    // Wait for completion (may take longer)
    let completed = false;
    for (let i = 0; i < 45; i++) {
      await page.waitForTimeout(1000);
      const saveButton = await page.$('.ytgif-unified-btn-save');
      if (saveButton) {
        completed = true;
        break;
      }
    }
    
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    
    expect(completed).toBe(true);
    console.log(`   ✅ High quality GIF created in ${duration.toFixed(1)}s`);
    
    // Check file size estimate
    const sizeEstimate = await page.$('.ytgif-unified-size-estimate');
    if (sizeEstimate) {
      const size = await sizeEstimate.evaluate(el => el.textContent);
      console.log(`   📦 Estimated size: ${size}`);
    }
  });


  test('Quality button states during processing', async () => {
    console.log('🔒 Testing quality button states during processing...');
    
    const qualityButtons = await page.$$('.ytgif-unified-quality-btn');
    
    // Start creation
    const createButton = await page.$('.ytgif-unified-btn-create');
    await createButton.click();
    
    // Check buttons are disabled during processing
    await page.waitForTimeout(1000);
    
    for (let i = 0; i < qualityButtons.length; i++) {
      const isDisabled = await qualityButtons[i].evaluate(el => el.disabled);
      expect(isDisabled).toBe(true);
    }
    console.log('   ✅ Quality buttons disabled during processing');
    
    // Wait for completion
    for (let i = 0; i < 30; i++) {
      await page.waitForTimeout(1000);
      const saveButton = await page.$('.ytgif-unified-btn-save');
      if (saveButton) {
        // Check buttons are enabled after completion
        for (let j = 0; j < qualityButtons.length; j++) {
          const isDisabled = await qualityButtons[j].evaluate(el => el.disabled);
          expect(isDisabled).toBe(false);
        }
        console.log('   ✅ Quality buttons enabled after completion');
        break;
      }
    }
  });
});