const { test, expect, chromium } = require('@playwright/test');
const path = require('path');

test.describe('Direct Wizard Activation Test', () => {
  let browser;
  let page;

  test.beforeAll(async () => {
    console.log('Starting browser with extension...');
    
    // Launch browser with extension
    const pathToExtension = path.join(process.cwd(), 'dist');
    console.log('Extension path:', pathToExtension);
    
    browser = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`
      ],
      viewport: { width: 1280, height: 720 }
    });

    // Create a new page
    page = await browser.newPage();
    
    // Enable console logging
    page.on('console', msg => {
      const text = msg.text();
      // Filter for our specific logs
      if (text.includes('[WIZARD') || text.includes('[Content]') || text.includes('[EXTENSION')) {
        console.log(`[PAGE]:`, text);
      }
    });
  });

  test.afterAll(async () => {
    await browser?.close();
  });

  test('should activate wizard via direct message injection', async () => {
    console.log('\n=== Testing Direct Wizard Activation ===\n');
    
    // Navigate to a YouTube video
    console.log('1. Navigating to YouTube video...');
    await page.goto('https://www.youtube.com/watch?v=jNQXAC9IVRw', {
      waitUntil: 'networkidle'
    });
    
    // Wait for video to load
    await page.waitForSelector('video', { timeout: 10000 });
    console.log('2. YouTube video loaded');
    
    // Wait for content script to initialize
    await page.waitForTimeout(2000);
    
    // Directly call the handleDirectWizardActivation function
    console.log('3. Attempting to call handleDirectWizardActivation directly...');
    const result = await page.evaluate(() => {
      // Try to find the content script instance and call the method
      console.log('[TEST] Attempting to trigger wizard activation...');
      
      // Send a message that the content script should receive
      window.postMessage({
        type: 'SHOW_WIZARD_DIRECT',
        data: { triggeredBy: 'test' }
      }, '*');
      
      // Also try dispatching the message via chrome runtime if available
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({
          type: 'SHOW_WIZARD_DIRECT',
          data: { triggeredBy: 'test' }
        }, (response) => {
          console.log('[TEST] Response from sendMessage:', response);
        });
      }
      
      return { messageSent: true };
    });
    
    console.log('4. Message injection result:', result);
    
    // Wait for potential wizard appearance
    await page.waitForTimeout(3000);
    
    // Check if wizard appeared
    const wizardCheck = await page.evaluate(() => {
      const wizard = document.querySelector('#ytgif-wizard-overlay');
      const timeline = document.querySelector('#ytgif-timeline-overlay');
      const anyOverlay = document.querySelector('[id*="ytgif"], [class*="ytgif"]');
      
      return {
        wizardFound: !!wizard,
        timelineFound: !!timeline,
        anyOverlayFound: !!anyOverlay,
        overlayDetails: anyOverlay ? {
          id: anyOverlay.id,
          className: anyOverlay.className,
          visible: window.getComputedStyle(anyOverlay).display !== 'none'
        } : null
      };
    });
    
    console.log('5. Wizard check result:', wizardCheck);
    
    // Try a different approach - simulate the activateGifMode directly
    console.log('\n6. Trying to simulate activateGifMode...');
    const activationResult = await page.evaluate(async () => {
      // Find video element
      const video = document.querySelector('video');
      if (!video) return { error: 'No video found' };
      
      // Create the showTimelineMessage
      const showTimelineMessage = {
        type: 'SHOW_TIMELINE',
        data: {
          videoDuration: video.duration || 0,
          currentTime: video.currentTime || 0
        }
      };
      
      // Try to trigger the timeline overlay directly
      console.log('[TEST] Sending SHOW_TIMELINE message:', showTimelineMessage);
      
      // Dispatch a custom event
      window.dispatchEvent(new CustomEvent('show-timeline-overlay', {
        detail: showTimelineMessage
      }));
      
      return {
        videoFound: true,
        duration: video.duration,
        currentTime: video.currentTime,
        messageDispatched: true
      };
    });
    
    console.log('7. Direct activation result:', activationResult);
    
    // Final wait and check
    await page.waitForTimeout(2000);
    
    // Take screenshot
    await page.screenshot({ 
      path: 'tests/screenshots/direct-wizard-test.png',
      fullPage: true 
    });
    console.log('8. Screenshot saved to tests/screenshots/direct-wizard-test.png');
    
    // Final check for any overlays
    const finalCheck = await page.evaluate(() => {
      const allDivs = document.querySelectorAll('div');
      const ytgifDivs = [];
      allDivs.forEach(div => {
        if (div.id?.includes('ytgif') || div.className?.includes('ytgif')) {
          ytgifDivs.push({
            id: div.id,
            className: div.className,
            display: window.getComputedStyle(div).display,
            position: window.getComputedStyle(div).position,
            zIndex: window.getComputedStyle(div).zIndex
          });
        }
      });
      return ytgifDivs;
    });
    
    console.log('9. All YTGIF elements found:', finalCheck);
    
    console.log('\n=== Test Complete ===\n');
  });
});