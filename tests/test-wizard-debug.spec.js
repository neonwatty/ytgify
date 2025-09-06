const { test, expect, chromium } = require('@playwright/test');
const path = require('path');

test.describe('Wizard Debug Tests', () => {
  test('Debug: Check extension loading and button injection', async () => {
    const extensionPath = path.join(__dirname, '..', 'dist');
    console.log('🚀 Loading extension from:', extensionPath);
    
    const browser = await chromium.launch({
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--no-sandbox'
      ],
      slowMo: 1000
    });
    
    const context = await browser.newContext();
    const page = await context.newPage();
    
    // Enable detailed console logging
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('[Content]') || text.includes('[Wizard]') || text.includes('GIF') || text.includes('button')) {
        console.log('PAGE:', text);
      }
    });
    
    page.on('pageerror', error => {
      console.error('PAGE ERROR:', error.message);
    });
    
    // Navigate to YouTube
    console.log('\n📺 Opening YouTube video...');
    await page.goto('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    
    // Wait for player
    await page.waitForSelector('.html5-video-player', { timeout: 10000 });
    console.log('✅ Video player loaded');
    
    // Wait for extension to initialize
    console.log('⏳ Waiting for extension to initialize...');
    await page.waitForTimeout(5000);
    
    // Check for button with multiple selectors
    console.log('\n🔍 Checking for GIF button...');
    const selectors = [
      '.ytp-right-controls .ytgif-button',
      '.ytp-right-controls .ytgif-btn',
      '.ytp-right-controls button[title*="GIF"]',
      '.ytp-chrome-controls .ytgif-button',
      'button.ytgif-button',
      '.ytgif-button'
    ];
    
    let buttonFound = false;
    for (const selector of selectors) {
      const button = await page.$(selector);
      if (button) {
        console.log(`✅ Button found with selector: ${selector}`);
        buttonFound = true;
        
        // Get button properties
        const isVisible = await button.isVisible();
        const boundingBox = await button.boundingBox();
        console.log(`  Visible: ${isVisible}`);
        console.log(`  Position:`, boundingBox);
        
        break;
      }
    }
    
    if (!buttonFound) {
      console.log('❌ GIF button not found');
      
      // Check if controls exist
      const controls = await page.$('.ytp-right-controls');
      if (controls) {
        console.log('✅ YouTube controls found');
        const children = await page.$$('.ytp-right-controls > *');
        console.log(`  Control buttons: ${children.length}`);
        
        // Log all button classes
        for (let i = 0; i < Math.min(children.length, 5); i++) {
          const className = await children[i].getAttribute('class');
          console.log(`    Button ${i}: ${className}`);
        }
      } else {
        console.log('❌ YouTube controls not found');
      }
    }
    
    // Try clicking the button if found
    if (buttonFound) {
      console.log('\n🖱️ Attempting to click GIF button...');
      const button = await page.$('.ytgif-button, .ytgif-btn');
      await button.click();
      
      await page.waitForTimeout(2000);
      
      // Check what appeared
      console.log('\n🔍 Checking for overlay...');
      
      const wizardOverlay = await page.$('#ytgif-wizard-overlay');
      const oldOverlay = await page.$('#ytgif-timeline-overlay');
      const anyOverlay = await page.$('.ytgif-overlay-wizard');
      
      if (wizardOverlay) {
        console.log('✅ New wizard overlay found!');
        const isVisible = await wizardOverlay.isVisible();
        console.log(`  Visible: ${isVisible}`);
      } else if (oldOverlay) {
        console.log('⚠️ Old timeline overlay found (not wizard)');
        const isVisible = await oldOverlay.isVisible();
        console.log(`  Visible: ${isVisible}`);
      } else if (anyOverlay) {
        console.log('✅ Wizard overlay (class-based) found');
        const isVisible = await anyOverlay.isVisible();
        console.log(`  Visible: ${isVisible}`);
      } else {
        console.log('❌ No overlay found');
        
        // Check DOM for any ytgif elements
        const ytgifElements = await page.$$('[id*="ytgif"], [class*="ytgif"]');
        console.log(`\n  Found ${ytgifElements.length} ytgif-related elements in DOM`);
        
        for (let i = 0; i < Math.min(ytgifElements.length, 5); i++) {
          const id = await ytgifElements[i].getAttribute('id');
          const className = await ytgifElements[i].getAttribute('class');
          console.log(`    Element ${i}: id="${id}" class="${className}"`);
        }
      }
      
      // Check for wizard screens
      const screens = [
        { selector: '.ytgif-welcome-screen', name: 'Welcome' },
        { selector: '.ytgif-action-screen', name: 'Action Select' },
        { selector: '.ytgif-quick-capture-screen', name: 'Quick Capture' },
        { selector: '.ytgif-custom-range-screen', name: 'Custom Range' },
        { selector: '.ytgif-processing-screen', name: 'Processing' }
      ];
      
      console.log('\n🔍 Checking for wizard screens...');
      for (const screen of screens) {
        const element = await page.$(screen.selector);
        if (element) {
          const isVisible = await element.isVisible();
          console.log(`  ${screen.name}: ${isVisible ? '✅ visible' : '⚠️ hidden'}`);
        }
      }
    }
    
    // Take screenshot
    await page.screenshot({ path: 'tests/screenshots/debug-wizard-state.png' });
    console.log('\n📸 Screenshot saved: debug-wizard-state.png');
    
    await browser.close();
  });
});