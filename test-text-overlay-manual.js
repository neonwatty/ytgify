// Simple test to verify text overlay data flow
const { chromium } = require('playwright');
const path = require('path');

async function testTextOverlay() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();

  // Load the extension
  const extensionPath = path.join(__dirname, 'dist');
  await context.addInitScript({ path: path.join(extensionPath, 'content.js') });

  const page = await context.newPage();
  
  // Navigate to YouTube
  await page.goto('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  await page.waitForLoadState('domcontentloaded');

  console.log('Loaded YouTube page');

  // Wait for extension to load
  await page.waitForTimeout(3000);

  // Check if the GIF button exists
  const gifButton = await page.$('.ytgif-button');
  if (gifButton) {
    console.log('✓ GIF button found');
    
    // Click the GIF button
    await gifButton.click();
    console.log('✓ Clicked GIF button');

    // Wait for wizard to appear
    await page.waitForTimeout(2000);
    
    // Check if wizard appeared
    const wizard = await page.$('.ytgif-overlay-wizard');
    if (wizard) {
      console.log('✓ Wizard appeared');
      
      // Take a screenshot for manual verification
      await page.screenshot({ path: 'test-wizard-screenshot.png', fullPage: true });
      console.log('✓ Screenshot saved as test-wizard-screenshot.png');
      
    } else {
      console.log('✗ Wizard did not appear');
    }
  } else {
    console.log('✗ GIF button not found');
  }

  // Keep browser open for manual testing
  console.log('Browser will stay open for manual testing...');
  await page.waitForTimeout(60000); // Wait 1 minute for manual testing

  await browser.close();
}

testTextOverlay().catch(console.error);