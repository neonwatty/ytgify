const { test, expect, chromium } = require('@playwright/test');
const path = require('path');

test('Wizard GIF Creation Complete Flow', async () => {
  test.setTimeout(120000);
  
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
  
  // Capture all logs
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('Processing') || text.includes('Encoding') || 
        text.includes('GIF') || text.includes('Wizard') || 
        text.includes('progress')) {
      console.log(`[${msg.type()}]`, text);
    }
  });
  
  console.log('\n=== Loading YouTube ===');
  await page.goto('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  await page.waitForSelector('.html5-video-player', { timeout: 10000 });
  await page.waitForTimeout(3000);
  
  // Click GIF button
  const button = await page.waitForSelector('.ytgif-button', { timeout: 10000 });
  console.log('\n=== Clicking GIF Button ===');
  await button.click();
  await page.waitForTimeout(2000);
  
  // Verify wizard overlay appeared
  const wizardOverlay = await page.$('#ytgif-wizard-overlay');
  expect(wizardOverlay).toBeTruthy();
  console.log('✓ Wizard overlay appeared');
  
  // Wait for wizard to auto-advance from welcome to quick capture
  console.log('Waiting for wizard to auto-advance to Quick Capture screen...');
  await page.waitForTimeout(2000);
  
  // Verify we're on the Quick Capture screen
  const quickCaptureScreen = await page.waitForSelector('.ytgif-quick-capture-screen', { timeout: 5000 });
  expect(quickCaptureScreen).toBeTruthy();
  console.log('\n=== On Quick Capture Screen ===');
  
  // Should be on quick capture screen - click Create GIF
  const createGifBtn = await page.$('button:has-text("Create GIF")');
  expect(createGifBtn).toBeTruthy();
  console.log('\n=== Starting GIF Creation ===');
  await createGifBtn.click();
  
  // Monitor screen changes during processing
  let processingStarted = false;
  let successShown = false;
  let progressUpdates = [];
  
  for (let i = 0; i < 60; i++) { // Check for 30 seconds
    await page.waitForTimeout(500);
    
    const screenState = await page.evaluate(() => {
      const processingScreen = document.querySelector('.ytgif-processing-screen');
      const successScreen = document.querySelector('.ytgif-success-screen');
      const progressCircle = document.querySelector('.ytgif-progress-circle-text');
      const statusText = document.querySelector('.ytgif-status-text');
      const stageInfo = document.querySelector('.ytgif-stage-info span');
      
      return {
        processingVisible: processingScreen ? window.getComputedStyle(processingScreen).display !== 'none' : false,
        successVisible: successScreen ? window.getComputedStyle(successScreen).display !== 'none' : false,
        progressText: progressCircle?.textContent,
        statusMessage: statusText?.textContent,
        stage: stageInfo?.textContent,
        // Check all screens
        screens: {
          welcome: !!document.querySelector('.ytgif-welcome-screen:not([style*="display: none"])'),
          action: !!document.querySelector('.ytgif-action-screen:not([style*="display: none"])'),
          quickCapture: !!document.querySelector('.ytgif-quick-capture-screen:not([style*="display: none"])'),
          customRange: !!document.querySelector('.ytgif-custom-range-screen:not([style*="display: none"])'),
          processing: !!document.querySelector('.ytgif-processing-screen:not([style*="display: none"])'),
          success: !!document.querySelector('.ytgif-success-screen:not([style*="display: none"])')
        }
      };
    });
    
    if (screenState.processingVisible && !processingStarted) {
      processingStarted = true;
      console.log('\n✓ Processing screen appeared');
    }
    
    if (screenState.progressText && screenState.progressText !== '0%') {
      progressUpdates.push({
        progress: screenState.progressText,
        status: screenState.statusMessage,
        stage: screenState.stage
      });
      console.log(`Progress: ${screenState.progressText} - ${screenState.statusMessage} (${screenState.stage})`);
    }
    
    if (screenState.successVisible) {
      successShown = true;
      console.log('\n✓ Success screen appeared!');
      break;
    }
    
    // Log current visible screen
    const visibleScreen = Object.entries(screenState.screens)
      .find(([name, visible]) => visible);
    if (visibleScreen && i % 4 === 0) { // Log every 2 seconds
      console.log(`Current screen: ${visibleScreen[0]}`);
    }
  }
  
  // Final assertions
  console.log('\n=== Results ===');
  console.log(`Processing screen shown: ${processingStarted}`);
  console.log(`Success screen shown: ${successShown}`);
  console.log(`Progress updates captured: ${progressUpdates.length}`);
  
  if (progressUpdates.length > 0) {
    console.log('\nSample progress updates:');
    progressUpdates.slice(0, 5).forEach(update => {
      console.log(`  - ${update.progress}: ${update.status}`);
    });
  }
  
  // Take final screenshot
  await page.screenshot({ path: 'tests/screenshots/wizard-final.png' });
  
  // Check if GIF was saved
  const savedGifs = await page.evaluate(() => {
    return new Promise(resolve => {
      const request = indexedDB.open('YouTubeGifStore');
      request.onsuccess = (event) => {
        const db = event.target.result;
        if (db.objectStoreNames.contains('gifs')) {
          const transaction = db.transaction(['gifs'], 'readonly');
          const store = transaction.objectStore('gifs');
          const countRequest = store.count();
          countRequest.onsuccess = () => {
            resolve(countRequest.result);
          };
        } else {
          resolve(0);
        }
      };
      request.onerror = () => resolve(0);
    });
  });
  
  console.log(`\nGIFs saved in database: ${savedGifs}`);
  
  await browser.close();
  
  // Assertions
  expect(processingStarted || successShown).toBeTruthy();
  expect(savedGifs).toBeGreaterThan(0);
});