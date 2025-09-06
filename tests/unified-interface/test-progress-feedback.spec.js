const { test, expect, chromium } = require('@playwright/test');
const path = require('path');

test.describe('Progress and Feedback Testing', () => {
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

  test('Progress bar accuracy (0-100%)', async () => {
    console.log('📊 Testing progress bar accuracy...');
    
    // Set up progress tracking
    const progressValues = [];
    
    // Start creation
    const createButton = await page.$('.ytgif-unified-btn-create');
    await createButton.click();
    
    // Monitor progress bar
    let maxProgress = 0;
    let progressIncreasing = true;
    
    for (let i = 0; i < 40; i++) {
      await page.waitForTimeout(1000);
      
      const progressBar = await page.$('.ytgif-unified-progress-fill');
      if (progressBar) {
        const width = await progressBar.evaluate(el => el.style.width);
        if (width && width !== '0%') {
          const percentage = parseFloat(width.replace('%', ''));
          progressValues.push(percentage);
          
          if (percentage > maxProgress) {
            maxProgress = percentage;
          } else if (percentage < maxProgress && progressIncreasing) {
            // Progress should generally be increasing
            console.log(`   ⚠️ Progress decreased from ${maxProgress}% to ${percentage}%`);
            progressIncreasing = false;
          }
          
          console.log(`   📈 Progress: ${percentage}%`);
          
          // Check for completion
          if (percentage >= 100) {
            console.log('   ✅ Reached 100% progress');
            break;
          }
        }
      }
      
      // Check if completed via save/export buttons
      const saveButton = await page.$('.ytgif-unified-btn-save');
      if (saveButton) {
        console.log('   ✅ Creation completed - Save button appeared');
        break;
      }
    }
    
    expect(progressValues.length).toBeGreaterThan(0);
    expect(maxProgress).toBeGreaterThan(0);
    expect(maxProgress).toBeLessThanOrEqual(100);
    
    console.log(`   📊 Progress Summary:`);
    console.log(`      Values recorded: ${progressValues.length}`);
    console.log(`      Max progress: ${maxProgress}%`);
    console.log(`      Final values: ${progressValues.slice(-3).join('%, ')}%`);
  });

  test('Progress messages during different stages', async () => {
    console.log('💬 Testing progress messages...');
    
    const progressMessages = [];
    
    // Set up console listener for progress messages
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('progress') && text.includes('message')) {
        progressMessages.push(text);
      }
    });
    
    // Start creation
    const createButton = await page.$('.ytgif-unified-btn-create');
    await createButton.click();
    
    // Monitor progress text element
    const expectedStages = [
      'Creating GIF',
      'Initializing',
      'Capturing frames',
      'Encoding',
      'Complete'
    ];
    
    const detectedStages = new Set();
    
    for (let i = 0; i < 40; i++) {
      await page.waitForTimeout(1000);
      
      const progressText = await page.$('.ytgif-unified-progress-text');
      if (progressText) {
        const message = await progressText.evaluate(el => el.textContent);
        if (message) {
          // Check which stages we've seen
          expectedStages.forEach(stage => {
            if (message.includes(stage)) {
              detectedStages.add(stage);
            }
          });
          
          console.log(`   💬 Status: ${message}`);
        }
      }
      
      // Check for completion
      const saveButton = await page.$('.ytgif-unified-btn-save');
      if (saveButton) {
        break;
      }
    }
    
    console.log(`   📋 Detected stages: ${Array.from(detectedStages).join(', ')}`);
    console.log(`   📨 Console messages: ${progressMessages.length}`);
    
    // Should have detected at least some key stages
    expect(detectedStages.size).toBeGreaterThan(0);
    expect(detectedStages.has('Creating GIF') || detectedStages.has('Capturing frames')).toBe(true);
  });

  test('Frame extraction progress tracking', async () => {
    console.log('🎞️ Testing frame extraction progress...');
    
    // Monitor for frame extraction messages
    const frameMessages = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('frame') || text.includes('Capturing')) {
        frameMessages.push(text);
      }
    });
    
    // Start creation
    const createButton = await page.$('.ytgif-unified-btn-create');
    await createButton.click();
    
    // Track frame extraction phase
    let frameExtractionDetected = false;
    let encodingStarted = false;
    
    for (let i = 0; i < 30; i++) {
      await page.waitForTimeout(1000);
      
      const progressText = await page.$('.ytgif-unified-progress-text');
      if (progressText) {
        const message = await progressText.evaluate(el => el.textContent);
        
        if (message && message.includes('Capturing frames')) {
          frameExtractionDetected = true;
          console.log(`   🎞️ Frame extraction: ${message}`);
        }
        
        if (message && message.includes('Encoding')) {
          encodingStarted = true;
          console.log(`   ⚙️ Encoding started: ${message}`);
          break;
        }
      }
    }
    
    expect(frameExtractionDetected).toBe(true);
    console.log(`   ✅ Frame extraction phase detected`);
    console.log(`   📨 Frame-related messages: ${frameMessages.length}`);
  });

  test('Encoding progress with frame counts', async () => {
    console.log('⚙️ Testing encoding progress...');
    
    // Monitor for encoding-specific messages
    const encodingMessages = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('Encoding') || text.includes('frame')) {
        encodingMessages.push(text);
      }
    });
    
    // Start creation
    const createButton = await page.$('.ytgif-unified-btn-create');
    await createButton.click();
    
    // Wait for encoding phase
    let encodingDetected = false;
    let frameCountMessages = [];
    
    for (let i = 0; i < 35; i++) {
      await page.waitForTimeout(1000);
      
      const progressText = await page.$('.ytgif-unified-progress-text');
      if (progressText) {
        const message = await progressText.evaluate(el => el.textContent);
        
        if (message && message.includes('Encoding frame')) {
          encodingDetected = true;
          frameCountMessages.push(message);
          console.log(`   ⚙️ ${message}`);
        }
        
        if (message && message.includes('Complete')) {
          console.log(`   ✅ Encoding completed`);
          break;
        }
      }
      
      // Also check for completion
      const saveButton = await page.$('.ytgif-unified-btn-save');
      if (saveButton) {
        break;
      }
    }
    
    expect(encodingDetected).toBe(true);
    console.log(`   📊 Encoding Summary:`);
    console.log(`      Frame count messages: ${frameCountMessages.length}`);
    console.log(`      Total encoding messages: ${encodingMessages.length}`);
    console.log(`      Sample messages: ${frameCountMessages.slice(0, 3).join('; ')}`);
  });

  test('Progress bar visual states', async () => {
    console.log('🎨 Testing progress bar visual states...');
    
    // Start creation
    const createButton = await page.$('.ytgif-unified-btn-create');
    await createButton.click();
    
    // Check progress bar container appears
    let progressContainer = null;
    for (let i = 0; i < 10; i++) {
      await page.waitForTimeout(500);
      progressContainer = await page.$('.ytgif-unified-progress-container');
      if (progressContainer) break;
    }
    
    expect(progressContainer).toBeTruthy();
    console.log('   ✅ Progress container appeared');
    
    // Check progress bar structure
    const progressBar = await page.$('.ytgif-unified-progress-bar');
    const progressFill = await page.$('.ytgif-unified-progress-fill');
    const progressText = await page.$('.ytgif-unified-progress-text');
    
    expect(progressBar).toBeTruthy();
    expect(progressFill).toBeTruthy();
    expect(progressText).toBeTruthy();
    console.log('   ✅ All progress elements present');
    
    // Check CSS classes and styling
    const barClass = await progressBar.evaluate(el => el.className);
    const fillClass = await progressFill.evaluate(el => el.className);
    
    expect(barClass).toContain('ytgif-unified-progress-bar');
    expect(fillClass).toContain('ytgif-unified-progress-fill');
    console.log('   ✅ Progress bar has correct CSS classes');
    
    // Monitor fill width changes
    const fillWidths = [];
    for (let i = 0; i < 20; i++) {
      await page.waitForTimeout(1000);
      
      const width = await progressFill.evaluate(el => el.style.width);
      if (width && width !== '0%' && !fillWidths.includes(width)) {
        fillWidths.push(width);
        console.log(`   📏 Progress fill width: ${width}`);
      }
      
      // Check for completion
      const saveButton = await page.$('.ytgif-unified-btn-save');
      if (saveButton) {
        console.log('   ✅ Progress completed');
        break;
      }
    }
    
    expect(fillWidths.length).toBeGreaterThan(0);
    console.log(`   📊 Detected ${fillWidths.length} different fill widths`);
  });

  test('Progress feedback with different settings', async () => {
    console.log('⚙️ Testing progress with different settings...');
    
    // Test with high frame rate for more frames
    const frameRateSlider = await page.$('.ytgif-unified-slider');
    await frameRateSlider.evaluate(el => el.value = '25');
    await frameRateSlider.dispatchEvent('input');
    await page.waitForTimeout(500);
    
    const progressMessages = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('progress') || text.includes('frame')) {
        progressMessages.push(text);
      }
    });
    
    // Start creation
    const createButton = await page.$('.ytgif-unified-btn-create');
    await createButton.click();
    
    // Track progress with high frame rate
    let totalDuration = 0;
    const startTime = Date.now();
    
    for (let i = 0; i < 40; i++) {
      await page.waitForTimeout(1000);
      totalDuration += 1000;
      
      const saveButton = await page.$('.ytgif-unified-btn-save');
      if (saveButton) {
        totalDuration = Date.now() - startTime;
        break;
      }
    }
    
    console.log(`   ⏱️ Total creation time: ${(totalDuration / 1000).toFixed(1)}s`);
    console.log(`   📊 Progress messages with 25fps: ${progressMessages.length}`);
    
    // Higher frame rates should produce more progress messages
    expect(progressMessages.length).toBeGreaterThan(5);
  });

  test('Error handling in progress display', async () => {
    console.log('❌ Testing error handling in progress...');
    
    // Try to trigger an edge case by rapidly changing settings during processing
    const createButton = await page.$('.ytgif-unified-btn-create');
    await createButton.click();
    
    // Wait a moment then try to change settings (should be disabled)
    await page.waitForTimeout(2000);
    
    const formatButtons = await page.$$('.ytgif-unified-format-btn');
    const qualityButtons = await page.$$('.ytgif-unified-quality-btn');
    
    // All should be disabled during processing
    for (const button of formatButtons) {
      const isDisabled = await button.evaluate(el => el.disabled);
      expect(isDisabled).toBe(true);
    }
    console.log('   ✅ Format buttons disabled during processing');
    
    for (const button of qualityButtons) {
      const isDisabled = await button.evaluate(el => el.disabled);
      expect(isDisabled).toBe(true);
    }
    console.log('   ✅ Quality buttons disabled during processing');
    
    // Progress should continue normally
    await page.waitForTimeout(5000);
    
    const progressContainer = await page.$('.ytgif-unified-progress-container');
    expect(progressContainer).toBeTruthy();
    console.log('   ✅ Progress continues despite disabled controls');
    
    // Wait for completion
    for (let i = 0; i < 25; i++) {
      await page.waitForTimeout(1000);
      const saveButton = await page.$('.ytgif-unified-btn-save');
      if (saveButton) {
        console.log('   ✅ Creation completed successfully');
        break;
      }
    }
  });
});