const { chromium } = require('playwright');
const path = require('path');

(async () => {
  console.log('=== Test with 10 frames max ===\n');
  
  const extensionPath = path.join(process.cwd(), 'dist');
  
  const browser = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--auto-open-devtools-for-tabs'
    ],
    viewport: { width: 1920, height: 1080 }
  });

  const page = await browser.newPage();
  
  // Set a 30 second timeout for the whole test
  setTimeout(async () => {
    console.log('\n⏰ Test timeout reached (30 seconds)');
    await browser.close();
    process.exit(1);
  }, 30000);
  
  let gifFinished = false;
  
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('Capturing frames')) {
      console.log(`[CAPTURE]: ${text}`);
    }
    if (text.includes('Added frame 10/10')) {
      console.log(`[FRAMES]: All 10 frames added`);
    }
    if (text.includes('About to call gif.render()')) {
      console.log(`[RENDER]: Starting render`);
    }
    if (text.includes('gif.render() called successfully')) {
      console.log(`[RENDER]: Render called`);
    }
    if (text.includes('GIF encoding finished')) {
      gifFinished = true;
      console.log(`✅ FINISHED: ${text}`);
    }
    if (text.includes('progress')) {
      console.log(`[PROGRESS]: ${text}`);
    }
  });
  
  console.log('Opening YouTube...\n');
  await page.goto('https://www.youtube.com/watch?v=jNQXAC9IVRw');
  await page.waitForTimeout(3000);
  
  await page.evaluate(() => {
    const video = document.querySelector('video');
    if (video) {
      video.currentTime = 5;
      video.pause();
    }
  });
  
  console.log('Creating GIF (max 10 frames)...\n');
  await page.click('.ytgif-button');
  await page.waitForSelector('#ytgif-timeline-overlay', { timeout: 5000 });
  await page.click('.ytgif-timeline-create');
  
  // Wait for processing
  console.log('\nWaiting for GIF encoding...\n');
  
  await page.waitForTimeout(25000); // Wait 25 seconds
  
  if (gifFinished) {
    console.log('\n✅ SUCCESS: GIF encoding completed!');
  } else {
    console.log('\n❌ GIF encoding did not complete');
  }
  
  await browser.close();
  process.exit(gifFinished ? 0 : 1);
})();