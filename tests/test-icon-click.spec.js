const { test, expect, chromium } = require('@playwright/test');
const path = require('path');

test.describe('Extension Icon Click Test', () => {
  let browser;
  let context;
  let page;
  let serviceWorker;

  test.beforeAll(async () => {
    console.log('Starting browser with extension...');
    
    // Launch browser with extension
    const pathToExtension = path.join(process.cwd(), 'dist');
    console.log('Extension path:', pathToExtension);
    
    browser = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        '--auto-open-devtools-for-tabs'
      ],
      viewport: { width: 1280, height: 720 }
    });

    // Get the background page (service worker)
    serviceWorker = browser.serviceWorkers()[0] || (await browser.waitForEvent('serviceworker'));
    console.log('Service worker found:', !!serviceWorker);

    // Create a new page
    page = await browser.newPage();
    
    // Enable console logging
    page.on('console', msg => {
      console.log(`[PAGE Console ${msg.type()}]:`, msg.text());
    });

    // Monitor service worker console
    if (serviceWorker) {
      serviceWorker.on('console', msg => {
        console.log(`[SERVICE WORKER Console ${msg.type()}]:`, msg.text());
      });
    }
  });

  test.afterAll(async () => {
    await browser?.close();
  });

  test('should trigger wizard when extension icon is clicked', async () => {
    console.log('\n=== Starting Extension Icon Click Test ===\n');
    
    // Navigate to a YouTube video
    console.log('1. Navigating to YouTube video...');
    await page.goto('https://www.youtube.com/watch?v=jNQXAC9IVRw', {
      waitUntil: 'networkidle'
    });
    
    // Wait for video to load
    await page.waitForSelector('video', { timeout: 10000 });
    console.log('2. YouTube video loaded');
    
    // Get extension ID
    const extensions = await browser.newPage();
    await extensions.goto('chrome://extensions/');
    await extensions.waitForTimeout(1000);
    
    // Try to find the extension ID from the page
    const extensionInfo = await extensions.evaluate(() => {
      const extensions = document.querySelector('extensions-manager');
      if (!extensions || !extensions.shadowRoot) return null;
      
      const items = extensions.shadowRoot.querySelectorAll('extensions-item');
      for (const item of items) {
        const nameElement = item.shadowRoot?.querySelector('#name');
        if (nameElement?.textContent?.includes('YouTube GIF Maker')) {
          const idElement = item.shadowRoot?.querySelector('#extension-id');
          return {
            id: idElement?.textContent || item.id,
            name: nameElement.textContent
          };
        }
      }
      return null;
    });
    
    console.log('3. Extension found:', extensionInfo);
    
    if (!extensionInfo) {
      console.error('Extension not found in chrome://extensions');
      return;
    }
    
    // Check service worker logs
    console.log('\n4. Checking service worker status...');
    if (serviceWorker) {
      const swLogs = await serviceWorker.evaluate(() => {
        // Try to check if the listener is registered
        return {
          hasActionListener: typeof chrome !== 'undefined' && chrome.action,
          location: self.location.href
        };
      });
      console.log('Service worker info:', swLogs);
    }
    
    // Go back to YouTube page
    await page.bringToFront();
    await page.waitForTimeout(1000);
    
    // Method 1: Try clicking via chrome.action API
    console.log('\n5. Attempting to trigger extension via chrome.action API...');
    try {
      const result = await page.evaluate((extId) => {
        return new Promise((resolve) => {
          // Try to send a message directly to the extension
          chrome.runtime.sendMessage(extId, { 
            type: 'SHOW_WIZARD_DIRECT',
            data: { triggeredBy: 'test' }
          }, (response) => {
            resolve({ success: true, response });
          });
          
          // Timeout after 2 seconds
          setTimeout(() => resolve({ success: false, error: 'Timeout' }), 2000);
        });
      }, extensionInfo.id);
      
      console.log('Direct message result:', result);
    } catch (e) {
      console.log('Could not send message directly:', e.message);
    }
    
    // Method 2: Try to trigger the wizard directly by injecting the call
    console.log('\n6. Attempting to trigger wizard directly in content script...');
    try {
      const wizardResult = await page.evaluate(() => {
        // Check if content script is loaded
        const hasContentScript = document.querySelector('#ytgif-wizard-overlay') || 
                                document.querySelector('#ytgif-timeline-overlay');
        
        // Try to dispatch a custom event
        window.dispatchEvent(new CustomEvent('ytgif-show-wizard', { 
          detail: { triggeredBy: 'test' } 
        }));
        
        // Also try posting a message
        window.postMessage({ 
          type: 'SHOW_WIZARD_DIRECT',
          data: { triggeredBy: 'test' }
        }, '*');
        
        return {
          hasContentScript,
          dispatched: true
        };
      });
      
      console.log('Direct trigger result:', wizardResult);
    } catch (e) {
      console.log('Could not trigger wizard directly:', e.message);
    }
    
    // Wait to see if wizard appears
    console.log('\n7. Waiting for wizard to appear...');
    await page.waitForTimeout(2000);
    
    // Check if wizard is visible
    const wizardVisible = await page.evaluate(() => {
      const wizard = document.querySelector('#ytgif-wizard-overlay');
      const timeline = document.querySelector('#ytgif-timeline-overlay');
      return {
        wizard: wizard ? 'visible' : 'not found',
        timeline: timeline ? 'visible' : 'not found',
        bodyChildren: document.body.children.length
      };
    });
    
    console.log('8. Wizard visibility check:', wizardVisible);
    
    // Take a screenshot for debugging
    await page.screenshot({ 
      path: 'tests/screenshots/icon-click-test.png',
      fullPage: true 
    });
    console.log('9. Screenshot saved to tests/screenshots/icon-click-test.png');
    
    // Check console logs from service worker
    if (serviceWorker) {
      console.log('\n10. Final service worker check...');
      const swState = await serviceWorker.evaluate(() => {
        return {
          url: self.location.href,
          hasChrome: typeof chrome !== 'undefined',
          hasAction: typeof chrome !== 'undefined' && !!chrome.action,
          hasRuntime: typeof chrome !== 'undefined' && !!chrome.runtime
        };
      });
      console.log('Service worker state:', swState);
    }
    
    console.log('\n=== Test Complete ===\n');
  });
});