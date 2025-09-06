const { test, expect, chromium } = require('@playwright/test');
const path = require('path');

test('Debug service worker and extension context', async () => {
  const extensionPath = path.join(__dirname, '..', 'dist');
  
  const browser = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--enable-logging',
      '--log-level=0'
    ],
    viewport: { width: 1280, height: 720 }
  });

  const page = await browser.newPage();
  
  console.log('🔧 Testing extension loading...');
  
  // Navigate to extensions page to check if our extension loaded
  await page.goto('chrome://extensions/', { waitUntil: 'load' });
  await page.waitForTimeout(2000);
  
  // Check if our extension is visible (this will fail but we can see the page)
  try {
    const extensionCards = await page.$$eval('extensions-item', items => 
      items.map(item => ({
        name: item.shadowRoot.querySelector('#name')?.textContent,
        id: item.id,
        enabled: item.shadowRoot.querySelector('#enableToggle')?.checked
      }))
    );
    console.log('🔧 Extensions found:', extensionCards);
  } catch (e) {
    console.log('🔧 Cannot access extensions page (expected due to shadow DOM)');
  }
  
  // Navigate to YouTube and try to access extension context
  await page.goto('https://www.youtube.com/watch?v=dQw4w9WgXcQ', { 
    waitUntil: 'networkidle' 
  });

  await page.waitForSelector('#movie_player', { timeout: 15000 });
  await page.waitForTimeout(3000);

  console.log('🔧 Testing Chrome APIs in content script...');
  
  const apiTest = await page.evaluate(() => {
    const results = {};
    
    // Test Chrome APIs
    results.chromeExists = typeof chrome !== 'undefined';
    results.runtimeExists = typeof chrome !== 'undefined' && !!chrome.runtime;
    results.runtimeId = typeof chrome !== 'undefined' && chrome.runtime ? chrome.runtime.id : null;
    results.lastError = typeof chrome !== 'undefined' && chrome.runtime ? chrome.runtime.lastError : null;
    
    // Test extension specific functions
    results.canGetManifest = false;
    try {
      if (chrome && chrome.runtime && chrome.runtime.getManifest) {
        const manifest = chrome.runtime.getManifest();
        results.canGetManifest = true;
        results.manifestVersion = manifest.manifest_version;
        results.extensionName = manifest.name;
      }
    } catch (e) {
      results.manifestError = e.message;
    }
    
    // Test message sending
    results.canSendMessage = false;
    if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
      results.canSendMessage = true;
    }
    
    return results;
  });
  
  console.log('🔧 Chrome API test results:', apiTest);
  
  // Try to manually trigger the extension
  console.log('🔧 Testing manual extension trigger...');
  
  const manualTrigger = await page.evaluate(() => {
    // Look for our button
    const button = document.querySelector('.ytgif-button');
    if (!button) return { error: 'Button not found' };
    
    // Check if the button has any data attributes or special properties
    const buttonInfo = {
      hasOnClick: !!button.onclick,
      hasEventListeners: !!button.addEventListener,
      attributes: Array.from(button.attributes).map(attr => ({ name: attr.name, value: attr.value })),
      parentElement: button.parentElement?.tagName,
      classList: Array.from(button.classList)
    };
    
    console.log('[Manual] Button info:', buttonInfo);
    
    // Try to manually call the click handler if we can find it
    try {
      // Simulate a proper click event
      const clickEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window
      });
      
      button.dispatchEvent(clickEvent);
      
      return { success: true, buttonInfo };
    } catch (e) {
      return { error: e.message, buttonInfo };
    }
  });
  
  console.log('🔧 Manual trigger result:', manualTrigger);
  
  // Check if content script is actually running by looking for global variables
  console.log('🔧 Checking content script globals...');
  
  const globalCheck = await page.evaluate(() => {
    const globals = {};
    
    // Check for common extension global variables
    const possibleGlobals = [
      'YouTubeGifMaker', 'contentScript', 'gifMaker', 'ytgif',
      '__extension__', '__content__', 'extensionLoaded'
    ];
    
    possibleGlobals.forEach(name => {
      globals[name] = typeof window[name] !== 'undefined' ? typeof window[name] : 'undefined';
    });
    
    // Check for any global that might be from our extension
    const allGlobals = Object.getOwnPropertyNames(window).filter(name => 
      name.toLowerCase().includes('gif') || 
      name.toLowerCase().includes('ytube') || 
      name.toLowerCase().includes('extension')
    );
    
    globals.matchingGlobals = allGlobals;
    
    return globals;
  });
  
  console.log('🔧 Global variables check:', globalCheck);
  
  await page.waitForTimeout(5000);
  
  // Final check for any timeline elements after waiting
  const finalCheck = await page.$$eval('[id*="timeline"], [class*="timeline"], [id*="ytgif"], [class*="ytgif"]', 
    elements => elements.length
  );
  
  console.log(`🔧 Final element count with ytgif/timeline: ${finalCheck}`);
  
  await browser.close();
});