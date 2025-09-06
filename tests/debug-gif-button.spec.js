import { test, expect, chromium } from '@playwright/test';
import path from 'path';

const EXTENSION_PATH = path.join(process.cwd(), 'dist');
const TEST_VIDEO_URL = 'https://www.youtube.com/watch?v=jNQXAC9IVRw';

test.describe('Debug GIF Button', () => {
  let context;
  let page;

  test.beforeAll(async () => {
    console.log('Loading extension from:', EXTENSION_PATH);
    
    context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage'
      ],
      viewport: { width: 1280, height: 720 }
    });
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test('debug GIF button and UI elements', async () => {
    page = await context.newPage();
    
    // Set up console logging
    page.on('console', msg => {
      console.log('Page console:', msg.type(), msg.text());
    });
    
    await page.goto(TEST_VIDEO_URL);
    await page.waitForSelector('video', { timeout: 10000 });
    console.log('Video loaded');
    
    // Wait for extension to inject elements
    await page.waitForTimeout(5000);
    
    // Debug: Find all buttons in the player controls
    const playerButtons = await page.evaluate(() => {
      const rightControls = document.querySelector('.ytp-right-controls');
      const leftControls = document.querySelector('.ytp-left-controls');
      const allButtons = document.querySelectorAll('.ytp-button');
      
      return {
        hasRightControls: !!rightControls,
        hasLeftControls: !!leftControls,
        rightControlButtons: rightControls ? rightControls.querySelectorAll('button').length : 0,
        totalYtpButtons: allButtons.length,
        buttonClasses: Array.from(allButtons).map(b => b.className),
        ytgifButton: !!document.querySelector('.ytgif-button'),
        ytgifButtonParent: document.querySelector('.ytgif-button')?.parentElement?.className,
        injectedElements: {
          timeline: !!document.querySelector('#ytgif-timeline-overlay'),
          button: !!document.querySelector('.ytgif-button'),
          anyYtgif: !!document.querySelector('[class*="ytgif"]'),
        }
      };
    });
    
    console.log('Player button analysis:', JSON.stringify(playerButtons, null, 2));
    
    // Try to find the GIF button with various selectors
    const selectors = [
      '.ytgif-button',
      '.ytp-button.ytgif-button',
      'button.ytgif-button',
      '.ytp-right-controls button:has(svg)',
      '.ytp-right-controls > button',
      'button[aria-label*="GIF"]',
      'button[title*="GIF"]'
    ];
    
    for (const selector of selectors) {
      const element = await page.$(selector);
      if (element) {
        console.log(`Found element with selector: ${selector}`);
        const info = await element.evaluate(el => ({
          tagName: el.tagName,
          className: el.className,
          id: el.id,
          innerHTML: el.innerHTML.substring(0, 100),
          isVisible: el.offsetParent !== null,
          position: { x: el.offsetLeft, y: el.offsetTop },
          size: { width: el.offsetWidth, height: el.offsetHeight }
        }));
        console.log('Element info:', info);
      }
    }
    
    // Check if extension content script is loaded
    const extensionLoaded = await page.evaluate(() => {
      return typeof window.YouTubeGifMaker !== 'undefined' || 
             !!window.ytgifExtension ||
             !!document.querySelector('[class*="ytgif"]');
    });
    
    console.log('Extension loaded:', extensionLoaded);
    
    // Try clicking the first button that might be our GIF button
    const gifButton = await page.$('.ytgif-button, .ytp-button:has(svg rect)');
    if (gifButton) {
      console.log('Found potential GIF button, clicking...');
      await gifButton.click();
      await page.waitForTimeout(2000);
      
      // Check what happened after click
      const afterClick = await page.evaluate(() => {
        return {
          timeline: !!document.querySelector('#ytgif-timeline-overlay'),
          timelineClasses: document.querySelector('#ytgif-timeline-overlay')?.className,
          anyOverlay: !!document.querySelector('[class*="overlay"]'),
          anyModal: !!document.querySelector('[class*="modal"]'),
          bodyChildren: document.body.children.length,
          ytgifElements: document.querySelectorAll('[class*="ytgif"]').length
        };
      });
      
      console.log('After click state:', afterClick);
    } else {
      console.log('GIF button not found');
    }
    
    // Take screenshot for debugging
    await page.screenshot({ path: 'test-results/debug-player-controls.png', fullPage: true });
    console.log('Screenshot saved to test-results/debug-player-controls.png');
  });
});