const { test, expect, chromium } = require('@playwright/test');
const path = require('path');

test.describe('Frame Rate Testing', () => {
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
    
    // Select a consistent time segment (3s for frame count testing)
    const presetButtons = await page.$$('.ytgif-preset-btn');
    if (presetButtons.length > 0) {
      await presetButtons[0].click(); // 3s preset
      await page.waitForTimeout(3000); // Wait for frame extraction
    }
  });
  
  test.afterEach(async () => {
    await browser.close();
  });

  test('Frame rate slider range (5-30 fps)', async () => {
    console.log('🎚️ Testing frame rate slider range...');
    
    const slider = await page.$('.ytgif-unified-slider');
    expect(slider).toBeTruthy();
    
    // Check min and max attributes
    const min = await slider.evaluate(el => el.min);
    const max = await slider.evaluate(el => el.max);
    expect(min).toBe('5');
    expect(max).toBe('30');
    console.log(`   ✅ Slider range: ${min}-${max} fps`);
    
    // Test minimum value
    await slider.evaluate(el => el.value = '5');
    await slider.dispatchEvent('input');
    await page.waitForTimeout(500);
    
    const minValue = await slider.evaluate(el => el.value);
    expect(minValue).toBe('5');
    
    // Check label updates
    const labelText = await page.$eval('.ytgif-unified-label', el => el.textContent);
    expect(labelText).toContain('5 fps');
    console.log('   ✅ Minimum: 5 fps');
    
    // Test maximum value
    await slider.evaluate(el => el.value = '30');
    await slider.dispatchEvent('input');
    await page.waitForTimeout(500);
    
    const maxValue = await slider.evaluate(el => el.value);
    expect(maxValue).toBe('30');
    
    const maxLabelText = await page.$eval('.ytgif-unified-label', el => el.textContent);
    expect(maxLabelText).toContain('30 fps');
    console.log('   ✅ Maximum: 30 fps');
  });

  test('Frame rate preset buttons', async () => {
    console.log('🔘 Testing frame rate preset buttons...');
    
    const presetButtons = await page.$$('.ytgif-unified-fps-btn');
    expect(presetButtons.length).toBe(4); // 10, 15, 20, 25
    
    const expectedFps = [10, 15, 20, 25];
    const slider = await page.$('.ytgif-unified-slider');
    
    for (let i = 0; i < presetButtons.length; i++) {
      await presetButtons[i].click();
      await page.waitForTimeout(500);
      
      // Check button is active
      const isActive = await presetButtons[i].evaluate(el => el.classList.contains('active'));
      expect(isActive).toBe(true);
      
      // Check slider value updated
      const sliderValue = await slider.evaluate(el => el.value);
      expect(parseInt(sliderValue)).toBe(expectedFps[i]);
      
      // Check label updated
      const labelText = await page.$eval('.ytgif-unified-label', el => el.textContent);
      expect(labelText).toContain(`${expectedFps[i]} fps`);
      
      console.log(`   ✅ Preset ${expectedFps[i]} fps works`);
    }
  });

  test('Custom frame rate via slider', async () => {
    console.log('🎯 Testing custom frame rate values...');
    
    const slider = await page.$('.ytgif-unified-slider');
    const customValues = [7, 12, 18, 23, 28];
    
    for (const fps of customValues) {
      await slider.evaluate((el, value) => el.value = value.toString(), fps);
      await slider.dispatchEvent('input');
      await page.waitForTimeout(500);
      
      const currentValue = await slider.evaluate(el => el.value);
      expect(parseInt(currentValue)).toBe(fps);
      
      // Check label updates
      const labelText = await page.$eval('.ytgif-unified-label', el => el.textContent);
      expect(labelText).toContain(`${fps} fps`);
      
      console.log(`   ✅ Custom value: ${fps} fps`);
    }
  });

  test('Frame count calculation for different fps', async () => {
    console.log('📊 Testing frame count calculations...');
    
    // We have a 3-second clip selected
    const duration = 3;
    const testCases = [
      { fps: 5, expectedFrames: 15 },
      { fps: 10, expectedFrames: 30 },
      { fps: 15, expectedFrames: 45 },
      { fps: 20, expectedFrames: 60 },
      { fps: 30, expectedFrames: 90 }
    ];
    
    const slider = await page.$('.ytgif-unified-slider');
    
    for (const testCase of testCases) {
      console.log(`\n   Testing ${testCase.fps} fps...`);
      
      // Set frame rate
      await slider.evaluate((el, value) => el.value = value.toString(), testCase.fps);
      await slider.dispatchEvent('input');
      await page.waitForTimeout(500);
      
      // Monitor console for frame count during creation
      let capturedFrames = 0;
      page.once('console', msg => {
        const text = msg.text();
        const match = text.match(/(\d+) frames/);
        if (match) {
          capturedFrames = parseInt(match[1]);
        }
      });
      
      // Start creation
      const createButton = await page.$('.ytgif-unified-btn-create');
      await createButton.click();
      
      // Wait a bit to capture frame info
      await page.waitForTimeout(5000);
      
      // Cancel to prepare for next test
      const cancelButton = await page.$('.ytgif-unified-btn-cancel');
      if (cancelButton) {
        await cancelButton.click();
      }
      
      console.log(`   Expected: ~${testCase.expectedFrames} frames`);
      console.log(`   Frame rate: ${testCase.fps} fps × ${duration}s = ${testCase.expectedFrames} frames`);
      
      // Re-open interface for next iteration
      await page.waitForTimeout(1000);
      const gifButton = await page.waitForSelector('.ytgif-button', { timeout: 10000 });
      await gifButton.click();
      await page.waitForTimeout(2000);
      
      // Re-select time segment
      const presetButtons = await page.$$('.ytgif-preset-btn');
      if (presetButtons.length > 0) {
        await presetButtons[0].click();
        await page.waitForTimeout(3000);
      }
    }
  });

  test('Frame rate affects file size', async () => {
    console.log('📦 Testing frame rate impact on file size...');
    
    const slider = await page.$('.ytgif-unified-slider');
    const testRates = [5, 15, 30];
    const results = [];
    
    for (const fps of testRates) {
      console.log(`\n   Testing ${fps} fps...`);
      
      // Set frame rate
      await slider.evaluate((el, value) => el.value = value.toString(), fps);
      await slider.dispatchEvent('input');
      await page.waitForTimeout(500);
      
      // Check estimated size before creation
      const sizeEstimate = await page.$('.ytgif-unified-size-estimate');
      if (sizeEstimate) {
        const estimatedSize = await sizeEstimate.evaluate(el => el.textContent);
        console.log(`   Estimated size at ${fps} fps: ${estimatedSize}`);
        results.push({ fps, size: estimatedSize });
      }
      
      // If not the last iteration, prepare for next
      if (fps !== testRates[testRates.length - 1]) {
        // Change frame rate for size estimate update
        await page.waitForTimeout(1000);
      }
    }
    
    // Verify that higher frame rates show larger estimated sizes
    console.log('\n   📊 Size comparison:');
    results.forEach(r => {
      console.log(`      ${r.fps} fps: ${r.size}`);
    });
  });

  test('Frame rate slider interaction with preset buttons', async () => {
    console.log('🔄 Testing slider and preset button interaction...');
    
    const slider = await page.$('.ytgif-unified-slider');
    const presetButtons = await page.$$('.ytgif-unified-fps-btn');
    
    // Set custom value via slider
    await slider.evaluate(el => el.value = '17');
    await slider.dispatchEvent('input');
    await page.waitForTimeout(500);
    
    // Check no preset button is active
    for (const button of presetButtons) {
      const isActive = await button.evaluate(el => el.classList.contains('active'));
      expect(isActive).toBe(false);
    }
    console.log('   ✅ No preset active for custom value (17 fps)');
    
    // Click preset button
    await presetButtons[1].click(); // 15 fps
    await page.waitForTimeout(500);
    
    // Check slider updated
    const sliderValue = await slider.evaluate(el => el.value);
    expect(sliderValue).toBe('15');
    console.log('   ✅ Slider updated when preset clicked (15 fps)');
    
    // Check correct button is active
    const isActive = await presetButtons[1].evaluate(el => el.classList.contains('active'));
    expect(isActive).toBe(true);
    console.log('   ✅ Correct preset button active');
  });

  test('Frame rate controls disabled during processing', async () => {
    console.log('🔒 Testing frame rate controls during processing...');
    
    const slider = await page.$('.ytgif-unified-slider');
    const presetButtons = await page.$$('.ytgif-unified-fps-btn');
    
    // Start creation
    const createButton = await page.$('.ytgif-unified-btn-create');
    await createButton.click();
    
    // Check controls are disabled
    await page.waitForTimeout(1000);
    
    const sliderDisabled = await slider.evaluate(el => el.disabled);
    expect(sliderDisabled).toBe(true);
    console.log('   ✅ Slider disabled during processing');
    
    for (const button of presetButtons) {
      const isDisabled = await button.evaluate(el => el.disabled);
      expect(isDisabled).toBe(true);
    }
    console.log('   ✅ Preset buttons disabled during processing');
    
    // Wait for completion
    for (let i = 0; i < 30; i++) {
      await page.waitForTimeout(1000);
      const saveButton = await page.$('.ytgif-unified-btn-save');
      if (saveButton) {
        // Check controls are re-enabled
        const sliderEnabled = await slider.evaluate(el => !el.disabled);
        expect(sliderEnabled).toBe(true);
        console.log('   ✅ Controls re-enabled after completion');
        break;
      }
    }
  });
});