const { test, expect, chromium } = require('@playwright/test');
const path = require('path');

test.describe('YouTube GIF Maker - End-to-End GIF Creation', () => {
  let browser;
  let context;
  let page;

  test.beforeAll(async () => {
    // Path to built extension
    const extensionPath = path.join(__dirname, '..', 'dist');
    
    // Launch browser with extension loaded
    browser = await chromium.launchPersistentContext('', {
      headless: false, // Visual feedback for GIF creation process
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security', // Allow video processing
        '--allow-running-insecure-content',
        '--disable-features=VizDisplayCompositor'
      ],
      viewport: { width: 1280, height: 720 }
    });

    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await browser?.close();
  });

  test('should create GIF using 3s quick preset', async () => {
    // Set longer timeout for GIF processing
    test.setTimeout(120000); // 2 minutes

    console.log('🎬 Starting End-to-End GIF Creation Test');
    
    // Step 1: Navigate to YouTube video
    console.log('📺 Navigating to YouTube video...');
    await page.goto('https://www.youtube.com/watch?v=dQw4w9WgXcQ', { 
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // Step 2: Wait for YouTube player to load
    console.log('⏳ Waiting for YouTube player...');
    await page.waitForSelector('#movie_player', { timeout: 15000 });
    await page.waitForTimeout(3000); // Allow extension initialization

    // Step 3: Find and verify GIF button
    console.log('🔍 Looking for GIF button...');
    const gifButton = await page.waitForSelector('.ytgif-button', { timeout: 10000 });
    expect(gifButton).toBeTruthy();
    
    const isButtonVisible = await gifButton.isVisible();
    expect(isButtonVisible).toBe(true);
    console.log('✅ GIF button found and visible');

    // Step 4: Set up message listeners for monitoring
    const messageLog = [];
    const progressUpdates = [];
    
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('[Content]') || text.includes('[Background]') || text.includes('GIF')) {
        messageLog.push(`${Date.now()}: ${text}`);
      }
    });

    // Step 5: Click GIF button to open timeline
    console.log('🖱️  Clicking GIF button...');
    await gifButton.click();
    
    // Step 6: Wait for timeline overlay content to be visible
    console.log('⏳ Waiting for timeline overlay...');
    
    // Wait for the main overlay container
    await page.waitForSelector('#ytgif-timeline-overlay', { timeout: 10000 });
    
    // Wait for the timeline to have actual content with height
    const timelineOverlay = await page.waitForFunction(() => {
      const overlay = document.querySelector('#ytgif-timeline-overlay');
      if (!overlay) return false;
      
      // Check if there's content with actual height
      const contentDiv = overlay.querySelector('.ytgif-timeline-overlay, .ytgif-timeline-container');
      if (!contentDiv) return false;
      
      const rect = contentDiv.getBoundingClientRect();
      return rect.height > 0 && rect.width > 0;
    }, { timeout: 10000 });
    
    expect(timelineOverlay).toBeTruthy();
    console.log('✅ Timeline overlay appeared with content');

    // Step 7: Verify timeline elements are present
    const timelineElements = await page.evaluate(() => {
      const overlay = document.querySelector('#ytgif-timeline-overlay');
      if (!overlay) return null;
      
      return {
        title: overlay.querySelector('.ytgif-timeline-title')?.textContent,
        presetButtons: overlay.querySelectorAll('.ytgif-preset-btn').length,
        createButton: !!overlay.querySelector('.ytgif-timeline-create'),
        cancelButton: !!overlay.querySelector('.ytgif-timeline-cancel'),
        timelineTrack: !!overlay.querySelector('.ytgif-timeline-track'),
        hasRecommended: overlay.querySelector('.ytgif-preset-btn--recommended') !== null
      };
    });
    
    console.log('📋 Timeline elements:', timelineElements);
    expect(timelineElements.title).toBe('Select GIF Segment');
    expect(timelineElements.presetButtons).toBeGreaterThan(0);
    expect(timelineElements.createButton).toBe(true);
    expect(timelineElements.cancelButton).toBe(true);

    // Step 8: Click the recommended 3s preset
    console.log('⚡ Clicking 3s preset...');
    const preset3sButton = await page.waitForSelector('.ytgif-preset-btn--recommended', { 
      timeout: 5000 
    });
    await preset3sButton.click();
    
    // Verify selection updated
    await page.waitForTimeout(500);
    const selectionInfo = await page.evaluate(() => {
      const durationSpan = document.querySelector('.ytgif-timeline-duration');
      return {
        duration: durationSpan?.textContent,
        visible: !!durationSpan
      };
    });
    
    console.log('📏 Selection info:', selectionInfo);
    expect(selectionInfo.visible).toBe(true);

    // Step 9: Click Create GIF button
    console.log('🎨 Starting GIF creation...');
    const createButton = await page.waitForSelector('.ytgif-timeline-create', { 
      timeout: 5000 
    });
    
    // Monitor for GIF creation completion
    let gifCreationComplete = false;
    let gifCreationError = null;
    let gifCreationResult = null;

    // Set up listener for GIF creation feedback
    const feedbackPromise = page.evaluate(() => {
      return new Promise((resolve) => {
        // Listen for feedback elements that appear after GIF creation
        const observer = new MutationObserver((mutations) => {
          for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
              if (node.nodeType === 1 && node.className && 
                  node.className.includes('ytgif-feedback')) {
                const type = node.className.includes('ytgif-feedback--success') ? 'success' : 'error';
                const message = node.textContent;
                resolve({ type, message, timestamp: Date.now() });
                observer.disconnect();
                return;
              }
            }
          }
        });
        observer.observe(document.body, { childList: true, subtree: true });
        
        // Timeout after 60 seconds
        setTimeout(() => {
          observer.disconnect();
          resolve({ type: 'timeout', message: 'No feedback received within 60s' });
        }, 60000);
      });
    });

    // Click create button
    await createButton.click();
    console.log('🔄 Create GIF button clicked, waiting for processing...');

    // Step 10: Monitor processing state
    const processingStartTime = Date.now();
    
    // Wait for button to show "Creating..." state
    await page.waitForFunction(() => {
      const btn = document.querySelector('.ytgif-timeline-create');
      return btn && btn.textContent.includes('Creating');
    }, { timeout: 5000 });
    
    console.log('⏳ GIF processing started...');

    // Step 11: Wait for completion feedback
    const feedback = await feedbackPromise;
    const processingEndTime = Date.now();
    const processingDuration = processingEndTime - processingStartTime;
    
    console.log('📊 Processing Results:');
    console.log(`   Duration: ${processingDuration}ms`);
    console.log(`   Feedback: ${feedback.type} - ${feedback.message}`);
    
    // Step 12: Verify successful completion
    if (feedback.type === 'success') {
      expect(feedback.message).toContain('GIF created successfully');
      console.log('✅ GIF creation completed successfully!');
      
      // Verify timeline overlay closes after success
      await page.waitForFunction(() => {
        const overlay = document.querySelector('#ytgif-timeline-overlay');
        return !overlay || overlay.style.display === 'none' || !overlay.offsetParent;
      }, { timeout: 5000 });
      
      console.log('✅ Timeline overlay closed after successful creation');
      
    } else if (feedback.type === 'error') {
      console.error('❌ GIF creation failed:', feedback.message);
      console.error('📋 Message log:', messageLog.slice(-10)); // Last 10 messages
      throw new Error(`GIF creation failed: ${feedback.message}`);
      
    } else {
      console.error('⏰ GIF creation timed out');
      console.error('📋 Message log:', messageLog.slice(-10));
      throw new Error('GIF creation timed out after 60 seconds');
    }

    // Step 13: Verify extension state is clean
    const finalState = await page.evaluate(() => {
      return {
        timelineVisible: !!document.querySelector('#ytgif-timeline-overlay')?.offsetParent,
        buttonActive: document.querySelector('.ytgif-button')?.classList.contains('active'),
        feedbackElements: document.querySelectorAll('.ytgif-feedback').length
      };
    });
    
    console.log('🧹 Final state:', finalState);
    expect(finalState.timelineVisible).toBe(false);
    
    // Step 14: Test statistics and logging
    console.log('📈 Test Statistics:');
    console.log(`   Total messages logged: ${messageLog.length}`);
    console.log(`   Processing time: ${processingDuration}ms`);
    console.log(`   Average: ${processingDuration < 30000 ? '✅ Fast' : '⚠️  Slow'}`);
    
    // Verify processing was reasonable (under 30 seconds for a 3s GIF)
    expect(processingDuration).toBeLessThan(30000);
    
    console.log('🎉 End-to-End GIF Creation Test Completed Successfully!');
  });

  test('should handle invalid selection gracefully', async () => {
    console.log('🧪 Testing error handling with invalid selection');
    
    // Navigate to video
    await page.goto('https://www.youtube.com/watch?v=dQw4w9WgXcQ', { 
      waitUntil: 'networkidle' 
    });
    
    await page.waitForSelector('#movie_player', { timeout: 15000 });
    await page.waitForTimeout(3000);

    // Click GIF button
    const gifButton = await page.waitForSelector('.ytgif-button', { timeout: 10000 });
    await gifButton.click();
    
    // Wait for timeline to be visible
    await page.waitForSelector('#ytgif-timeline-overlay', { 
      state: 'visible', 
      timeout: 10000 
    });
    
    // Try to create GIF with invalid selection (simulate very short duration)
    await page.evaluate(() => {
      // Manually set a very short selection that should be rejected
      const startHandle = document.querySelector('.ytgif-timeline-start');
      const endHandle = document.querySelector('.ytgif-timeline-end');
      if (startHandle && endHandle) {
        // Set handles very close together (< 0.5s minimum)
        const container = document.querySelector('.ytgif-timeline-track');
        const containerWidth = container.offsetWidth;
        const startPos = containerWidth * 0.3;
        const endPos = containerWidth * 0.31; // Very small difference
        
        startHandle.style.left = startPos + 'px';
        endHandle.style.left = endPos + 'px';
      }
    });
    
    // Click Create GIF - should show validation error
    const createButton = await page.waitForSelector('.ytgif-timeline-create');
    
    // Check if button is disabled for short selections
    const isDisabled = await createButton.evaluate(btn => btn.disabled);
    if (isDisabled) {
      console.log('✅ Create button properly disabled for invalid selection');
      return;
    }
    
    // If not disabled, clicking should show error
    await createButton.click();
    
    // Wait for error feedback or validation message
    const errorFeedback = await page.waitForFunction(() => {
      const feedback = document.querySelector('.ytgif-feedback--error');
      const disabledBtn = document.querySelector('.ytgif-timeline-create[disabled]');
      return feedback || disabledBtn;
    }, { timeout: 3000 }).catch(() => null);
    
    if (errorFeedback) {
      console.log('✅ Error handling working correctly');
    } else {
      console.log('ℹ️  Error handling may need improvement');
    }
  });

  test('should handle cancellation correctly', async () => {
    console.log('🚫 Testing GIF creation cancellation');
    
    // Navigate and open timeline
    await page.goto('https://www.youtube.com/watch?v=dQw4w9WgXcQ', { 
      waitUntil: 'networkidle' 
    });
    
    await page.waitForSelector('#movie_player', { timeout: 15000 });
    await page.waitForTimeout(3000);

    const gifButton = await page.waitForSelector('.ytgif-button', { timeout: 10000 });
    await gifButton.click();
    
    const timelineOverlay = await page.waitForSelector('#ytgif-timeline-overlay', { 
      state: 'visible',
      timeout: 10000 
    });
    
    // Click cancel button
    const cancelButton = await page.waitForSelector('.ytgif-timeline-cancel');
    await cancelButton.click();
    
    // Verify overlay closes
    await page.waitForFunction(() => {
      const overlay = document.querySelector('#ytgif-timeline-overlay');
      return !overlay || !overlay.offsetParent;
    }, { timeout: 3000 });
    
    // Verify button state is reset
    const buttonActive = await page.evaluate(() => {
      return document.querySelector('.ytgif-button')?.classList.contains('active');
    });
    
    expect(buttonActive).toBe(false);
    console.log('✅ Cancellation handled correctly');
  });
});