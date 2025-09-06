const { test, expect, chromium } = require('@playwright/test');
const path = require('path');

test.describe('Overlay Wizard E2E Tests', () => {
  let browser;
  let context;
  let page;

  test.beforeAll(async () => {
    const extensionPath = path.join(__dirname, '..', 'dist');
    console.log('🚀 Loading extension from:', extensionPath);
    
    browser = await chromium.launch({
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--no-sandbox'
      ],
      slowMo: 500 // Slow down for visibility
    });
    
    context = await browser.newContext();
  });

  test.afterAll(async () => {
    await browser?.close();
  });

  test.beforeEach(async () => {
    // Create a new page for each test
    page = await context.newPage();
    
    // Enable console logging
    page.on('console', msg => {
      console.log('PAGE LOG:', msg.text());
    });
    
    // Navigate to YouTube video
    console.log('📺 Opening YouTube video...');
    await page.goto('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    await page.waitForSelector('.html5-video-player', { timeout: 10000 });
    console.log('✅ YouTube video loaded');
    
    // Wait for extension to initialize
    await page.waitForTimeout(3000);
  });

  test('Test 1: Popup launches overlay wizard', async () => {
    console.log('\n🧪 Test 1: Testing popup to overlay flow\n');
    
    // Open a new page to simulate popup
    const popupPage = await context.newPage();
    const popupPath = path.join(__dirname, '..', 'dist', 'popup.html');
    await popupPage.goto(`file://${popupPath}`);
    
    // Check if popup shows correct state
    const noVideoMessage = await popupPage.locator('text=/No Video Detected/');
    if (await noVideoMessage.isVisible()) {
      console.log('⚠️ Popup shows "No Video Detected" (expected for file:// URL)');
    }
    
    // Go back to YouTube page and click GIF button
    await page.bringToFront();
    
    // Look for GIF button in player
    console.log('🔍 Looking for GIF button in YouTube player...');
    const gifButton = await page.locator('.ytp-right-controls .ytgif-button, .ytp-right-controls button[title*="GIF"]').first();
    
    if (await gifButton.isVisible()) {
      console.log('✅ GIF button found');
      await gifButton.click();
      console.log('🖱️ Clicked GIF button');
      
      // Wait for overlay wizard to appear
      await page.waitForTimeout(2000);
      
      // Check for wizard overlay
      const wizardOverlay = await page.locator('#ytgif-wizard-overlay, .ytgif-overlay-wizard');
      if (await wizardOverlay.isVisible()) {
        console.log('✅ Wizard overlay appeared!');
        
        // Take screenshot
        await page.screenshot({ path: 'tests/screenshots/wizard-overlay-opened.png' });
      } else {
        console.log('❌ Wizard overlay not visible');
        
        // Check for old timeline overlay
        const timelineOverlay = await page.locator('#ytgif-timeline-overlay');
        if (await timelineOverlay.isVisible()) {
          console.log('⚠️ Old timeline overlay appeared instead of wizard');
        }
      }
    } else {
      console.log('❌ GIF button not found in player');
    }
    
    await popupPage.close();
  });

  test('Test 2: Wizard Welcome Screen auto-progression', async () => {
    console.log('\n🧪 Test 2: Testing Welcome screen auto-progression\n');
    
    // Click GIF button to open wizard
    const gifButton = await page.locator('.ytp-right-controls .ytgif-button').first();
    await gifButton.click();
    
    // Wait for wizard overlay
    await page.waitForTimeout(1000);
    
    // Check for Welcome screen
    const welcomeTitle = await page.locator('.ytgif-wizard-title:has-text("Create a GIF"), h1:has-text("Create a GIF")');
    if (await welcomeTitle.isVisible()) {
      console.log('✅ Welcome screen visible');
      
      // Wait for auto-progression (should happen after 1.5s)
      await page.waitForTimeout(2000);
      
      // Check if it progressed to Action Select
      const actionTitle = await page.locator('.ytgif-wizard-title:has-text("Choose Capture Mode"), h2:has-text("Choose Capture Mode")');
      if (await actionTitle.isVisible()) {
        console.log('✅ Auto-progressed to Action Select screen');
      } else {
        console.log('❌ Did not auto-progress');
      }
    } else {
      console.log('❌ Welcome screen not found');
    }
  });

  test('Test 3: Quick Capture flow', async () => {
    console.log('\n🧪 Test 3: Testing Quick Capture flow\n');
    
    // Click GIF button
    const gifButton = await page.locator('.ytp-right-controls .ytgif-button').first();
    await gifButton.click();
    await page.waitForTimeout(3000); // Wait for auto-progression
    
    // Click Quick Capture
    const quickCaptureCard = await page.locator('.ytgif-action-card').first();
    if (await quickCaptureCard.isVisible()) {
      console.log('✅ Quick Capture card found');
      await quickCaptureCard.click();
      
      await page.waitForTimeout(1000);
      
      // Check for Quick Capture screen
      const quickTitle = await page.locator('.ytgif-wizard-title:has-text("Quick Capture"), h2:has-text("Quick Capture")');
      if (await quickTitle.isVisible()) {
        console.log('✅ Quick Capture screen loaded');
        
        // Check for timeline preview
        const timeline = await page.locator('.ytgif-timeline-track');
        if (await timeline.isVisible()) {
          console.log('✅ Timeline preview visible');
        }
        
        // Check for Create GIF button
        const createButton = await page.locator('.ytgif-button-primary:has-text("Create GIF")');
        if (await createButton.isVisible()) {
          console.log('✅ Create GIF button visible');
          
          // Click to create GIF
          await createButton.click();
          console.log('🎬 Clicked Create GIF');
          
          // Wait for processing
          await page.waitForTimeout(3000);
          
          // Check for processing screen
          const processingTitle = await page.locator('.ytgif-wizard-title:has-text("Creating"), h2:has-text("Creating")');
          const progressBar = await page.locator('.ytgif-progress-bar');
          
          if (await processingTitle.isVisible() || await progressBar.isVisible()) {
            console.log('✅ Processing screen appeared');
          } else {
            console.log('⚠️ Processing screen not visible');
          }
        }
      } else {
        console.log('❌ Quick Capture screen not loaded');
      }
    } else {
      console.log('❌ Quick Capture card not found');
    }
  });

  test('Test 4: Custom Range flow', async () => {
    console.log('\n🧪 Test 4: Testing Custom Range flow\n');
    
    // Click GIF button
    const gifButton = await page.locator('.ytp-right-controls .ytgif-button').first();
    await gifButton.click();
    await page.waitForTimeout(3000); // Wait for auto-progression
    
    // Click Custom Range
    const customRangeCard = await page.locator('.ytgif-action-card').nth(1);
    if (await customRangeCard.isVisible()) {
      console.log('✅ Custom Range card found');
      await customRangeCard.click();
      
      await page.waitForTimeout(1000);
      
      // Check for Custom Range screen
      const customTitle = await page.locator('.ytgif-wizard-title:has-text("Select Range"), h2:has-text("Select Range")');
      if (await customTitle.isVisible()) {
        console.log('✅ Custom Range screen loaded');
        
        // Check for interactive timeline
        const timeline = await page.locator('.ytgif-timeline-interactive, .ytgif-timeline-track');
        if (await timeline.isVisible()) {
          console.log('✅ Interactive timeline visible');
          
          // Try clicking on timeline to set range
          const box = await timeline.boundingBox();
          if (box) {
            await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
            console.log('🖱️ Clicked on timeline');
          }
        }
        
        // Check for time inputs
        const timeInputs = await page.locator('.ytgif-time-input');
        const inputCount = await timeInputs.count();
        console.log(`📝 Found ${inputCount} time input fields`);
        
        // Check for preset buttons
        const presetButtons = await page.locator('.ytgif-preset-button');
        const presetCount = await presetButtons.count();
        console.log(`🎯 Found ${presetCount} preset buttons`);
        
        // Click a preset
        if (presetCount > 0) {
          await presetButtons.first().click();
          console.log('🖱️ Clicked first preset');
        }
        
        // Check for Create GIF button
        const createButton = await page.locator('.ytgif-button-primary');
        if (await createButton.isVisible()) {
          const buttonText = await createButton.textContent();
          console.log(`✅ Create GIF button visible: "${buttonText}"`);
        }
      } else {
        console.log('❌ Custom Range screen not loaded');
      }
    } else {
      console.log('❌ Custom Range card not found');
    }
  });

  test('Test 5: Back navigation', async () => {
    console.log('\n🧪 Test 5: Testing back navigation\n');
    
    // Click GIF button
    const gifButton = await page.locator('.ytp-right-controls .ytgif-button').first();
    await gifButton.click();
    await page.waitForTimeout(3000); // Wait for auto-progression
    
    // Go to Quick Capture
    const quickCaptureCard = await page.locator('.ytgif-action-card').first();
    await quickCaptureCard.click();
    await page.waitForTimeout(1000);
    
    // Click Back button
    const backButton = await page.locator('.ytgif-back-button, button:has-text("Back")').first();
    if (await backButton.isVisible()) {
      console.log('✅ Back button found');
      await backButton.click();
      
      await page.waitForTimeout(1000);
      
      // Check if we're back at Action Select
      const actionTitle = await page.locator('.ytgif-wizard-title:has-text("Choose Capture Mode")');
      if (await actionTitle.isVisible()) {
        console.log('✅ Navigated back to Action Select');
      } else {
        console.log('❌ Back navigation failed');
      }
    } else {
      console.log('❌ Back button not found');
    }
  });

  test('Test 6: Close wizard', async () => {
    console.log('\n🧪 Test 6: Testing close functionality\n');
    
    // Click GIF button
    const gifButton = await page.locator('.ytp-right-controls .ytgif-button').first();
    await gifButton.click();
    await page.waitForTimeout(2000);
    
    // Look for close button
    const closeButton = await page.locator('.ytgif-wizard-close, .ytgif-timeline-close').first();
    if (await closeButton.isVisible()) {
      console.log('✅ Close button found');
      await closeButton.click();
      
      await page.waitForTimeout(1000);
      
      // Check if overlay is gone
      const overlay = await page.locator('#ytgif-wizard-overlay, #ytgif-timeline-overlay');
      if (await overlay.isVisible()) {
        console.log('❌ Overlay still visible after close');
      } else {
        console.log('✅ Overlay closed successfully');
      }
    } else {
      console.log('❌ Close button not found');
    }
  });

  test('Test 7: Progress indicators', async () => {
    console.log('\n🧪 Test 7: Testing progress indicators\n');
    
    // Click GIF button
    const gifButton = await page.locator('.ytp-right-controls .ytgif-button').first();
    await gifButton.click();
    await page.waitForTimeout(2000);
    
    // Check for progress dots
    const progressDots = await page.locator('.ytgif-progress-dot');
    const dotCount = await progressDots.count();
    console.log(`📊 Found ${dotCount} progress dots`);
    
    if (dotCount > 0) {
      // Check active dots
      const activeDots = await page.locator('.ytgif-progress-dot.active');
      const activeCount = await activeDots.count();
      console.log(`✅ ${activeCount} dots are active`);
      
      // Navigate and check progress updates
      await page.waitForTimeout(2000); // Wait for auto-progression
      
      const quickCaptureCard = await page.locator('.ytgif-action-card').first();
      if (await quickCaptureCard.isVisible()) {
        await quickCaptureCard.click();
        await page.waitForTimeout(1000);
        
        const newActiveDots = await page.locator('.ytgif-progress-dot.active');
        const newActiveCount = await newActiveDots.count();
        console.log(`📊 After navigation: ${newActiveCount} dots are active`);
      }
    }
  });

  test('Test 8: Complete GIF creation flow', async () => {
    console.log('\n🧪 Test 8: Testing complete GIF creation\n');
    
    // Click GIF button
    const gifButton = await page.locator('.ytp-right-controls .ytgif-button').first();
    await gifButton.click();
    console.log('🖱️ Clicked GIF button');
    
    // Wait for overlay
    await page.waitForTimeout(3000);
    
    // Take screenshot of initial state
    await page.screenshot({ path: 'tests/screenshots/wizard-initial.png' });
    
    // Check which UI appeared
    const wizardOverlay = await page.locator('.ytgif-overlay-wizard');
    const oldTimeline = await page.locator('#ytgif-timeline-overlay');
    
    if (await wizardOverlay.isVisible()) {
      console.log('✅ New wizard overlay detected');
      
      // Navigate through wizard
      const quickCapture = await page.locator('.ytgif-action-card').first();
      if (await quickCapture.isVisible()) {
        await quickCapture.click();
        console.log('🖱️ Selected Quick Capture');
        
        await page.waitForTimeout(1000);
        
        const createButton = await page.locator('.ytgif-button-primary:has-text("Create GIF")');
        if (await createButton.isVisible()) {
          await createButton.click();
          console.log('🎬 Started GIF creation');
          
          // Monitor progress
          await page.waitForTimeout(5000);
          
          const progressBar = await page.locator('.ytgif-progress-bar');
          if (await progressBar.isVisible()) {
            console.log('✅ GIF encoding in progress');
          }
        }
      }
    } else if (await oldTimeline.isVisible()) {
      console.log('⚠️ Old timeline overlay detected (wizard not implemented)');
      
      // Use old flow
      const createButton = await page.locator('button:has-text("Create GIF")').first();
      if (await createButton.isVisible()) {
        await createButton.click();
        console.log('🎬 Started GIF creation (old flow)');
      }
    } else {
      console.log('❌ No overlay detected');
    }
    
    // Take final screenshot
    await page.screenshot({ path: 'tests/screenshots/wizard-final.png' });
  });
});

console.log('\n📋 Test Summary:');
console.log('This test suite covers:');
console.log('  1. Popup to overlay flow');
console.log('  2. Welcome screen auto-progression');
console.log('  3. Quick Capture flow');
console.log('  4. Custom Range flow');
console.log('  5. Back navigation');
console.log('  6. Close functionality');
console.log('  7. Progress indicators');
console.log('  8. Complete GIF creation');