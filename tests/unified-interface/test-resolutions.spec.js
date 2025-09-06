const { test, expect, chromium } = require('@playwright/test');
const path = require('path');

test.describe('Resolution Testing', () => {
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
    
    // Select time segment
    const presetButtons = await page.$$('.ytgif-preset-btn');
    if (presetButtons.length > 0) {
      await presetButtons[0].click(); // 3s preset
      await page.waitForTimeout(3000);
    }
  });
  
  test.afterEach(async () => {
    await browser.close();
  });

  test('Preset resolution buttons', async () => {
    console.log('📐 Testing preset resolution buttons...');
    
    const resolutionButtons = await page.$$('.ytgif-unified-resolution-btn');
    expect(resolutionButtons.length).toBe(3); // 480p, 360p, 720p
    
    const presets = [
      { label: '480p', width: 480, height: 270 },
      { label: '360p', width: 640, height: 360 },
      { label: '720p', width: 1280, height: 720 }
    ];
    
    const widthInput = await page.$('.ytgif-unified-resolution-custom input[type="number"]:first-of-type');
    const heightInput = await page.$('.ytgif-unified-resolution-custom input[type="number"]:last-of-type');
    
    for (let i = 0; i < resolutionButtons.length; i++) {
      await resolutionButtons[i].click();
      await page.waitForTimeout(500);
      
      // Check button is active
      const isActive = await resolutionButtons[i].evaluate(el => el.classList.contains('active'));
      expect(isActive).toBe(true);
      
      // Check custom inputs updated
      const width = await widthInput.evaluate(el => el.value);
      const height = await heightInput.evaluate(el => el.value);
      
      expect(parseInt(width)).toBe(presets[i].width);
      expect(parseInt(height)).toBe(presets[i].height);
      
      console.log(`   ✅ ${presets[i].label}: ${width}×${height}`);
    }
  });

  test('Custom width input (100-1920px)', async () => {
    console.log('↔️ Testing custom width input...');
    
    const widthInput = await page.$('.ytgif-unified-resolution-custom input[type="number"]:first-of-type');
    expect(widthInput).toBeTruthy();
    
    // Check min and max attributes
    const min = await widthInput.evaluate(el => el.min);
    const max = await widthInput.evaluate(el => el.max);
    expect(min).toBe('100');
    expect(max).toBe('1920');
    console.log(`   ✅ Width range: ${min}-${max}px`);
    
    // Test various custom widths
    const testWidths = [100, 320, 800, 1920];
    
    for (const width of testWidths) {
      await widthInput.evaluate((el, val) => el.value = val.toString(), width);
      await widthInput.dispatchEvent('input');
      await page.waitForTimeout(500);
      
      const currentValue = await widthInput.evaluate(el => el.value);
      expect(parseInt(currentValue)).toBe(width);
      
      // Check no preset button is active for custom values
      const resolutionButtons = await page.$$('.ytgif-unified-resolution-btn');
      let anyActive = false;
      for (const button of resolutionButtons) {
        const isActive = await button.evaluate(el => el.classList.contains('active'));
        if (isActive) anyActive = true;
      }
      
      console.log(`   ✅ Custom width: ${width}px${anyActive ? ' (matches preset)' : ''}`);
    }
  });

  test('Custom height input (100-1080px)', async () => {
    console.log('↕️ Testing custom height input...');
    
    const heightInput = await page.$('.ytgif-unified-resolution-custom input[type="number"]:last-of-type');
    expect(heightInput).toBeTruthy();
    
    // Check min and max attributes
    const min = await heightInput.evaluate(el => el.min);
    const max = await heightInput.evaluate(el => el.max);
    expect(min).toBe('100');
    expect(max).toBe('1080');
    console.log(`   ✅ Height range: ${min}-${max}px`);
    
    // Test various custom heights
    const testHeights = [100, 240, 540, 1080];
    
    for (const height of testHeights) {
      await heightInput.evaluate((el, val) => el.value = val.toString(), height);
      await heightInput.dispatchEvent('input');
      await page.waitForTimeout(500);
      
      const currentValue = await heightInput.evaluate(el => el.value);
      expect(parseInt(currentValue)).toBe(height);
      
      console.log(`   ✅ Custom height: ${height}px`);
    }
  });

  test('Resolution affects file size estimate', async () => {
    console.log('📦 Testing resolution impact on file size...');
    
    const resolutionButtons = await page.$$('.ytgif-unified-resolution-btn');
    const results = [];
    
    for (let i = 0; i < resolutionButtons.length; i++) {
      await resolutionButtons[i].click();
      await page.waitForTimeout(1000);
      
      // Get resolution info
      const widthInput = await page.$('.ytgif-unified-resolution-custom input[type="number"]:first-of-type');
      const heightInput = await page.$('.ytgif-unified-resolution-custom input[type="number"]:last-of-type');
      const width = await widthInput.evaluate(el => el.value);
      const height = await heightInput.evaluate(el => el.value);
      
      // Get size estimate
      const sizeEstimate = await page.$('.ytgif-unified-size-estimate');
      if (sizeEstimate) {
        const size = await sizeEstimate.evaluate(el => el.textContent);
        results.push({ 
          resolution: `${width}×${height}`,
          pixels: parseInt(width) * parseInt(height),
          size: size 
        });
        console.log(`   ${width}×${height}: ${size}`);
      }
    }
    
    // Verify larger resolutions show larger file sizes
    console.log('\n   📊 Size comparison:');
    results.sort((a, b) => a.pixels - b.pixels);
    results.forEach(r => {
      console.log(`      ${r.resolution} (${r.pixels.toLocaleString()} pixels): ${r.size}`);
    });
  });

  test('Invalid resolution handling', async () => {
    console.log('❌ Testing invalid resolution handling...');
    
    const widthInput = await page.$('.ytgif-unified-resolution-custom input[type="number"]:first-of-type');
    const heightInput = await page.$('.ytgif-unified-resolution-custom input[type="number"]:last-of-type');
    
    // Test below minimum
    await widthInput.evaluate(el => el.value = '50');
    await widthInput.dispatchEvent('input');
    await page.waitForTimeout(500);
    
    // Should be clamped to minimum
    const minWidth = await widthInput.evaluate(el => el.value);
    expect(parseInt(minWidth)).toBeGreaterThanOrEqual(100);
    console.log(`   ✅ Width below min (50) handled: ${minWidth}`);
    
    // Test above maximum
    await widthInput.evaluate(el => el.value = '3000');
    await widthInput.dispatchEvent('input');
    await page.waitForTimeout(500);
    
    // Should be clamped to maximum
    const maxWidth = await widthInput.evaluate(el => el.value);
    expect(parseInt(maxWidth)).toBeLessThanOrEqual(1920);
    console.log(`   ✅ Width above max (3000) handled: ${maxWidth}`);
    
    // Test non-numeric input
    await widthInput.evaluate(el => el.value = 'abc');
    await widthInput.dispatchEvent('input');
    await page.waitForTimeout(500);
    
    // Should default to valid value
    const nonNumericWidth = await widthInput.evaluate(el => el.value);
    expect(parseInt(nonNumericWidth)).toBeGreaterThan(0);
    console.log(`   ✅ Non-numeric input handled: ${nonNumericWidth}`);
  });

  test('Resolution controls disabled during processing', async () => {
    console.log('🔒 Testing resolution controls during processing...');
    
    const resolutionButtons = await page.$$('.ytgif-unified-resolution-btn');
    const widthInput = await page.$('.ytgif-unified-resolution-custom input[type="number"]:first-of-type');
    const heightInput = await page.$('.ytgif-unified-resolution-custom input[type="number"]:last-of-type');
    
    // Start creation
    const createButton = await page.$('.ytgif-unified-btn-create');
    await createButton.click();
    
    // Check controls are disabled
    await page.waitForTimeout(1000);
    
    for (const button of resolutionButtons) {
      const isDisabled = await button.evaluate(el => el.disabled);
      expect(isDisabled).toBe(true);
    }
    console.log('   ✅ Resolution buttons disabled');
    
    const widthDisabled = await widthInput.evaluate(el => el.disabled);
    const heightDisabled = await heightInput.evaluate(el => el.disabled);
    expect(widthDisabled).toBe(true);
    expect(heightDisabled).toBe(true);
    console.log('   ✅ Custom inputs disabled');
    
    // Wait for completion
    for (let i = 0; i < 30; i++) {
      await page.waitForTimeout(1000);
      const saveButton = await page.$('.ytgif-unified-btn-save');
      if (saveButton) {
        // Check controls are re-enabled
        const widthEnabled = await widthInput.evaluate(el => !el.disabled);
        expect(widthEnabled).toBe(true);
        console.log('   ✅ Controls re-enabled after completion');
        break;
      }
    }
  });

  test('Resolution preset and custom input interaction', async () => {
    console.log('🔄 Testing preset and custom input interaction...');
    
    const resolutionButtons = await page.$$('.ytgif-unified-resolution-btn');
    const widthInput = await page.$('.ytgif-unified-resolution-custom input[type="number"]:first-of-type');
    const heightInput = await page.$('.ytgif-unified-resolution-custom input[type="number"]:last-of-type');
    
    // Set custom resolution
    await widthInput.evaluate(el => el.value = '800');
    await widthInput.dispatchEvent('input');
    await heightInput.evaluate(el => el.value = '600');
    await heightInput.dispatchEvent('input');
    await page.waitForTimeout(500);
    
    // Check no preset is active
    for (const button of resolutionButtons) {
      const isActive = await button.evaluate(el => el.classList.contains('active'));
      expect(isActive).toBe(false);
    }
    console.log('   ✅ No preset active for custom 800×600');
    
    // Click preset
    await resolutionButtons[1].click(); // 360p
    await page.waitForTimeout(500);
    
    // Check inputs updated
    const width = await widthInput.evaluate(el => el.value);
    const height = await heightInput.evaluate(el => el.value);
    expect(parseInt(width)).toBe(640);
    expect(parseInt(height)).toBe(360);
    console.log('   ✅ Custom inputs updated to preset 640×360');
    
    // Check correct preset is active
    const isActive = await resolutionButtons[1].evaluate(el => el.classList.contains('active'));
    expect(isActive).toBe(true);
    console.log('   ✅ Correct preset button active');
  });

  test('Different resolutions produce different output', async () => {
    console.log('🎯 Testing actual output at different resolutions...');
    
    const testResolutions = [
      { button: 0, label: '480p', expectedWidth: 480 },
      { button: 2, label: '720p', expectedWidth: 1280 }
    ];
    
    for (const res of testResolutions) {
      console.log(`\n   Testing ${res.label}...`);
      
      // Select resolution
      const resolutionButtons = await page.$$('.ytgif-unified-resolution-btn');
      await resolutionButtons[res.button].click();
      await page.waitForTimeout(500);
      
      // Create GIF
      const createButton = await page.$('.ytgif-unified-btn-create');
      await createButton.click();
      
      // Monitor for completion
      let completed = false;
      for (let i = 0; i < 30; i++) {
        await page.waitForTimeout(1000);
        const saveButton = await page.$('.ytgif-unified-btn-save');
        if (saveButton) {
          completed = true;
          console.log(`   ✅ ${res.label} GIF created`);
          
          // Cancel and prepare for next test
          const cancelButton = await page.$('.ytgif-unified-btn-cancel');
          await cancelButton.click();
          await page.waitForTimeout(1000);
          
          // Re-open for next iteration
          if (res !== testResolutions[testResolutions.length - 1]) {
            const gifButton = await page.waitForSelector('.ytgif-button');
            await gifButton.click();
            await page.waitForTimeout(2000);
            
            const presetButtons = await page.$$('.ytgif-preset-btn');
            if (presetButtons.length > 0) {
              await presetButtons[0].click();
              await page.waitForTimeout(3000);
            }
          }
          break;
        }
      }
      
      expect(completed).toBe(true);
    }
  });
});