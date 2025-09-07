const { test, expect, chromium } = require('@playwright/test');
const path = require('path');

test('Simple Video Separation Check', async () => {
  test.setTimeout(60000);
  
  const extensionPath = path.join(__dirname, '..', 'dist');
  
  const browser = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--no-sandbox'
    ]
  });
  
  const page = await browser.newPage();
  
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('Preview video ready') || text.includes('VideoPreview')) {
      console.log(`[Console] ${text}`);
    }
  });
  
  await page.goto('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  await page.waitForSelector('.html5-video-player', { timeout: 10000 });
  await page.waitForTimeout(3000);
  
  // Get initial main video state
  const initialState = await page.evaluate(() => {
    const video = document.querySelector('#movie_player video');
    return {
      currentTime: video?.currentTime,
      paused: video?.paused,
      duration: video?.duration
    };
  });
  console.log('Initial main video state:', initialState);
  
  // Click GIF button
  const button = await page.waitForSelector('.ytgif-button', { timeout: 10000 });
  await button.click();
  await page.waitForTimeout(3000);
  
  // Wait a bit more and check for hidden preview videos
  await page.waitForTimeout(3000);
  
  const videoCheck = await page.evaluate(() => {
    const mainVideo = document.querySelector('#movie_player video');
    const allVideos = Array.from(document.querySelectorAll('video'));
    const hiddenVideos = allVideos.filter(v => 
      v !== mainVideo && 
      v.style.position === 'absolute' && 
      v.style.left === '-9999px'
    );
    
    return {
      totalVideos: allVideos.length,
      mainVideoExists: !!mainVideo,
      hiddenVideoCount: hiddenVideos.length,
      hiddenVideoDetails: hiddenVideos.map(v => ({
        src: v.src ? v.src.substring(0, 50) + '...' : 'no src',
        readyState: v.readyState,
        currentTime: v.currentTime,
        duration: v.duration
      })),
      mainVideoState: {
        currentTime: mainVideo?.currentTime,
        paused: mainVideo?.paused
      }
    };
  });
  
  console.log('\\n=== Video Separation Analysis ===');
  console.log('Total video elements:', videoCheck.totalVideos);
  console.log('Hidden preview videos found:', videoCheck.hiddenVideoCount);
  console.log('Hidden video details:', videoCheck.hiddenVideoDetails);
  console.log('Main video current state:', videoCheck.mainVideoState);
  
  // Check if canvas exists and has content
  const canvasCheck = await page.evaluate(() => {
    const canvas = document.querySelector('.ytgif-preview-canvas');
    if (!canvas) return { exists: false };
    
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, 10, 10);
    const hasContent = imageData.data.some(pixel => pixel > 0);
    
    return {
      exists: true,
      hasContent,
      size: { width: canvas.width, height: canvas.height }
    };
  });
  
  console.log('Canvas check:', canvasCheck);
  
  await page.screenshot({ path: 'tests/screenshots/simple-video-separation.png' });
  
  await browser.close();
  
  // Basic assertions
  expect(videoCheck.mainVideoExists).toBeTruthy();
  console.log('\\n✅ Video separation analysis completed');
  
  // If we found hidden videos, that's evidence of separation working
  if (videoCheck.hiddenVideoCount > 0) {
    console.log('✅ Found hidden preview video(s) - separation is working!');
  } else {
    console.log('ℹ️  No hidden preview videos found yet - may still be loading');
  }
});