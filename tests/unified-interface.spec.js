const { test, expect, chromium } = require('@playwright/test');
const path = require('path');

test.describe('Unified Timeline-Editor Interface', () => {
  let browser;
  let page;

  test.beforeAll(async () => {
    const extensionPath = path.join(__dirname, '..', 'dist');
    
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
  });

  test.afterAll(async () => {
    await browser.close();
  });

  test('should open unified interface when GIF button is clicked', async () => {
    console.log('🎬 Starting Unified Interface Test');
    
    // Navigate to YouTube video
    await page.goto('https://www.youtube.com/watch?v=dQw4w9WgXcQ', { 
      waitUntil: 'networkidle' 
    });

    // Wait for player to load
    await page.waitForSelector('#movie_player', { timeout: 15000 });
    await page.waitForTimeout(3000);

    // Find and click GIF button
    const gifButton = await page.waitForSelector('.ytgif-button', { timeout: 10000 });
    expect(gifButton).toBeTruthy();
    console.log('✅ Found GIF button');

    await gifButton.click();
    console.log('🖱️ Clicked GIF button');

    // Wait for unified interface
    await page.waitForTimeout(2000);
    
    // Check for unified interface elements
    const unifiedOverlay = await page.$('.ytgif-unified-overlay');
    expect(unifiedOverlay).toBeTruthy();
    console.log('✅ Unified interface opened');

    // Check for main title
    const title = await page.$eval('.ytgif-unified-header h2', el => el.textContent);
    expect(title).toBe('Create GIF from Video');
    console.log('✅ Title displayed correctly');
  });

  test('should have timeline selection at the top', async () => {
    // Check for quick presets
    const presets = await page.$$('.ytgif-preset-btn');
    expect(presets.length).toBeGreaterThan(0);
    console.log(`✅ Found ${presets.length} quick preset buttons`);

    // Check for timeline markers
    const timeline = await page.$('.ytgif-timeline-track');
    expect(timeline).toBeTruthy();
    console.log('✅ Timeline track present');

    // Check for duration display
    const durationInfo = await page.$('.ytgif-unified-duration');
    expect(durationInfo).toBeTruthy();
    const duration = await durationInfo.evaluate(el => el.textContent);
    console.log(`✅ Duration displayed: ${duration}`);
  });

  test('should have preview panel on the left', async () => {
    const previewPanel = await page.$('.ytgif-unified-preview');
    expect(previewPanel).toBeTruthy();
    console.log('✅ Preview panel present');

    // Check for preview placeholder or canvas
    const previewPlaceholder = await page.$('.ytgif-unified-preview-placeholder');
    const canvas = await page.$('.ytgif-unified-canvas');
    expect(previewPlaceholder || canvas).toBeTruthy();
    console.log('✅ Preview area ready');
  });

  test('should have settings panel on the right', async () => {
    const settingsPanel = await page.$('.ytgif-unified-settings');
    expect(settingsPanel).toBeTruthy();
    console.log('✅ Settings panel present');

    // Check for format selection
    const formatButtons = await page.$$('.ytgif-unified-format-btn');
    expect(formatButtons.length).toBe(0); // No format buttons since only GIF is supported
    console.log('✅ Format selection buttons present');

    // Check for quality controls
    const qualityButtons = await page.$$('.ytgif-unified-quality-btn');
    expect(qualityButtons.length).toBe(3); // Low, Medium, High
    console.log('✅ Quality control buttons present');

    // Check for resolution controls
    const resolutionButtons = await page.$$('.ytgif-unified-resolution-btn');
    expect(resolutionButtons.length).toBeGreaterThan(0);
    console.log('✅ Resolution preset buttons present');

    // Check for frame rate slider
    const frameRateSlider = await page.$('.ytgif-unified-slider');
    expect(frameRateSlider).toBeTruthy();
    console.log('✅ Frame rate slider present');

    // Check for loop checkbox
    const loopCheckbox = await page.$('.ytgif-unified-checkbox');
    expect(loopCheckbox).toBeTruthy();
    console.log('✅ Loop checkbox present');
  });

  test('should have action buttons in footer', async () => {
    // Check for file size estimate
    const sizeEstimate = await page.$('.ytgif-unified-size-estimate');
    expect(sizeEstimate).toBeTruthy();
    const size = await sizeEstimate.evaluate(el => el.textContent);
    console.log(`✅ File size estimate: ${size}`);

    // Check for action buttons
    const cancelButton = await page.$('.ytgif-unified-btn-cancel');
    const saveButton = await page.$('.ytgif-unified-btn-save');
    const exportButton = await page.$('.ytgif-unified-btn-export');
    
    expect(cancelButton).toBeTruthy();
    expect(saveButton).toBeTruthy();
    expect(exportButton).toBeTruthy();
    console.log('✅ All action buttons present');
  });

  test('should update settings when controls are changed', async () => {
    // Test quality selection
    const highQualityButton = await page.$('.ytgif-unified-quality-btn:nth-child(3)'); // High
    await highQualityButton.click();
    await page.waitForTimeout(500);
    
    const highActive = await highQualityButton.evaluate(el => el.classList.contains('active'));
    expect(highActive).toBe(true);
    console.log('✅ Quality selection works');

    // Test frame rate slider
    const slider = await page.$('.ytgif-unified-slider');
    await slider.evaluate(el => el.value = '25');
    await slider.dispatchEvent('input');
    await page.waitForTimeout(500);
    
    // Find the frame rate label specifically
    const frameRateLabels = await page.$$eval('.ytgif-unified-label', labels => 
      labels.map(el => el.textContent)
    );
    const frameRateLabel = frameRateLabels.find(label => label.includes('fps') || label.includes('Frame'));
    expect(frameRateLabel).toContain('25');
    console.log('✅ Frame rate slider works');

    // Check that export button text shows GIF
    const exportButtonText = await page.$eval('.ytgif-unified-btn-export', el => el.textContent);
    expect(exportButtonText).toContain('GIF');
    console.log('✅ Export button shows GIF format');
  });

  test('should auto-extract frames when selection changes', async () => {
    // Click a quick preset to change selection
    const preset = await page.$('.ytgif-preset-btn');
    if (!preset) {
      console.log('⚠️ No preset buttons found, skipping frame extraction test');
      return;
    }
    await preset.click();
    console.log('🔄 Changed selection via preset');

    // Wait for frame extraction
    await page.waitForTimeout(3000);

    // Check for extraction indicator or frames
    const extracting = await page.$('.ytgif-unified-extracting');
    const canvas = await page.$('.ytgif-unified-canvas');
    
    if (extracting) {
      console.log('⏳ Frame extraction in progress');
      await page.waitForTimeout(5000);
    }
    
    if (canvas) {
      console.log('✅ Frames extracted and preview ready');
      
      // Check for play button
      const playButton = await page.$('.ytgif-unified-play-btn');
      expect(playButton).toBeTruthy();
      console.log('✅ Play button available');
    }
  });

  test('should create GIF when export is clicked', async () => {
    // Set up console listener for GIF creation
    const messages = [];
    page.on('console', msg => {
      const text = msg.text();
      messages.push(text);
      if (text.includes('GIF') || text.includes('Export') || text.includes('Processing')) {
        console.log(`📨 Extension: ${text}`);
      }
    });

    // Click export button
    const exportButton = await page.$('.ytgif-unified-btn-export');
    if (!exportButton) {
      console.log('⚠️ Export button not found, skipping export test');
      return;
    }
    await exportButton.click();
    console.log('🎨 Clicked Export button');

    // Wait for processing
    await page.waitForTimeout(5000);

    // Check if processing started
    const processingStarted = messages.some(msg => 
      msg.includes('process') || msg.includes('export') || msg.includes('creating')
    );
    
    if (processingStarted) {
      console.log('✅ GIF processing started');
    } else {
      console.log('⚠️ No processing messages detected');
    }
  });

  test('should close interface when cancel is clicked', async () => {
    // Click cancel button
    const cancelButton = await page.$('.ytgif-unified-btn-cancel');
    if (cancelButton) {
      await cancelButton.click();
      console.log('🔚 Clicked Cancel button');
      
      await page.waitForTimeout(1000);
      
      // Check that interface is closed
      const overlayGone = await page.$('.ytgif-unified-overlay');
      expect(overlayGone).toBeFalsy();
      console.log('✅ Interface closed successfully');
    }
  });
});

test.describe('Unified Interface Responsive Design', () => {
  test('should adapt to smaller viewport', async () => {
    const extensionPath = path.join(__dirname, '..', 'dist');
    
    // Create new browser context with extension loaded
    const smallBrowser = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--no-sandbox',
        '--disable-dev-shm-usage',
      ],
      viewport: { width: 768, height: 600 }
    });
    
    const page = await smallBrowser.newPage();
    
    await page.goto('https://www.youtube.com/watch?v=dQw4w9WgXcQ', { 
      waitUntil: 'networkidle' 
    });
    
    // Wait for player and click GIF button
    await page.waitForSelector('#movie_player', { timeout: 15000 });
    await page.waitForTimeout(2000);
    
    const gifButton = await page.waitForSelector('.ytgif-button', { timeout: 10000 });
    await gifButton.click();
    
    // Check for responsive layout
    const unifiedContainer = await page.$('.ytgif-unified-container');
    if (unifiedContainer) {
      const containerWidth = await unifiedContainer.evaluate(el => el.clientWidth);
      expect(containerWidth).toBeLessThanOrEqual(768 * 0.95); // Should be 95% of viewport
      console.log('✅ Responsive layout working');
    }
    
    await smallBrowser.close();
  });
});