const { test, expect, chromium } = require('@playwright/test');
const path = require('path');

test('Create GIF with Progress Bar', async () => {
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
    slowMo: 500 // Slow down to see the progress
  });

  const page = await browser.newPage();
  
  console.log('🎬 Testing Create GIF Button and Progress Bar');
  console.log('==============================================');
  
  // Navigate to YouTube
  console.log('\n📍 Loading YouTube video...');
  await page.goto('https://www.youtube.com/watch?v=dQw4w9WgXcQ', { 
    waitUntil: 'networkidle' 
  });
  await page.waitForSelector('#movie_player', { timeout: 15000 });
  await page.waitForTimeout(3000);
  
  // Open unified interface
  console.log('📍 Opening GIF creator...');
  const gifButton = await page.waitForSelector('.ytgif-button', { timeout: 10000 });
  await page.waitForTimeout(2000);
  await gifButton.click();
  await page.waitForTimeout(2000);
  
  // Select time segment
  console.log('📍 Selecting time segment...');
  const presetButtons = await page.$$('.ytgif-preset-btn');
  if (presetButtons.length > 0) {
    await presetButtons[0].click(); // 3s preset
    await page.waitForTimeout(2000);
    console.log('   ✅ Selected 3 second segment');
  }
  
  // Wait for frames to extract
  console.log('📍 Waiting for frame extraction...');
  await page.waitForTimeout(4000);
  
  // Look for Create GIF button
  console.log('📍 Looking for Create GIF button...');
  const createButton = await page.$('.ytgif-unified-btn-create');
  
  if (createButton) {
    const buttonText = await createButton.evaluate(el => el.textContent);
    console.log(`   ✅ Found button: "${buttonText}"`);
    
    // Check if button is enabled
    const isDisabled = await createButton.evaluate(el => el.disabled);
    if (!isDisabled) {
      console.log('   ✅ Button is enabled');
      
      // Set up progress monitoring
      const progressMessages = [];
      page.on('console', msg => {
        const text = msg.text();
        if (text.includes('progress') || text.includes('GIF')) {
          progressMessages.push(text);
          console.log(`   📊 Progress: ${text}`);
        }
      });
      
      // Click Create GIF
      console.log('\n🎯 Clicking Create GIF button...');
      await page.waitForTimeout(2000);
      await createButton.click();
      
      // Watch for progress bar
      console.log('⏳ Monitoring progress bar...');
      let progressBarVisible = false;
      let maxProgress = 0;
      
      for (let i = 0; i < 10; i++) {
        await page.waitForTimeout(1000);
        
        // Check for progress container
        const progressContainer = await page.$('.ytgif-unified-progress-container');
        if (progressContainer) {
          progressBarVisible = true;
          
          // Get progress fill width
          const progressFill = await page.$('.ytgif-unified-progress-fill');
          if (progressFill) {
            const width = await progressFill.evaluate(el => el.style.width);
            const progress = parseInt(width) || 0;
            if (progress > maxProgress) {
              maxProgress = progress;
              console.log(`   📈 Progress bar at: ${width}`);
            }
          }
          
          // Get progress text
          const progressText = await page.$('.ytgif-unified-progress-text');
          if (progressText) {
            const text = await progressText.evaluate(el => el.textContent);
            if (text) {
              console.log(`   💬 Status: ${text}`);
            }
          }
        }
        
        // Check if Save/Export buttons appeared
        const saveButton = await page.$('.ytgif-unified-btn-save');
        const exportButton = await page.$('.ytgif-unified-btn-export');
        if (saveButton && exportButton) {
          console.log('\n✅ GIF created! Save and Export buttons now visible');
          break;
        }
      }
      
      if (progressBarVisible) {
        console.log(`\n✅ Progress bar was visible (max: ${maxProgress}%)`);
      } else {
        console.log('\n⚠️ Progress bar was not visible');
      }
      
      // Check final state
      const finalSaveButton = await page.$('.ytgif-unified-btn-save');
      const finalExportButton = await page.$('.ytgif-unified-btn-export');
      
      if (finalSaveButton && finalExportButton) {
        console.log('✅ Save to Library button available');
        console.log('✅ Export button available');
      } else {
        const createStillVisible = await page.$('.ytgif-unified-btn-create');
        if (createStillVisible) {
          console.log('⚠️ Create GIF button still visible - processing may have failed');
        }
      }
      
    } else {
      console.log('   ⚠️ Button is disabled - frames may not be extracted yet');
    }
  } else {
    console.log('   ❌ Create GIF button not found');
  }
  
  console.log('\n==============================================');
  console.log('Test complete!');
  
  await page.waitForTimeout(3000);
  await browser.close();
});