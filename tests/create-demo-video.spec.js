const { test, chromium } = require('@playwright/test');
const path = require('path');

test.describe('YouTube GIF Maker - Demo Video', () => {
  test('Create demo video of GIF creation process', async () => {
    console.log('🎬 Starting YouTube GIF Maker Demo Recording...\n');
    
    const extensionPath = path.join(__dirname, '..', 'dist');
    
    // Launch browser with video recording enabled
    const browser = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--start-maximized'
      ],
      viewport: { width: 1920, height: 1080 },
      recordVideo: {
        dir: './demo-videos/',
        size: { width: 1920, height: 1080 }
      }
    });

    const page = await browser.newPage();
    
    // Helper function for smooth delays with descriptions
    const pause = async (ms, description) => {
      if (description) {
        console.log(`   ⏸️  ${description}`);
      }
      await page.waitForTimeout(ms);
    };

    try {
      console.log('📍 Step 1: Navigate to YouTube');
      await page.goto('https://www.youtube.com/watch?v=jNQXAC9IVRw', { 
        waitUntil: 'networkidle' 
      });
      await pause(3000, 'Loading YouTube video page');

      // Wait for video player to load
      console.log('📍 Step 2: Wait for video player to be ready');
      await page.waitForSelector('#movie_player', { timeout: 15000 });
      await pause(2000, 'Video player loaded');

      // Play the video briefly to show content
      console.log('📍 Step 3: Play video to show content');
      const player = await page.$('#movie_player');
      await player.click();
      await pause(3000, 'Playing video content');

      // Find and highlight the GIF button
      console.log('📍 Step 4: Locate GIF creation button');
      const gifButton = await page.waitForSelector('.ytgif-button', { timeout: 10000 });
      
      // Add highlight effect to button
      await page.evaluate((btn) => {
        btn.style.transition = 'all 0.3s ease';
        btn.style.boxShadow = '0 0 20px rgba(255, 0, 0, 0.8)';
        btn.style.transform = 'scale(1.1)';
        setTimeout(() => {
          btn.style.boxShadow = '';
          btn.style.transform = '';
        }, 1500);
      }, gifButton);
      
      await pause(2000, 'Highlighting GIF button');

      // Click the GIF button
      console.log('📍 Step 5: Click GIF button to open editor');
      await gifButton.click();
      await pause(2000, 'Opening GIF editor interface');

      // Wait for unified editor to appear
      const unifiedOverlay = await page.waitForSelector('.ytgif-unified-overlay', { timeout: 10000 });
      console.log('   ✅ Editor interface opened');
      await pause(2000, 'Editor interface ready');

      // Select a preset duration
      console.log('📍 Step 6: Select time duration preset');
      const presetButtons = await page.$$('.ytgif-preset-btn');
      if (presetButtons.length > 0) {
        // Highlight the preset button
        await page.evaluate((btn) => {
          btn.style.transition = 'all 0.3s ease';
          btn.style.backgroundColor = '#ff0000';
          setTimeout(() => {
            btn.style.backgroundColor = '';
          }, 1000);
        }, presetButtons[1]); // Select 5s preset
        
        await pause(1000, 'Highlighting duration preset');
        await presetButtons[1].click();
        console.log('   ✅ Selected 5-second duration');
        await pause(3000, 'Extracting frames for preview');
      }

      // Adjust quality settings
      console.log('📍 Step 7: Adjust quality settings');
      const qualityButtons = await page.$$('.ytgif-unified-quality-btn');
      if (qualityButtons.length > 0) {
        // Select High quality
        await qualityButtons[2].click();
        console.log('   ✅ Selected High quality');
        await pause(1500, 'Quality setting updated');
      }

      // Adjust frame rate
      console.log('📍 Step 8: Adjust frame rate');
      const frameRateSlider = await page.$('.ytgif-unified-slider');
      if (frameRateSlider) {
        await frameRateSlider.evaluate(el => el.value = '20');
        await frameRateSlider.dispatchEvent('input');
        console.log('   ✅ Set frame rate to 20 fps');
        await pause(1500, 'Frame rate adjusted');
      }

      // Select resolution
      console.log('📍 Step 9: Select resolution');
      const resolutionButtons = await page.$$('.ytgif-unified-resolution-btn');
      if (resolutionButtons.length > 1) {
        await resolutionButtons[1].click(); // Select 720p
        console.log('   ✅ Selected 720p resolution');
        await pause(1500, 'Resolution set');
      }

      // Start GIF creation
      console.log('📍 Step 10: Create GIF');
      const createButton = await page.$('.ytgif-unified-btn-create');
      
      // Highlight create button
      await page.evaluate((btn) => {
        btn.style.transition = 'all 0.3s ease';
        btn.style.transform = 'scale(1.05)';
        btn.style.boxShadow = '0 0 30px rgba(0, 255, 0, 0.8)';
        setTimeout(() => {
          btn.style.transform = '';
          btn.style.boxShadow = '';
        }, 1500);
      }, createButton);
      
      await pause(2000, 'Ready to create GIF');
      await createButton.click();
      console.log('   ⏳ Creating GIF...');

      // Monitor progress
      console.log('📍 Step 11: Monitor creation progress');
      let lastProgress = 0;
      for (let i = 0; i < 60; i++) {
        await page.waitForTimeout(500);
        
        // Check for progress bar
        const progressBar = await page.$('.ytgif-unified-progress-fill');
        if (progressBar) {
          const width = await progressBar.evaluate(el => el.style.width);
          const progress = parseInt(width) || 0;
          if (progress > lastProgress) {
            console.log(`   📊 Progress: ${progress}%`);
            lastProgress = progress;
          }
        }
        
        // Check if save/export buttons appear
        const saveButton = await page.$('.ytgif-unified-btn-save');
        const exportButton = await page.$('.ytgif-unified-btn-export');
        
        if (saveButton && exportButton) {
          console.log('   ✅ GIF created successfully!');
          await pause(2000, 'GIF creation complete');
          
          // Highlight the export button
          await page.evaluate((btn) => {
            btn.style.transition = 'all 0.3s ease';
            btn.style.transform = 'scale(1.1)';
            btn.style.boxShadow = '0 0 30px rgba(0, 100, 255, 0.8)';
            setTimeout(() => {
              btn.style.transform = '';
              btn.style.boxShadow = '';
            }, 2000);
          }, exportButton);
          
          await pause(2500, 'Ready to export');
          
          // Click export
          console.log('📍 Step 12: Export GIF');
          await exportButton.click();
          console.log('   💾 GIF exported!');
          await pause(3000, 'Export complete');
          break;
        }
      }

      console.log('\n🎉 Demo recording complete!');
      console.log('📹 Video saved to: ./demo-videos/');
      
    } catch (error) {
      console.error('❌ Error during demo:', error);
    } finally {
      // Keep browser open briefly to ensure video saves
      await pause(2000, 'Finalizing video recording');
      await browser.close();
    }
  });
});