const { test, chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs').promises;

test.describe('YouTube GIF Maker - Complete Demo with Result', () => {
  test('Demo showing GIF creation and the actual result', async () => {
    console.log('🎬 Starting Complete Demo with GIF Result Display...\n');
    
    const extensionPath = path.join(__dirname, '..', 'dist');
    const downloadPath = path.join(__dirname, 'downloads');
    
    // Ensure download directory exists
    await fs.mkdir(downloadPath, { recursive: true });
    
    // Clean up old downloads
    try {
      const files = await fs.readdir(downloadPath);
      for (const file of files) {
        if (file.endsWith('.gif')) {
          await fs.unlink(path.join(downloadPath, file));
        }
      }
    } catch (e) {}
    
    // Launch browser with video recording and downloads
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
      },
      acceptDownloads: true,
      downloadsPath: downloadPath
    });

    const page = await browser.newPage();
    
    // Helper to add overlay annotations with better styling
    const showAnnotation = async (text, duration = 3000, position = 'top') => {
      await page.evaluate(({ msg, pos, dur }) => {
        const existing = document.getElementById('demo-annotation');
        if (existing) existing.remove();
        
        const annotation = document.createElement('div');
        annotation.id = 'demo-annotation';
        
        const positionStyles = {
          top: 'top: 30px; left: 50%; transform: translateX(-50%);',
          center: 'top: 50%; left: 50%; transform: translate(-50%, -50%);',
          bottom: 'bottom: 30px; left: 50%; transform: translateX(-50%);'
        };
        
        annotation.style.cssText = `
          position: fixed;
          ${positionStyles[pos]}
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 20px 40px;
          border-radius: 50px;
          font-size: 24px;
          font-weight: bold;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
          z-index: 999999;
          animation: slideIn 0.5s ease-out;
        `;
        annotation.textContent = msg;
        document.body.appendChild(annotation);
        
        setTimeout(() => {
          annotation.style.animation = 'fadeOut 0.5s ease-in';
          setTimeout(() => annotation.remove(), 500);
        }, dur - 500);
      }, { msg: text, pos: position, dur: duration });
      
      console.log(`   📝 ${text}`);
      await page.waitForTimeout(duration);
    };

    try {
      // Intro
      await showAnnotation('🎬 YouTube GIF Maker Extension', 4000, 'center');
      await showAnnotation('Watch how easy it is to create GIFs from YouTube!', 3000, 'center');
      
      // Navigate to YouTube
      console.log('📍 Step 1: Load YouTube Video');
      await page.goto('https://www.youtube.com/watch?v=jNQXAC9IVRw', { 
        waitUntil: 'networkidle' 
      });
      
      await page.waitForSelector('#movie_player', { timeout: 15000 });
      await showAnnotation('Step 1: Start with any YouTube video', 3000);
      
      // Play video briefly
      const player = await page.$('#movie_player');
      await player.click();
      await page.waitForTimeout(3000);
      
      // Find and click GIF button
      await showAnnotation('Step 2: Click our GIF button', 3000);
      const gifButton = await page.waitForSelector('.ytgif-button', { timeout: 10000 });
      
      // Highlight button
      await page.evaluate((btn) => {
        btn.style.transition = 'all 0.3s ease';
        btn.style.transform = 'scale(1.2)';
        btn.style.boxShadow = '0 0 30px rgba(0, 255, 0, 0.8)';
        setTimeout(() => {
          btn.style.transform = '';
          btn.style.boxShadow = '';
        }, 1500);
      }, gifButton);
      
      await page.waitForTimeout(1500);
      await gifButton.click();
      
      // Wait for editor
      await page.waitForSelector('.ytgif-unified-overlay', { timeout: 10000 });
      await showAnnotation('Step 3: Choose your settings', 3000);
      
      // Select time preset (3 seconds for faster demo)
      const presetButtons = await page.$$('.ytgif-preset-btn');
      if (presetButtons.length > 0) {
        await presetButtons[0].click(); // 3s preset for faster demo
        await page.waitForTimeout(2000);
      }
      
      // Quick settings
      await showAnnotation('Step 4: Adjust quality and resolution', 2500);
      
      // Set to medium quality for faster processing
      const qualityButtons = await page.$$('.ytgif-unified-quality-btn');
      if (qualityButtons.length > 1) {
        await qualityButtons[1].click(); // Medium
      }
      
      // Create GIF
      await showAnnotation('Step 5: Create your GIF!', 2500);
      const createButton = await page.$('.ytgif-unified-btn-create');
      await createButton.click();
      
      // Monitor progress with live updates
      console.log('📍 Creating GIF...');
      let lastProgress = 0;
      let gifCreated = false;
      
      for (let i = 0; i < 60; i++) {
        await page.waitForTimeout(500);
        
        const progressBar = await page.$('.ytgif-unified-progress-fill');
        if (progressBar) {
          const width = await progressBar.evaluate(el => el.style.width);
          const progress = parseInt(width) || 0;
          if (progress > lastProgress && progress % 20 === 0) {
            await showAnnotation(`Creating GIF: ${progress}%`, 1500);
            lastProgress = progress;
          }
        }
        
        // Check for completion
        const exportButton = await page.$('.ytgif-unified-btn-export');
        if (exportButton) {
          gifCreated = true;
          await showAnnotation('✅ GIF Created! Now let\'s save it...', 3000);
          
          // Set up download handler
          const downloadPromise = page.waitForEvent('download', { timeout: 10000 });
          
          // Click export
          await exportButton.click();
          
          try {
            const download = await downloadPromise;
            const suggestedFilename = download.suggestedFilename();
            const downloadFilePath = path.join(downloadPath, suggestedFilename);
            await download.saveAs(downloadFilePath);
            
            console.log(`   💾 GIF saved: ${suggestedFilename}`);
            await showAnnotation('💾 GIF Downloaded!', 2000);
            
            // Wait a moment for file to be fully written
            await page.waitForTimeout(2000);
            
            // Now display the actual GIF that was created!
            await showAnnotation('Here\'s your created GIF!', 2000);
            await page.waitForTimeout(2000);
            
            // Open a new tab to display the GIF
            const gifDisplayPage = await browser.newPage();
            
            // Create an HTML page that displays the GIF
            const gifData = await fs.readFile(downloadFilePath);
            const base64Gif = gifData.toString('base64');
            const htmlContent = `
              <!DOCTYPE html>
              <html>
              <head>
                <title>Your Created GIF</title>
                <style>
                  body {
                    margin: 0;
                    padding: 0;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    min-height: 100vh;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  }
                  .container {
                    text-align: center;
                    padding: 40px;
                    background: white;
                    border-radius: 20px;
                    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                    max-width: 90%;
                  }
                  h1 {
                    color: #333;
                    margin-bottom: 20px;
                    font-size: 32px;
                  }
                  .gif-display {
                    border: 3px solid #667eea;
                    border-radius: 10px;
                    overflow: hidden;
                    display: inline-block;
                    margin: 20px 0;
                  }
                  img {
                    display: block;
                    max-width: 100%;
                    height: auto;
                  }
                  .info {
                    color: #666;
                    margin-top: 20px;
                    font-size: 18px;
                  }
                  .success-badge {
                    display: inline-block;
                    background: #10b981;
                    color: white;
                    padding: 10px 20px;
                    border-radius: 25px;
                    margin-top: 20px;
                    font-weight: bold;
                  }
                </style>
              </head>
              <body>
                <div class="container">
                  <h1>🎉 Your GIF is Ready!</h1>
                  <div class="gif-display">
                    <img src="data:image/gif;base64,${base64Gif}" alt="Created GIF">
                  </div>
                  <div class="info">
                    <p>Created with YouTube GIF Maker Extension</p>
                    <p>File size: ${(gifData.length / 1024).toFixed(1)} KB</p>
                  </div>
                  <div class="success-badge">
                    ✅ Successfully Created from YouTube
                  </div>
                </div>
              </body>
              </html>
            `;
            
            await gifDisplayPage.setContent(htmlContent);
            
            // Keep showing the GIF for several seconds
            await page.waitForTimeout(8000);
            
            // Add final annotation
            await gifDisplayPage.evaluate(() => {
              const finalMessage = document.createElement('div');
              finalMessage.style.cssText = `
                position: fixed;
                bottom: 30px;
                left: 50%;
                transform: translateX(-50%);
                background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
                color: white;
                padding: 20px 40px;
                border-radius: 50px;
                font-size: 24px;
                font-weight: bold;
                box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
                z-index: 999999;
                animation: pulse 2s infinite;
              `;
              finalMessage.textContent = '🚀 Create GIFs from any YouTube video instantly!';
              document.body.appendChild(finalMessage);
            });
            
            await page.waitForTimeout(4000);
            
            // Close the GIF display tab
            await gifDisplayPage.close();
            
          } catch (downloadError) {
            console.log('   ⚠️ Download not triggered, checking for alternative save method...');
            
            // Alternative: check if GIF was saved to library
            const saveButton = await page.$('.ytgif-unified-btn-save');
            if (saveButton) {
              await saveButton.click();
              await showAnnotation('💾 GIF Saved to Library!', 3000);
            }
          }
          
          break;
        }
      }
      
      if (!gifCreated) {
        await showAnnotation('⚠️ GIF creation took longer than expected', 3000);
      }
      
      // Final message
      await showAnnotation('Thanks for watching! 🎬', 4000, 'center');
      
      console.log('\n✅ Demo with GIF result complete!');
      console.log('📹 Video saved to: ./demo-videos/');
      
    } catch (error) {
      console.error('❌ Error during demo:', error);
    } finally {
      await page.waitForTimeout(2000);
      await browser.close();
    }
  });
});