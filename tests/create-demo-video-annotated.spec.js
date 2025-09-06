const { test, chromium } = require('@playwright/test');
const path = require('path');

test.describe('YouTube GIF Maker - Annotated Demo', () => {
  test('Create annotated demo video with overlay text', async () => {
    console.log('🎬 Starting Annotated Demo Recording...\n');
    
    const extensionPath = path.join(__dirname, '..', 'dist');
    
    // Launch browser with video recording
    const browser = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--no-sandbox',
        '--window-size=1920,1080'
      ],
      viewport: { width: 1920, height: 1080 },
      recordVideo: {
        dir: './demo-videos/',
        size: { width: 1920, height: 1080 }
      }
    });

    const page = await browser.newPage();
    
    // Helper to add overlay annotations
    const showAnnotation = async (text, duration = 3000) => {
      await page.evaluate((msg) => {
        // Remove existing annotation if any
        const existing = document.getElementById('demo-annotation');
        if (existing) existing.remove();
        
        // Create new annotation
        const annotation = document.createElement('div');
        annotation.id = 'demo-annotation';
        annotation.style.cssText = `
          position: fixed;
          top: 20px;
          left: 50%;
          transform: translateX(-50%);
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 15px 30px;
          border-radius: 50px;
          font-size: 20px;
          font-weight: bold;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
          z-index: 999999;
          animation: slideIn 0.5s ease-out;
        `;
        annotation.textContent = msg;
        
        // Add animation
        const style = document.createElement('style');
        style.textContent = `
          @keyframes slideIn {
            from {
              opacity: 0;
              transform: translateX(-50%) translateY(-20px);
            }
            to {
              opacity: 1;
              transform: translateX(-50%) translateY(0);
            }
          }
        `;
        document.head.appendChild(style);
        document.body.appendChild(annotation);
        
        // Auto-remove after duration
        setTimeout(() => {
          annotation.style.animation = 'slideOut 0.5s ease-in';
          setTimeout(() => annotation.remove(), 500);
        }, 2500);
      }, text);
      
      console.log(`   📝 ${text}`);
      await page.waitForTimeout(duration);
    };

    // Helper to highlight elements
    const highlightElement = async (selector, color = '#ff0000') => {
      await page.evaluate((sel, col) => {
        const element = document.querySelector(sel);
        if (element) {
          element.style.transition = 'all 0.3s ease';
          element.style.outline = `3px solid ${col}`;
          element.style.outlineOffset = '3px';
          setTimeout(() => {
            element.style.outline = '';
            element.style.outlineOffset = '';
          }, 2000);
        }
      }, selector, color);
    };

    try {
      // Start demo
      await showAnnotation('🎬 YouTube GIF Maker Demo', 3000);
      
      console.log('📍 Navigate to YouTube');
      await page.goto('https://www.youtube.com/watch?v=jNQXAC9IVRw', { 
        waitUntil: 'networkidle' 
      });
      
      await page.waitForSelector('#movie_player', { timeout: 15000 });
      await showAnnotation('Step 1: Load a YouTube Video', 3000);
      
      // Play video
      const player = await page.$('#movie_player');
      await player.click();
      await page.waitForTimeout(2000);
      
      // Find GIF button
      await showAnnotation('Step 2: Click the GIF Button', 3000);
      const gifButton = await page.waitForSelector('.ytgif-button', { timeout: 10000 });
      await highlightElement('.ytgif-button', '#00ff00');
      await page.waitForTimeout(1000);
      await gifButton.click();
      
      // Wait for editor
      await page.waitForSelector('.ytgif-unified-overlay', { timeout: 10000 });
      await showAnnotation('Step 3: GIF Editor Opens', 3000);
      
      // Select time preset
      await showAnnotation('Step 4: Choose Duration', 3000);
      const presetButtons = await page.$$('.ytgif-preset-btn');
      if (presetButtons.length > 1) {
        await highlightElement('.ytgif-preset-btn:nth-child(2)', '#0099ff');
        await page.waitForTimeout(1000);
        await presetButtons[1].click(); // 5s preset
        await page.waitForTimeout(3000);
      }
      
      // Adjust settings
      await showAnnotation('Step 5: Adjust Quality Settings', 3000);
      
      // Quality
      const qualityButtons = await page.$$('.ytgif-unified-quality-btn');
      if (qualityButtons.length > 2) {
        await qualityButtons[2].click(); // High
        await page.waitForTimeout(1000);
      }
      
      // Frame rate
      const frameRateSlider = await page.$('.ytgif-unified-slider');
      if (frameRateSlider) {
        await frameRateSlider.evaluate(el => {
          el.value = '20';
          el.dispatchEvent(new Event('input', { bubbles: true }));
        });
        await page.waitForTimeout(1000);
      }
      
      // Resolution
      const resolutionButtons = await page.$$('.ytgif-unified-resolution-btn');
      if (resolutionButtons.length > 1) {
        await resolutionButtons[1].click(); // 720p
        await page.waitForTimeout(1000);
      }
      
      // Create GIF
      await showAnnotation('Step 6: Create Your GIF!', 3000);
      const createButton = await page.$('.ytgif-unified-btn-create');
      await highlightElement('.ytgif-unified-btn-create', '#00ff00');
      await page.waitForTimeout(1000);
      await createButton.click();
      
      // Monitor progress with annotations
      let progressShown = false;
      let completionShown = false;
      
      for (let i = 0; i < 60; i++) {
        await page.waitForTimeout(500);
        
        // Show progress annotation once
        if (!progressShown) {
          const progressBar = await page.$('.ytgif-unified-progress-fill');
          if (progressBar) {
            await showAnnotation('⏳ Creating GIF... Watch the Progress!', 4000);
            progressShown = true;
          }
        }
        
        // Check for completion
        const saveButton = await page.$('.ytgif-unified-btn-save');
        const exportButton = await page.$('.ytgif-unified-btn-export');
        
        if (saveButton && exportButton && !completionShown) {
          await showAnnotation('✅ GIF Created Successfully!', 3000);
          completionShown = true;
          
          // Highlight export button
          await highlightElement('.ytgif-unified-btn-export', '#00ff00');
          await page.waitForTimeout(2000);
          
          // Export
          await showAnnotation('Step 7: Export Your GIF', 3000);
          await exportButton.click();
          
          await showAnnotation('🎉 Done! Your GIF is Ready!', 4000);
          break;
        }
      }
      
      console.log('\n✅ Annotated demo complete!');
      
    } catch (error) {
      console.error('❌ Error:', error);
    } finally {
      await page.waitForTimeout(2000);
      await browser.close();
    }
  });
});