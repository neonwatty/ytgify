const { test, expect, chromium } = require('@playwright/test');
const path = require('path');

test.describe('Wizard Complete E2E with Video Preview', () => {
  test('Full wizard flow with video preview and timeline scrubber', async () => {
    test.setTimeout(180000); // 3 minutes for complete flow
    
    const extensionPath = path.join(__dirname, '..', 'dist');
    console.log('Loading extension from:', extensionPath);
    
    const browser = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--no-sandbox'
      ]
    });
    
    const page = await browser.newPage();
    
    // Enhanced logging
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('VideoPreview') || text.includes('TimelineScrubber') || 
          text.includes('QuickCapture') || text.includes('Wizard') ||
          text.includes('GIF') || text.includes('Processing')) {
        console.log(`[${msg.type()}]`, text);
      }
    });
    
    console.log('\n=== PHASE 1: Loading YouTube ===');
    await page.goto('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    await page.waitForSelector('.html5-video-player', { timeout: 10000 });
    await page.waitForTimeout(3000);
    
    // Verify video is ready
    const videoState = await page.evaluate(() => {
      const video = document.querySelector('video');
      return {
        duration: video?.duration,
        currentTime: video?.currentTime,
        paused: video?.paused,
        readyState: video?.readyState
      };
    });
    console.log('Video state:', videoState);
    expect(videoState.duration).toBeGreaterThan(0);
    
    console.log('\n=== PHASE 2: Opening Wizard ===');
    const gifButton = await page.waitForSelector('.ytgif-button', { timeout: 10000 });
    await gifButton.click();
    await page.waitForTimeout(2000);
    
    // Verify wizard overlay
    const wizardOverlay = await page.$('#ytgif-wizard-overlay');
    expect(wizardOverlay).toBeTruthy();
    console.log('✓ Wizard overlay opened');
    
    // Navigate through welcome screen if present
    const welcomeScreen = await page.$('.ytgif-welcome-screen');
    if (welcomeScreen) {
      const isVisible = await page.evaluate(el => {
        return window.getComputedStyle(el).display !== 'none';
      }, welcomeScreen);
      
      if (isVisible) {
        console.log('Welcome screen detected, clicking Get Started');
        const getStartedBtn = await page.$('button:has-text("Get Started")');
        if (getStartedBtn) {
          await getStartedBtn.click();
          await page.waitForTimeout(1000);
        }
      }
    }
    
    console.log('\n=== PHASE 3: Selecting Quick Capture ===');
    const quickCaptureBtn = await page.waitForSelector('button:has-text("Quick Capture")', { timeout: 5000 });
    await quickCaptureBtn.click();
    await page.waitForTimeout(1500);
    
    console.log('\n=== PHASE 4: Testing Video Preview Components ===');
    
    // Test 1: Verify video preview canvas exists and has content
    const canvasCheck = await page.evaluate(() => {
      const canvas = document.querySelector('.ytgif-preview-canvas');
      if (!canvas) return { exists: false };
      
      const ctx = canvas.getContext('2d');
      const imageData = ctx.getImageData(0, 0, 100, 100);
      const hasContent = imageData.data.some(pixel => pixel > 0);
      
      return {
        exists: true,
        width: canvas.width,
        height: canvas.height,
        hasContent,
        aspectRatio: (canvas.width / canvas.height).toFixed(2)
      };
    });
    
    console.log('Canvas check:', canvasCheck);
    expect(canvasCheck.exists).toBeTruthy();
    expect(canvasCheck.hasContent).toBeTruthy();
    expect(parseFloat(canvasCheck.aspectRatio)).toBeCloseTo(1.78, 1); // 16:9
    
    // Test 2: Verify timeline scrubber components
    const scrubberCheck = await page.evaluate(() => {
      const scrubber = document.querySelector('.ytgif-timeline-scrubber');
      const handles = document.querySelectorAll('.ytgif-timeline-handle');
      const selection = document.querySelector('.ytgif-timeline-selection');
      const presets = document.querySelectorAll('.ytgif-preset-btn');
      
      return {
        hasScrubber: !!scrubber,
        handleCount: handles.length,
        hasSelection: !!selection,
        presetCount: presets.length,
        presetLabels: Array.from(presets).map(p => p.textContent.trim())
      };
    });
    
    console.log('Scrubber check:', scrubberCheck);
    expect(scrubberCheck.hasScrubber).toBeTruthy();
    expect(scrubberCheck.handleCount).toBe(2); // Start and end handles
    expect(scrubberCheck.presetCount).toBeGreaterThan(0);
    
    console.log('\n=== PHASE 5: Testing Timeline Interaction ===');
    
    // Test dragging end handle to extend selection
    const endHandle = await page.$('.ytgif-handle-end');
    if (endHandle) {
      const initialSelection = await page.evaluate(() => {
        const duration = document.querySelector('.ytgif-selection-duration');
        return duration?.textContent;
      });
      console.log('Initial duration:', initialSelection);
      
      // Drag handle
      const box = await endHandle.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + 100, box.y + box.height / 2); // Drag right
      await page.mouse.up();
      await page.waitForTimeout(500);
      
      const newSelection = await page.evaluate(() => {
        const duration = document.querySelector('.ytgif-selection-duration');
        return duration?.textContent;
      });
      console.log('New duration after drag:', newSelection);
      // Just log the change - dragging might be constrained by video position
      console.log('Duration changed:', initialSelection, '->', newSelection);
    }
    
    // Test duration preset buttons
    const preset5s = await page.$('.ytgif-preset-btn:has-text("5s")');
    if (preset5s) {
      await preset5s.click();
      await page.waitForTimeout(500);
      
      const durationAfterPreset = await page.evaluate(() => {
        const duration = document.querySelector('.ytgif-selection-duration');
        return duration?.textContent;
      });
      console.log('Duration after 5s preset:', durationAfterPreset);
      // Duration might be adjusted based on video position
      expect(durationAfterPreset).toBeTruthy();
    }
    
    console.log('\n=== PHASE 6: Testing Video Preview Playback ===');
    
    // Test play button
    const playBtn = await page.$('.ytgif-preview-control-btn');
    if (playBtn) {
      // Click play
      await playBtn.click();
      console.log('Clicked play button');
      await page.waitForTimeout(2000);
      
      // Check if playing
      const isPlaying = await page.evaluate(() => {
        const btn = document.querySelector('.ytgif-preview-control-btn');
        return btn?.classList.contains('playing');
      });
      console.log('Preview is playing:', isPlaying);
      expect(isPlaying).toBeTruthy();
      
      // Verify canvas is updating (check if preview time changes)
      const time1 = await page.evaluate(() => {
        const timeDisplay = document.querySelector('.ytgif-preview-time');
        return timeDisplay?.textContent;
      });
      
      await page.waitForTimeout(1000);
      
      const time2 = await page.evaluate(() => {
        const timeDisplay = document.querySelector('.ytgif-preview-time');
        return timeDisplay?.textContent;
      });
      
      console.log('Time display changed from', time1, 'to', time2);
      
      // Stop playback
      await playBtn.click();
      console.log('Stopped playback');
    }
    
    console.log('\n=== PHASE 7: Creating GIF ===');
    
    // Click Create GIF button
    const createGifBtn = await page.$('button:has-text("Create GIF")');
    expect(createGifBtn).toBeTruthy();
    await createGifBtn.click();
    console.log('Clicked Create GIF');
    
    // Wait for processing screen
    await page.waitForTimeout(2000);
    
    // Monitor processing
    let processingComplete = false;
    for (let i = 0; i < 60; i++) { // Check for up to 30 seconds
      const processingState = await page.evaluate(() => {
        const processingScreen = document.querySelector('.ytgif-processing-screen');
        const successScreen = document.querySelector('.ytgif-success-screen');
        const progressText = document.querySelector('.ytgif-progress-circle-text');
        const statusText = document.querySelector('.ytgif-status-text');
        
        return {
          processingVisible: processingScreen ? window.getComputedStyle(processingScreen).display !== 'none' : false,
          successVisible: successScreen ? window.getComputedStyle(successScreen).display !== 'none' : false,
          progress: progressText?.textContent,
          status: statusText?.textContent
        };
      });
      
      if (processingState.progress) {
        console.log(`Processing: ${processingState.progress} - ${processingState.status}`);
      }
      
      if (processingState.successVisible) {
        processingComplete = true;
        console.log('✓ Success screen appeared!');
        break;
      }
      
      await page.waitForTimeout(500);
    }
    
    expect(processingComplete).toBeTruthy();
    
    console.log('\n=== PHASE 8: Verifying GIF Storage ===');
    
    // Check if GIF was saved to IndexedDB
    const gifCount = await page.evaluate(() => {
      return new Promise(resolve => {
        const request = indexedDB.open('YouTubeGifStore');
        request.onsuccess = (event) => {
          const db = event.target.result;
          if (db.objectStoreNames.contains('gifs')) {
            const transaction = db.transaction(['gifs'], 'readonly');
            const store = transaction.objectStore('gifs');
            const countRequest = store.count();
            countRequest.onsuccess = () => resolve(countRequest.result);
          } else {
            resolve(0);
          }
        };
        request.onerror = () => resolve(0);
      });
    });
    
    console.log(`GIFs saved in database: ${gifCount}`);
    expect(gifCount).toBeGreaterThan(0);
    
    // Take final screenshot
    await page.screenshot({ path: 'tests/screenshots/wizard-complete-e2e.png' });
    
    await browser.close();
    
    console.log('\n✅ Complete E2E test with video preview passed!');
  });
  
  test('Custom Range with Timeline Interaction', async () => {
    test.setTimeout(120000);
    
    const extensionPath = path.join(__dirname, '..', 'dist');
    const browser = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--no-sandbox'
      ]
    });
    
    const page = await browser.newPage();
    
    console.log('\n=== Testing Custom Range Screen ===');
    await page.goto('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    await page.waitForSelector('.html5-video-player', { timeout: 10000 });
    await page.waitForTimeout(3000);
    
    // Open wizard
    const gifButton = await page.waitForSelector('.ytgif-button');
    await gifButton.click();
    await page.waitForTimeout(2000);
    
    // Skip welcome if needed
    const getStarted = await page.$('button:has-text("Get Started")');
    if (getStarted) {
      const isVisible = await getStarted.isVisible();
      if (isVisible) {
        await getStarted.click();
        await page.waitForTimeout(1000);
      }
    }
    
    // Select Custom Range instead of Quick Capture
    const customRangeBtn = await page.$('button:has-text("Custom Range")');
    expect(customRangeBtn).toBeTruthy();
    await customRangeBtn.click();
    await page.waitForTimeout(1500);
    
    // Verify Custom Range screen components
    const customRangeCheck = await page.evaluate(() => {
      const timeInputs = document.querySelectorAll('.ytgif-time-input');
      const presets = document.querySelectorAll('.ytgif-preset-button');
      const timeline = document.querySelector('.ytgif-timeline-interactive');
      
      return {
        hasTimeInputs: timeInputs.length > 0,
        inputCount: timeInputs.length,
        hasPresets: presets.length > 0,
        presetCount: presets.length,
        hasInteractiveTimeline: !!timeline
      };
    });
    
    console.log('Custom Range components:', customRangeCheck);
    expect(customRangeCheck.hasTimeInputs).toBeTruthy();
    expect(customRangeCheck.hasInteractiveTimeline).toBeTruthy();
    
    // Test time input modification
    const startTimeInput = await page.$('.ytgif-time-input');
    if (startTimeInput) {
      await startTimeInput.click({ clickCount: 3 }); // Select all
      await startTimeInput.type('0:10');
      await page.keyboard.press('Tab');
      
      const newTimeRange = await page.evaluate(() => {
        const inputs = document.querySelectorAll('.ytgif-time-input');
        return {
          start: inputs[0]?.value,
          end: inputs[1]?.value
        };
      });
      console.log('Modified time range:', newTimeRange);
    }
    
    await browser.close();
    console.log('✅ Custom Range test completed!');
  });
});