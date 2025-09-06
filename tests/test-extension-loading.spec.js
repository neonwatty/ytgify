const { test, expect, chromium } = require('@playwright/test');
const path = require('path');

test('Debug: Check extension loading and service worker', async () => {
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
  
  // Get service worker context
  const serviceWorkers = browser.serviceWorkers();
  console.log('Service workers found:', serviceWorkers.length);
  
  if (serviceWorkers.length > 0) {
    // Check service worker console
    serviceWorkers[0].on('console', msg => {
      console.log('[Service Worker]', msg.text());
    });
  }
  
  // Open new tab with YouTube
  const page = await browser.newPage();
  
  // Capture content script logs
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('YTGif') || text.includes('[Content]')) {
      console.log('[Content Script]', text);
    }
  });
  
  console.log('Navigating to YouTube...');
  await page.goto('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  
  // Wait for video player
  await page.waitForSelector('.html5-video-player', { timeout: 10000 });
  console.log('Video player loaded');
  
  // Wait for content script initialization
  await page.waitForTimeout(5000);
  
  // Check if content script injected anything
  const hasButton = await page.evaluate(() => {
    const button = document.querySelector('.ytgif-button, .ytp-right-controls .ytgif-button');
    const overlay = document.querySelector('#ytgif-wizard-overlay');
    return {
      button: !!button,
      overlay: !!overlay,
      buttonClasses: button ? button.className : null
    };
  });
  
  console.log('Extension elements:', hasButton);
  
  // Try to check extension internals
  const extensions = await browser.contexts()[0].backgroundPages();
  console.log('Background pages:', extensions.length);
  
  await browser.close();
});