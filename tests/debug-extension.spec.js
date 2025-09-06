const { test, expect, chromium } = require('@playwright/test');
const path = require('path');

test('Debug extension click handler', async () => {
  const extensionPath = path.join(__dirname, '..', 'dist');
  
  const browser = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--no-sandbox',
      '--disable-dev-shm-usage',
    ],
    viewport: { width: 1280, height: 720 }
  });

  const page = await browser.newPage();
  
  // Collect ALL console messages
  const consoleLogs = [];
  page.on('console', msg => {
    consoleLogs.push(`${msg.type()}: ${msg.text()}`);
  });

  // Navigate to YouTube video
  await page.goto('https://www.youtube.com/watch?v=dQw4w9WgXcQ', { 
    waitUntil: 'networkidle' 
  });

  await page.waitForSelector('#movie_player', { timeout: 15000 });
  await page.waitForTimeout(5000); // Give extension time to load

  console.log('🔍 All console messages:');
  consoleLogs.forEach(log => console.log(`  ${log}`));
  
  // Find the GIF button
  const gifButton = await page.waitForSelector('.ytgif-button', { timeout: 10000 });
  expect(gifButton).toBeTruthy();
  
  console.log('✅ Found GIF button');
  
  // Check if extension context is working
  const extensionInfo = await page.evaluate(() => {
    return {
      hasChrome: typeof chrome !== 'undefined',
      hasRuntime: typeof chrome !== 'undefined' && !!chrome.runtime,
      manifestVersion: typeof chrome !== 'undefined' && chrome.runtime ? chrome.runtime.getManifest()?.manifest_version : null,
      extensionId: typeof chrome !== 'undefined' && chrome.runtime ? chrome.runtime.id : null,
      url: window.location.href,
      domain: window.location.hostname
    };
  });
  
  console.log('🔧 Extension context:', extensionInfo);
  
  // Test manual click with debugging
  console.log('🖱️  Clicking button with enhanced debugging...');
  
  const clickResult = await page.evaluate(() => {
    const button = document.querySelector('.ytgif-button');
    if (!button) return { error: 'Button not found' };
    
    // Check if button has click handlers
    const hasClickHandlers = button.onclick !== null;
    const hasEventListeners = button.getEventListeners ? Object.keys(button.getEventListeners()).length > 0 : 'unknown';
    
    console.log('[DEBUG] Button found:', button);
    console.log('[DEBUG] Button onclick:', button.onclick);
    console.log('[DEBUG] Button classList:', button.classList.toString());
    console.log('[DEBUG] Button parentElement:', button.parentElement);
    
    // Trigger click
    button.click();
    
    // Wait a moment and check for any new elements
    setTimeout(() => {
      const overlays = document.querySelectorAll('[id*="timeline"], [class*="timeline"], [class*="ytgif"]');
      console.log('[DEBUG] Post-click overlays found:', overlays.length);
      overlays.forEach((el, i) => {
        console.log(`[DEBUG] Overlay ${i}:`, el.tagName, el.id, el.className);
      });
    }, 1000);
    
    return {
      success: true,
      hasClickHandlers,
      hasEventListeners,
      buttonClass: button.className
    };
  });
  
  console.log('🔧 Click result:', clickResult);
  
  // Wait and check for timeline overlay
  await page.waitForTimeout(3000);
  
  // Check for any elements that might be the timeline
  const timelineElements = await page.$$eval('[id*="timeline"], [class*="timeline"], [id*="ytgif"], [class*="ytgif"]', elements => 
    elements.map(el => ({
      tagName: el.tagName,
      id: el.id,
      className: el.className,
      visible: el.offsetParent !== null,
      textContent: el.textContent ? el.textContent.substring(0, 50) : ''
    }))
  );
  
  console.log('🔧 Potential timeline elements:');
  console.table(timelineElements);
  
  // Check background script communication
  console.log('🔧 Testing background script communication...');
  
  const messageTest = await page.evaluate(async () => {
    if (typeof chrome === 'undefined' || !chrome.runtime) {
      return { error: 'Chrome runtime not available' };
    }
    
    try {
      // Try to send a message to background script
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'TEST_MESSAGE' }, (response) => {
          resolve(response || { error: chrome.runtime.lastError?.message || 'No response' });
        });
      });
      return { success: true, response };
    } catch (error) {
      return { error: error.message };
    }
  });
  
  console.log('🔧 Background script test:', messageTest);
  
  // Final console log dump
  console.log('📋 Final console log count:', consoleLogs.length);
  if (consoleLogs.length > 50) {
    console.log('📋 Recent console messages:');
    consoleLogs.slice(-20).forEach(log => console.log(`  ${log}`));
  }
  
  await browser.close();
});