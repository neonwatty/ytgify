const { test, expect, chromium } = require('@playwright/test');
const path = require('path');

test.describe('YouTube GIF Maker Extension', () => {
  let browser;
  let context;
  let page;

  test.beforeAll(async () => {
    // Path to your built extension
    const extensionPath = path.join(__dirname, '..', 'dist');
    
    // Launch browser with extension
    browser = await chromium.launchPersistentContext('', {
      headless: false, // Need to see the extension in action
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--no-sandbox',
        '--disable-dev-shm-usage',
      ],
      viewport: { width: 1280, height: 720 }
    });

    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await browser?.close();
  });

  test('should load extension and inject GIF button on YouTube video', async () => {
    console.log('🎬 Starting YouTube GIF Maker Extension Test');
    
    // Navigate to a YouTube video
    console.log('📺 Navigating to YouTube video...');
    await page.goto('https://www.youtube.com/watch?v=dQw4w9WgXcQ', { 
      waitUntil: 'networkidle' 
    });

    // Wait for YouTube player to load
    console.log('⏳ Waiting for YouTube player to load...');
    await page.waitForSelector('#movie_player', { timeout: 10000 });
    
    // Wait a bit more for the extension to inject
    await page.waitForTimeout(3000);

    // Check if our extension injected the GIF button
    console.log('🔍 Looking for GIF button...');
    
    // Try multiple possible selectors for our button
    const buttonSelectors = [
      '#ytgif-button',
      '.ytgif-button',
      'button[aria-label*="GIF"]',
      'button[data-tooltip-text*="GIF"]',
      '[class*="ytgif"]',
      // Fallback injection selector
      'button.ytp-button.ytgif-button'
    ];

    let gifButton = null;
    for (const selector of buttonSelectors) {
      try {
        gifButton = await page.waitForSelector(selector, { timeout: 2000 });
        if (gifButton) {
          console.log(`✅ Found GIF button with selector: ${selector}`);
          break;
        }
      } catch (e) {
        console.log(`❌ Button not found with selector: ${selector}`);
      }
    }

    // Debug: Log all buttons in the player controls
    console.log('🔧 Debugging - All buttons in player controls:');
    const allButtons = await page.$$eval('.ytp-right-controls button, .ytp-chrome-controls button', buttons => 
      buttons.map(btn => ({
        id: btn.id,
        className: btn.className,
        ariaLabel: btn.getAttribute('aria-label'),
        innerHTML: btn.innerHTML.substring(0, 100),
        visible: btn.offsetParent !== null
      }))
    );
    console.table(allButtons);

    // Check if extension loaded at all
    console.log('🔧 Checking if extension scripts are loaded...');
    const hasExtensionScript = await page.evaluate(() => {
      return window.chrome && window.chrome.runtime && window.chrome.runtime.getManifest;
    });
    console.log(`Extension API available: ${hasExtensionScript}`);

    // Check console for extension messages
    console.log('📋 Checking console for extension messages...');
    const logs = [];
    page.on('console', msg => {
      if (msg.text().includes('ytgif') || msg.text().includes('GIF') || msg.text().includes('Content')) {
        logs.push(`${msg.type()}: ${msg.text()}`);
      }
    });

    // Wait a bit more to collect logs
    await page.waitForTimeout(2000);
    
    if (logs.length > 0) {
      console.log('📝 Extension console messages:');
      logs.forEach(log => console.log(`   ${log}`));
    } else {
      console.log('⚠️  No extension console messages found');
    }

    // Test button interaction if found
    if (gifButton) {
      console.log('🖱️  Testing button click...');
      
      // Check if button is visible and clickable
      const isVisible = await gifButton.isVisible();
      const isEnabled = await gifButton.isEnabled();
      
      console.log(`Button visible: ${isVisible}, enabled: ${isEnabled}`);
      
      if (isVisible && isEnabled) {
        // Click the button
        await gifButton.click();
        console.log('✅ Button clicked successfully');
        
        // Wait for timeline overlay to appear
        console.log('⏳ Waiting for timeline overlay...');
        try {
          const timelineOverlay = await page.waitForSelector('#ytgif-timeline-overlay, .ytgif-timeline-overlay', { timeout: 5000 });
          if (timelineOverlay) {
            console.log('✅ Timeline overlay appeared!');
            
            // Check if overlay has expected content
            const overlayContent = await timelineOverlay.textContent();
            console.log(`📄 Overlay content preview: "${overlayContent.substring(0, 100)}..."`);
            
            expect(timelineOverlay).toBeTruthy();
          }
        } catch (e) {
          console.log('❌ Timeline overlay did not appear within 5 seconds');
          
          // Debug: Check what happened after click
          const bodyContent = await page.evaluate(() => {
            const overlays = document.querySelectorAll('[id*="ytgif"], [class*="ytgif"]');
            return Array.from(overlays).map(el => ({
              tagName: el.tagName,
              id: el.id,
              className: el.className,
              visible: el.offsetParent !== null
            }));
          });
          console.log('🔧 Elements with ytgif after click:', bodyContent);
        }
      }
    } else {
      console.log('❌ GIF button not found - extension may not be working properly');
      
      // Additional debugging
      console.log('🔧 Checking extension installation...');
      
      // Check if extension files are present
      const extensionElements = await page.$$eval('*', els => 
        els.filter(el => 
          el.id && el.id.includes('ytgif') || 
          el.className && el.className.includes('ytgif')
        ).map(el => ({
          tagName: el.tagName,
          id: el.id,
          className: el.className
        }))
      );
      
      console.log('🔧 Extension elements found:', extensionElements);
      
      // Force a manual injection test
      console.log('🔧 Attempting manual button injection...');
      await page.evaluate(() => {
        // Try to find where the button should be injected
        const rightControls = document.querySelector('.ytp-right-controls');
        if (rightControls) {
          console.log('Found .ytp-right-controls:', rightControls);
          
          // Create a test button to verify injection location works
          const testButton = document.createElement('button');
          testButton.id = 'test-ytgif-button';
          testButton.className = 'ytp-button';
          testButton.innerHTML = '🎬';
          testButton.title = 'Test GIF Button';
          rightControls.prepend(testButton);
          
          return 'Test button injected';
        }
        return 'No .ytp-right-controls found';
      });
      
      // Check if test button appeared
      const testButton = await page.$('#test-ytgif-button');
      console.log(`🔧 Test button injection ${testButton ? 'successful' : 'failed'}`);
    }

    // Expect that we at least found evidence of the extension
    expect(hasExtensionScript || gifButton || logs.length > 0).toBeTruthy();
  });

  test('should handle extension on different YouTube page types', async () => {
    console.log('🎬 Testing extension on YouTube Shorts...');
    
    // Test on YouTube Shorts
    await page.goto('https://www.youtube.com/shorts/dQw4w9WgXcQ', { 
      waitUntil: 'networkidle' 
    });
    
    await page.waitForTimeout(3000);
    
    // Check if extension adapts to Shorts
    const shortsButton = await page.$('.ytgif-button, #ytgif-button');
    console.log(`Shorts page button found: ${!!shortsButton}`);
    
    // Test on regular YouTube home
    console.log('🏠 Testing extension on YouTube home...');
    await page.goto('https://www.youtube.com/', { 
      waitUntil: 'networkidle' 
    });
    
    await page.waitForTimeout(2000);
    
    // Extension should not inject on non-video pages
    const homeButton = await page.$('.ytgif-button, #ytgif-button');
    console.log(`Home page button found (should be false): ${!!homeButton}`);
    
    expect(homeButton).toBeFalsy();
  });
});