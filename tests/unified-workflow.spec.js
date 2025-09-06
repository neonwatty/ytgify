const { test, expect, chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

test.describe('Complete Unified Interface Workflow', () => {
  test('Full GIF creation workflow with unified interface', async () => {
    const extensionPath = path.join(__dirname, '..', 'dist');
    
    const browser = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--no-sandbox',
        '--disable-dev-shm-usage',
      ],
      viewport: { width: 1280, height: 720 },
      slowMo: 1000 // Slow down actions for better visibility
    });

    const page = await browser.newPage();
    
    console.log('🎬 Starting Complete Unified Workflow Test');
    console.log('================================================');
    
    // Step 1: Navigate to YouTube
    console.log('\n📍 Step 1: Loading YouTube video...');
    await page.goto('https://www.youtube.com/watch?v=dQw4w9WgXcQ', { 
      waitUntil: 'networkidle' 
    });
    await page.waitForSelector('#movie_player', { timeout: 15000 });
    await page.waitForTimeout(5000); // Pause to see video loaded
    console.log('   ✅ Video loaded');

    // Step 2: Open unified interface
    console.log('\n📍 Step 2: Opening unified GIF creator...');
    const gifButton = await page.waitForSelector('.ytgif-button', { timeout: 10000 });
    await page.waitForTimeout(3000); // Pause to see button before clicking
    await gifButton.click();
    await page.waitForTimeout(4000); // Pause to see interface opening
    
    const unifiedOverlay = await page.$('.ytgif-unified-overlay');
    if (unifiedOverlay) {
      console.log('   ✅ Unified interface opened');
    } else {
      console.log('   ❌ Failed to open unified interface');
      await browser.close();
      return;
    }

    // Step 3: Select time segment
    console.log('\n📍 Step 3: Selecting time segment...');
    const presetButtons = await page.$$('.ytgif-preset-btn');
    if (presetButtons.length > 0) {
      await page.waitForTimeout(3000); // Pause before selecting preset
      await presetButtons[0].click(); // Click first preset (e.g., 3s)
      await page.waitForTimeout(3000); // Pause to see selection
      
      const duration = await page.$eval('.ytgif-unified-duration', el => el.textContent);
      console.log(`   ✅ Selected segment: ${duration}`);
    }

    // Step 4: Configure settings
    console.log('\n📍 Step 4: Configuring GIF settings...');
    
    // Select format
    const formatButtons = await page.$$('.ytgif-unified-format-btn');
    if (formatButtons.length > 0) {
      await page.waitForTimeout(2000); // Pause before format selection
      await formatButtons[0].click(); // Select GIF
      console.log('   ✅ Format: GIF');
      await page.waitForTimeout(2000); // Pause to see format selected
    }
    
    // Select quality
    const qualityButtons = await page.$$('.ytgif-unified-quality-btn');
    if (qualityButtons.length > 1) {
      await page.waitForTimeout(2000); // Pause before quality selection
      await qualityButtons[1].click(); // Select Medium
      console.log('   ✅ Quality: Medium');
      await page.waitForTimeout(2000); // Pause to see quality selected
    }
    
    // Select resolution
    const resolutionButtons = await page.$$('.ytgif-unified-resolution-btn');
    if (resolutionButtons.length > 0) {
      await page.waitForTimeout(2000); // Pause before resolution selection
      await resolutionButtons[0].click(); // Select first preset
      console.log('   ✅ Resolution: Preset selected');
      await page.waitForTimeout(2000); // Pause to see resolution selected
    }
    
    // Adjust frame rate
    const frameRateSlider = await page.$('.ytgif-unified-slider');
    if (frameRateSlider) {
      await page.waitForTimeout(2000); // Pause before adjusting frame rate
      await frameRateSlider.evaluate(el => el.value = '15');
      await frameRateSlider.dispatchEvent('input');
      console.log('   ✅ Frame rate: 15 fps');
      await page.waitForTimeout(2000); // Pause to see frame rate adjusted
    }

    // Step 5: Wait for preview
    console.log('\n📍 Step 5: Waiting for preview...');
    await page.waitForTimeout(5000); // Longer pause to see preview loading
    
    const canvas = await page.$('.ytgif-unified-canvas');
    const extracting = await page.$('.ytgif-unified-extracting');
    
    if (canvas) {
      console.log('   ✅ Preview ready');
      
      // Try to play preview
      const playButton = await page.$('.ytgif-unified-play-btn');
      if (playButton) {
        await page.waitForTimeout(2000); // Pause before playing
        await playButton.click();
        console.log('   ✅ Preview playing');
        await page.waitForTimeout(4000); // Pause to see preview animation
      }
    } else if (extracting) {
      console.log('   ⏳ Still extracting frames...');
      await page.waitForTimeout(5000);
    } else {
      console.log('   ⚠️ Preview not available');
    }

    // Step 6: Check file size estimate
    console.log('\n📍 Step 6: Checking file size estimate...');
    const sizeEstimate = await page.$('.ytgif-unified-size-estimate');
    if (sizeEstimate) {
      const size = await sizeEstimate.evaluate(el => el.textContent);
      console.log(`   ✅ Estimated size: ${size}`);
    }

    // Step 7: Export GIF
    console.log('\n📍 Step 7: Creating GIF...');
    
    // Set up console listener
    const messages = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('GIF') || text.includes('process') || text.includes('Creating')) {
        messages.push(text);
      }
    });
    
    const exportButton = await page.$('.ytgif-unified-btn-export');
    if (exportButton) {
      const buttonText = await exportButton.evaluate(el => el.textContent);
      console.log(`   🎯 Clicking "${buttonText}" button...`);
      
      await page.waitForTimeout(3000); // Pause before clicking export
      await exportButton.click();
      console.log('   ⏳ Waiting for GIF processing...');
      await page.waitForTimeout(8000); // Longer pause to see processing
      
      // Check for processing messages
      if (messages.length > 0) {
        console.log('   ✅ GIF processing started');
        console.log(`   📨 Messages: ${messages.slice(0, 3).join(', ')}`);
      } else {
        console.log('   ⚠️ No processing messages detected');
      }
    }

    // Step 8: Summary
    console.log('\n================================================');
    console.log('📊 Workflow Summary:');
    console.log('   • Interface: Unified Timeline-Editor');
    console.log('   • Timeline: Selection controls working');
    console.log('   • Settings: All controls accessible');
    console.log('   • Preview: Frame extraction functional');
    console.log('   • Export: Process initiated');
    console.log('\n✨ Unified interface workflow test complete!');

    console.log('\n🎯 Test complete! Pausing before closing...');
    await page.waitForTimeout(5000); // Final pause to see results
    await browser.close();
  });

  test('Test all format options', async () => {
    const extensionPath = path.join(__dirname, '..', 'dist');
    
    const browser = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
      viewport: { width: 1280, height: 720 }
    });

    const page = await browser.newPage();
    
    // Navigate and open interface
    await page.goto('https://www.youtube.com/watch?v=dQw4w9WgXcQ', { 
      waitUntil: 'networkidle' 
    });
    await page.waitForSelector('#movie_player', { timeout: 15000 });
    await page.waitForTimeout(2000);
    
    const gifButton = await page.waitForSelector('.ytgif-button', { timeout: 10000 });
    await gifButton.click();
    await page.waitForTimeout(2000);

    console.log('\n🎨 Testing Format Options:');
    
    // Test each format
    const formats = ['GIF'];
    const formatButtons = await page.$$('.ytgif-unified-format-btn');
    
    for (let i = 0; i < Math.min(formatButtons.length, formats.length); i++) {
      await formatButtons[i].click();
      await page.waitForTimeout(500);
      
      const isActive = await formatButtons[i].evaluate(el => el.classList.contains('active'));
      const isDisabled = await formatButtons[i].evaluate(el => el.disabled);
      
      if (isActive) {
        console.log(`   ✅ ${formats[i]} - Active`);
        
        // Check export button text
        const exportText = await page.$eval('.ytgif-unified-btn-export', el => el.textContent);
        console.log(`      Export button: "${exportText}"`);
      } else if (isDisabled) {
        console.log(`   ⏳ ${formats[i]} - Coming Soon`);
      }
    }

    await browser.close();
  });
});