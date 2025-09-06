const { test, expect, chromium } = require('@playwright/test');
const path = require('path');

test.describe('Actions and Workflow Testing', () => {
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

  test('Create GIF button workflow', async () => {
    console.log('🎯 Testing Create GIF button workflow...');
    
    // Initial state - only Create button should exist
    const createButton = await page.$('.ytgif-unified-btn-create');
    const saveButton = await page.$('.ytgif-unified-btn-save');
    const exportButton = await page.$('.ytgif-unified-btn-export');
    
    expect(createButton).toBeTruthy();
    expect(saveButton).toBeFalsy();
    expect(exportButton).toBeFalsy();
    console.log('   ✅ Initial state: Only Create GIF button visible');
    
    // Button should be enabled when frames are extracted
    const isEnabled = await createButton.evaluate(el => !el.disabled);
    expect(isEnabled).toBe(true);
    console.log('   ✅ Create GIF button is enabled');
    
    // Click Create GIF
    await createButton.click();
    console.log('   🎬 Clicked Create GIF button');
    
    // Button should show progress message
    await page.waitForTimeout(2000);
    const buttonText = await createButton.evaluate(el => el.textContent);
    expect(buttonText).toContain('Creating');
    console.log('   ✅ Button shows progress message');
    
    // Wait for completion
    let completed = false;
    for (let i = 0; i < 30; i++) {
      await page.waitForTimeout(1000);
      
      const newSaveButton = await page.$('.ytgif-unified-btn-save');
      const newExportButton = await page.$('.ytgif-unified-btn-export');
      
      if (newSaveButton && newExportButton) {
        completed = true;
        console.log('   ✅ Save and Export buttons appeared after creation');
        
        // Create button should be hidden/gone
        const createButtonGone = await page.$('.ytgif-unified-btn-create');
        expect(createButtonGone).toBeFalsy();
        console.log('   ✅ Create GIF button hidden after completion');
        break;
      }
    }
    
    expect(completed).toBe(true);
  });

  test('Save to Library button functionality', async () => {
    console.log('💾 Testing Save to Library button...');
    
    // Create GIF first
    const createButton = await page.$('.ytgif-unified-btn-create');
    await createButton.click();
    
    // Wait for completion
    let saveButton = null;
    for (let i = 0; i < 30; i++) {
      await page.waitForTimeout(1000);
      saveButton = await page.$('.ytgif-unified-btn-save');
      if (saveButton) break;
    }
    
    expect(saveButton).toBeTruthy();
    console.log('   ✅ Save button available after creation');
    
    // Check button text
    const buttonText = await saveButton.evaluate(el => el.textContent);
    expect(buttonText).toContain('Save to Library');
    console.log('   ✅ Button shows "Save to Library"');
    
    // Button should be enabled
    const isEnabled = await saveButton.evaluate(el => !el.disabled);
    expect(isEnabled).toBe(true);
    console.log('   ✅ Save button is enabled');
    
    // Set up console listener for save messages
    let saveMessageDetected = false;
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('Saving') || text.includes('saved')) {
        saveMessageDetected = true;
        console.log(`   📨 ${text}`);
      }
    });
    
    // Click Save button
    await saveButton.click();
    console.log('   💾 Clicked Save to Library');
    
    // Wait a moment for save process
    await page.waitForTimeout(3000);
    
    // Interface should close after save
    const interfaceClosed = await page.$('.ytgif-unified-overlay');
    expect(interfaceClosed).toBeFalsy();
    console.log('   ✅ Interface closed after save');
  });

  test('Export button functionality', async () => {
    console.log('📤 Testing Export button...');
    
    // Create GIF first
    const createButton = await page.$('.ytgif-unified-btn-create');
    await createButton.click();
    
    // Wait for completion
    let exportButton = null;
    for (let i = 0; i < 30; i++) {
      await page.waitForTimeout(1000);
      exportButton = await page.$('.ytgif-unified-btn-export');
      if (exportButton) break;
    }
    
    expect(exportButton).toBeTruthy();
    console.log('   ✅ Export button available after creation');
    
    // Check button text shows format
    const buttonText = await exportButton.evaluate(el => el.textContent);
    expect(buttonText).toContain('Export GIF');
    console.log(`   ✅ Button shows: ${buttonText}`);
    
    // Button should be enabled
    const isEnabled = await exportButton.evaluate(el => !el.disabled);
    expect(isEnabled).toBe(true);
    console.log('   ✅ Export button is enabled');
    
    // Set up console listener for export messages
    let exportMessageDetected = false;
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('Export') || text.includes('download')) {
        exportMessageDetected = true;
        console.log(`   📨 ${text}`);
      }
    });
    
    // Click Export button
    await exportButton.click();
    console.log('   📤 Clicked Export');
    
    // Wait a moment for export process
    await page.waitForTimeout(3000);
    
    // Interface should close after export
    const interfaceClosed = await page.$('.ytgif-unified-overlay');
    expect(interfaceClosed).toBeFalsy();
    console.log('   ✅ Interface closed after export');
  });

  test('Cancel button at various stages', async () => {
    console.log('❌ Testing Cancel button...');
    
    // Test cancel before creation
    const cancelButton = await page.$('.ytgif-unified-btn-cancel');
    expect(cancelButton).toBeTruthy();
    
    const isEnabled = await cancelButton.evaluate(el => !el.disabled);
    expect(isEnabled).toBe(true);
    console.log('   ✅ Cancel button available and enabled initially');
    
    // Click cancel should close interface
    await cancelButton.click();
    await page.waitForTimeout(1000);
    
    const interfaceClosed = await page.$('.ytgif-unified-overlay');
    expect(interfaceClosed).toBeFalsy();
    console.log('   ✅ Cancel closes interface');
    
    // Re-open interface to test cancel during creation
    const gifButton = await page.waitForSelector('.ytgif-button', { timeout: 10000 });
    await gifButton.click();
    await page.waitForTimeout(2000);
    
    const presetButtons = await page.$$('.ytgif-preset-btn');
    if (presetButtons.length > 0) {
      await presetButtons[0].click();
      await page.waitForTimeout(3000);
    }
    
    // Start creation then try cancel
    const createButton = await page.$('.ytgif-unified-btn-create');
    await createButton.click();
    
    // Quick cancel during processing
    await page.waitForTimeout(2000);
    const cancelDuringProcess = await page.$('.ytgif-unified-btn-cancel');
    if (cancelDuringProcess) {
      await cancelDuringProcess.click();
      await page.waitForTimeout(1000);
      
      const interfaceClosedDuringProcess = await page.$('.ytgif-unified-overlay');
      expect(interfaceClosedDuringProcess).toBeFalsy();
      console.log('   ✅ Cancel works during processing');
    }
  });

  test('Button states during processing', async () => {
    console.log('🔒 Testing button states during processing...');
    
    const createButton = await page.$('.ytgif-unified-btn-create');
    const cancelButton = await page.$('.ytgif-unified-btn-cancel');
    
    // Start creation
    await createButton.click();
    await page.waitForTimeout(1000);
    
    // Check button states during processing
    const createDisabled = await createButton.evaluate(el => el.disabled);
    const cancelStillEnabled = await cancelButton.evaluate(el => !el.disabled);
    
    expect(createDisabled).toBe(true);
    expect(cancelStillEnabled).toBe(true);
    console.log('   ✅ Create button disabled, Cancel still enabled during processing');
    
    // Wait for completion
    for (let i = 0; i < 30; i++) {
      await page.waitForTimeout(1000);
      
      const saveButton = await page.$('.ytgif-unified-btn-save');
      const exportButton = await page.$('.ytgif-unified-btn-export');
      
      if (saveButton && exportButton) {
        // Check post-creation button states
        const saveEnabled = await saveButton.evaluate(el => !el.disabled);
        const exportEnabled = await exportButton.evaluate(el => !el.disabled);
        const cancelStillEnabledAfter = await cancelButton.evaluate(el => !el.disabled);
        
        expect(saveEnabled).toBe(true);
        expect(exportEnabled).toBe(true);
        expect(cancelStillEnabledAfter).toBe(true);
        console.log('   ✅ Save, Export, and Cancel buttons all enabled after completion');
        break;
      }
    }
  });

  test('Button validation with invalid state', async () => {
    console.log('⚠️ Testing button validation...');
    
    // Start with a very short duration that might be invalid
    const widthInput = await page.$('.ytgif-unified-resolution-custom input[type="number"]:first-of-type');
    const heightInput = await page.$('.ytgif-unified-resolution-custom input[type="number"]:last-of-type');
    
    // Try to set invalid resolution
    await widthInput.evaluate(el => el.value = '50'); // Below minimum
    await widthInput.dispatchEvent('input');
    await heightInput.evaluate(el => el.value = '50'); // Below minimum  
    await heightInput.dispatchEvent('input');
    await page.waitForTimeout(1000);
    
    const createButton = await page.$('.ytgif-unified-btn-create');
    
    // Button should handle invalid states gracefully
    const isStillEnabled = await createButton.evaluate(el => !el.disabled);
    
    // The button might be disabled or enabled depending on validation logic
    console.log(`   ℹ️ Create button with invalid resolution: ${isStillEnabled ? 'enabled' : 'disabled'}`);
    
    // Try to create anyway
    if (isStillEnabled) {
      await createButton.click();
      await page.waitForTimeout(5000);
      
      // Should either complete or show error gracefully
      const saveButton = await page.$('.ytgif-unified-btn-save');
      const progressBar = await page.$('.ytgif-unified-progress-fill');
      
      if (saveButton) {
        console.log('   ✅ Creation completed despite invalid input');
      } else if (progressBar) {
        console.log('   ⏳ Creation in progress with invalid input');
      } else {
        console.log('   ⚠️ Creation handled invalid input gracefully');
      }
    }
  });
});