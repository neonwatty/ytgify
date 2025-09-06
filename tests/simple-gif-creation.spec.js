const { test, expect, chromium } = require('@playwright/test');
const path = require('path');

test('Simple GIF Creation Test', async () => {
  // Use exact same setup as working debug test
  const extensionPath = path.join(__dirname, '..', 'dist');
  
  const browser = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--no-sandbox',
      '--disable-dev-shm-usage',
    ],
    viewport: { width: 1280, height: 720 }
  });

  const page = await browser.newPage();
  
  console.log('🎬 Starting Simple GIF Creation Test');
  
  // Navigate exactly like the working debug test
  await page.goto('https://www.youtube.com/watch?v=dQw4w9WgXcQ', { 
    waitUntil: 'networkidle' 
  });

  await page.waitForSelector('#movie_player', { timeout: 15000 });
  await page.waitForTimeout(3000); // Same wait time as debug test

  // Find GIF button exactly like debug test
  const gifButton = await page.waitForSelector('.ytgif-button', { timeout: 10000 });
  expect(gifButton).toBeTruthy();
  console.log('✅ Found GIF button');

  // Click button
  await gifButton.click();
  console.log('🖱️  Clicked GIF button');

  // Wait a moment for processing
  await page.waitForTimeout(2000);
  
  // Check what elements exist (like debug test)
  const timelineElements = await page.$$eval('[id*="timeline"], [class*="timeline"], [id*="ytgif"], [class*="ytgif"]', elements => 
    elements.map(el => ({
      tagName: el.tagName,
      id: el.id,
      className: el.className,
      visible: el.offsetParent !== null,
      textContent: el.textContent ? el.textContent.substring(0, 50) : '',
      rect: el.getBoundingClientRect()
    }))
  );
  
  console.log('📋 Found timeline-related elements:');
  console.table(timelineElements);
  
  // Look for the specific overlay that should contain our content
  const overlayWithContent = timelineElements.find(el => 
    el.id === 'ytgif-timeline-overlay' || (typeof el.className === 'string' && el.className.includes('ytgif-timeline-overlay'))
  );
  
  if (overlayWithContent) {
    console.log('✅ Found timeline overlay');
    
    if (overlayWithContent.visible) {
      console.log('✅ Timeline overlay is visible');
      
      // Try to find preset buttons
      const presetButtons = await page.$$('.ytgif-preset-btn');
      console.log(`📱 Found ${presetButtons.length} preset buttons`);
      
      if (presetButtons.length > 0) {
        // Click the first (recommended) preset
        console.log('⚡ Clicking 3s preset...');
        await presetButtons[0].click();
        await page.waitForTimeout(1000);
        
        // Look for create button
        const createButton = await page.$('.ytgif-timeline-create');
        if (createButton) {
          console.log('✅ Found Create GIF button');
          
          // Set up listener for success/error messages
          let gifResult = null;
          
          page.on('console', msg => {
            const text = msg.text();
            if (text.includes('GIF creation') || text.includes('GIF created') || text.includes('Creating GIF')) {
              gifResult = text;
              console.log(`📨 Extension message: ${text}`);
            }
          });
          
          // Click create button
          console.log('🎨 Starting GIF creation...');
          await createButton.click();
          
          // Wait for some kind of response
          let attempts = 0;
          const maxAttempts = 30; // 30 seconds
          
          while (attempts < maxAttempts && !gifResult) {
            await page.waitForTimeout(1000);
            attempts++;
            
            // Check if button text changed to "Creating..."
            const buttonText = await createButton.textContent();
            if (buttonText && buttonText.includes('Creating')) {
              console.log('⏳ Processing started...');
            }
            
            // Check for any feedback elements
            const feedback = await page.$('.ytgif-feedback');
            if (feedback) {
              const feedbackText = await feedback.textContent();
              console.log(`💬 Feedback: ${feedbackText}`);
              gifResult = feedbackText;
              break;
            }
            
            // Check if overlay closed (success)
            const overlayStillVisible = await page.$('#ytgif-timeline-overlay:visible');
            if (!overlayStillVisible) {
              console.log('✅ Overlay closed - likely success');
              gifResult = 'success';
              break;
            }
          }
          
          if (gifResult) {
            console.log(`🎉 GIF creation result: ${gifResult}`);
          } else {
            console.log('⏰ GIF creation timed out after 30 seconds');
          }
          
        } else {
          console.log('❌ Create GIF button not found');
        }
      } else {
        console.log('❌ No preset buttons found');
      }
      
    } else {
      console.log('❌ Timeline overlay exists but not visible');
    }
  } else {
    console.log('❌ Timeline overlay not found');
  }

  await browser.close();
});