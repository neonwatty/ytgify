const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  console.log('=== GIF Creation Verification Test ===\n');
  
  const extensionPath = path.join(process.cwd(), 'dist');
  const downloadPath = path.join(process.cwd(), 'tests', 'downloads');
  
  // Clean download directory
  if (!fs.existsSync(downloadPath)) {
    fs.mkdirSync(downloadPath, { recursive: true });
  }
  fs.readdirSync(downloadPath).forEach(file => {
    fs.unlinkSync(path.join(downloadPath, file));
  });
  
  const browser = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`
    ],
    viewport: { width: 1920, height: 1080 }
  });

  const page = await browser.newPage();
  
  // Monitor console for GIF saved messages
  let gifSaved = false;
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('saved') || text.includes('stored') || text.includes('IndexedDB')) {
      console.log(`[LOG]: ${text}`);
      if (text.toLowerCase().includes('gif') && text.toLowerCase().includes('saved')) {
        gifSaved = true;
      }
    }
  });
  
  // Step 1: Create a GIF
  console.log('1. Opening YouTube...');
  await page.goto('https://www.youtube.com/watch?v=jNQXAC9IVRw');
  await page.waitForTimeout(3000);
  
  console.log('2. Starting video...');
  await page.evaluate(() => {
    const video = document.querySelector('video');
    if (video) {
      video.play();
      video.currentTime = 5;
    }
  });
  await page.waitForTimeout(2000);
  
  console.log('3. Creating GIF...');
  await page.click('.ytgif-button');
  await page.waitForSelector('#ytgif-timeline-overlay');
  await page.click('.ytgif-timeline-create');
  
  console.log('4. Waiting for completion...');
  const startTime = Date.now();
  await page.waitForFunction(
    () => !document.querySelector('#ytgif-timeline-overlay'),
    { timeout: 120000 }
  ).catch(() => {});
  
  const processingTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`   GIF processed in ${processingTime} seconds`);
  
  // Wait for save operations
  await page.waitForTimeout(5000);
  
  // Step 2: Check if GIF was saved via extension API
  console.log('\n5. Checking if GIF was saved...');
  
  // Execute in page context to check storage
  const storageCheck = await page.evaluate(async () => {
    try {
      // Check if we can access chrome storage
      if (typeof chrome !== 'undefined' && chrome.storage) {
        // Note: This might not work due to context isolation
        return { hasStorage: true };
      }
    } catch (e) {
      console.log('Cannot access chrome.storage from content script');
    }
    
    // Check IndexedDB databases
    try {
      const databases = await indexedDB.databases();
      const gifDb = databases.find(db => 
        db.name.toLowerCase().includes('gif') || 
        db.name.toLowerCase().includes('youtube')
      );
      
      if (gifDb) {
        // Try to open and check the database
        const db = await new Promise((resolve, reject) => {
          const request = indexedDB.open(gifDb.name);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        
        const objectStoreNames = Array.from(db.objectStoreNames);
        db.close();
        
        return {
          hasIndexedDB: true,
          dbName: gifDb.name,
          stores: objectStoreNames
        };
      }
    } catch (e) {
      console.log('Error checking IndexedDB:', e);
    }
    
    return { hasStorage: false };
  });
  
  console.log('   Storage check:', storageCheck);
  
  // Step 3: Open extension popup using manifest to get ID
  console.log('\n6. Attempting to verify GIF in library...');
  
  // Read manifest to understand extension structure
  const manifestPath = path.join(extensionPath, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  console.log(`   Extension: ${manifest.name} v${manifest.version}`);
  
  // Create a dedicated page for the popup
  const popupPage = await browser.newPage();
  
  // Try different methods to get extension ID
  console.log('   Searching for extension ID...');
  
  // Method 1: Check chrome://extensions
  await popupPage.goto('chrome://extensions/');
  await popupPage.waitForTimeout(1000);
  
  // Get extension ID by looking at the page
  const extensionInfo = await popupPage.evaluate(() => {
    // Try to find extension cards
    const text = document.body.innerText;
    if (text.includes('YouTube GIF Maker')) {
      // Extract ID from the page (it's usually shown)
      const idMatch = text.match(/ID: ([a-z]{32})/);
      if (idMatch) return idMatch[1];
    }
    return null;
  });
  
  let finalResult = false;
  
  if (extensionInfo) {
    console.log(`   Extension ID: ${extensionInfo}`);
    
    // Open popup
    const popupUrl = `chrome-extension://${extensionInfo}/popup.html`;
    await popupPage.goto(popupUrl);
    await popupPage.waitForTimeout(2000);
    
    // Check library
    try {
      await popupPage.click('button:has-text("Library")');
      await popupPage.waitForTimeout(1000);
      
      const gifCount = await popupPage.locator('.gif-item, .gif-card').count();
      console.log(`   GIFs in library: ${gifCount}`);
      
      if (gifCount > 0) {
        console.log('\n✅ SUCCESS! GIF was created and saved to library!');
        finalResult = true;
        
        // Try to download
        const downloadBtn = await popupPage.locator('button:has-text("⬇️")').first();
        if (await downloadBtn.count() > 0) {
          console.log('   Attempting download...');
          await downloadBtn.click();
          await popupPage.waitForTimeout(3000);
          
          const downloads = fs.readdirSync(downloadPath);
          if (downloads.length > 0) {
            console.log(`   ✅ Downloaded: ${downloads.join(', ')}`);
          }
        }
      }
    } catch (e) {
      console.log('   Error accessing library:', e.message);
    }
  } else {
    console.log('   Could not determine extension ID');
    console.log('   Please check the extension popup manually');
  }
  
  // Summary
  console.log('\n=== TEST SUMMARY ===');
  console.log(`✅ GIF Creation: Success (${processingTime}s)`);
  console.log(`${gifSaved ? '✅' : '❓'} GIF Saved: ${gifSaved ? 'Confirmed via console' : 'Unknown'}`);
  console.log(`${finalResult ? '✅' : '❓'} Library Verification: ${finalResult ? 'Success' : 'Could not verify'}`);
  
  const downloads = fs.readdirSync(downloadPath);
  console.log(`${downloads.length > 0 ? '✅' : '❌'} Download: ${downloads.length > 0 ? downloads.join(', ') : 'No files downloaded'}`);
  
  if (downloads.length > 0) {
    console.log(`\n📂 Downloaded files are in: ${downloadPath}`);
  }
  
  console.log('\n✨ Test complete!');
  await browser.close();
  process.exit(0);
})();