const { test, chromium } = require('@playwright/test');
const path = require('path');

test('Debug: Check console for errors', async () => {
  const extensionPath = path.join(__dirname, '..', 'dist');
  
  const browser = await chromium.launch({
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--no-sandbox'
    ]
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Capture ALL console messages
  const consoleLogs = [];
  page.on('console', msg => {
    const text = msg.text();
    const type = msg.type();
    consoleLogs.push({ type, text });
    
    if (type === 'error' || type === 'warning') {
      console.log(`[${type.toUpperCase()}]`, text);
    } else if (text.includes('PlayerIntegration') || text.includes('[Content]') || text.includes('button') || text.includes('GIF')) {
      console.log(`[${type}]`, text);
    }
  });
  
  page.on('pageerror', error => {
    console.error('[PAGE ERROR]', error.message);
  });
  
  console.log('Opening YouTube...');
  await page.goto('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  await page.waitForSelector('.html5-video-player', { timeout: 10000 });
  
  console.log('Waiting for extension to initialize...');
  await page.waitForTimeout(8000);
  
  // Check for button
  const button = await page.$('.ytgif-button, .ytp-right-controls .ytgif-button');
  console.log('Button found:', !!button);
  
  // Log summary
  console.log('\n=== Console Summary ===');
  const errors = consoleLogs.filter(log => log.type === 'error');
  const warnings = consoleLogs.filter(log => log.type === 'warning');
  const contentLogs = consoleLogs.filter(log => log.text.includes('[Content]'));
  const playerLogs = consoleLogs.filter(log => log.text.includes('PlayerIntegration'));
  
  console.log(`Total logs: ${consoleLogs.length}`);
  console.log(`Errors: ${errors.length}`);
  console.log(`Warnings: ${warnings.length}`);
  console.log(`Content logs: ${contentLogs.length}`);
  console.log(`Player logs: ${playerLogs.length}`);
  
  if (errors.length > 0) {
    console.log('\n=== Errors ===');
    errors.slice(0, 5).forEach(e => console.log(e.text));
  }
  
  await browser.close();
});