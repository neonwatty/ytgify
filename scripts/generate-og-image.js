#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-unused-vars */

/**
 * Generate OG Image for YTgify
 *
 * This script creates a 1200x630px PNG image for Open Graph social sharing.
 *
 * Usage:
 *   node scripts/generate-og-image.js
 *
 * Output:
 *   - public/og-image.png
 *   - public/twitter-image.png (copy of og-image.png)
 */

const fs = require('fs');
const path = require('path');

// Try to use Puppeteer if available
let puppeteer;
try {
  puppeteer = require('puppeteer');
} catch (err) {
  console.log('⚠️  Puppeteer not installed. Installing it now...');
  console.log('   Run: npm install --save-dev puppeteer');
  console.log('');
  console.log('Alternative: Open scripts/generate-og-image.html in your browser');
  console.log('and take a screenshot of the 1200x630px preview.');
  process.exit(1);
}

async function generateOGImage() {
  console.log('🎨 Generating OG Image for YTgify...\n');

  const browser = await puppeteer.launch({
    headless: 'new',
  });

  const page = await browser.newPage();

  // Set viewport to exact OG image dimensions
  await page.setViewport({
    width: 1200,
    height: 630,
    deviceScaleFactor: 2, // Retina quality
  });

  // Load the HTML generator
  const htmlPath = path.join(__dirname, 'generate-og-image.html');
  await page.goto(`file://${htmlPath}`, {
    waitUntil: 'networkidle0',
  });

  // Wait for fonts and images to load
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Take screenshot of the OG image element
  const element = await page.$('#og-image');
  const screenshot = await element.screenshot({
    type: 'png',
    omitBackground: false,
  });

  // Save to public directory
  const publicDir = path.join(__dirname, '..', 'public');
  const ogImagePath = path.join(publicDir, 'og-image.png');
  const twitterImagePath = path.join(publicDir, 'twitter-image.png');

  // Ensure public directory exists
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  // Save the images
  fs.writeFileSync(ogImagePath, screenshot);
  fs.writeFileSync(twitterImagePath, screenshot); // Twitter uses same image

  await browser.close();

  console.log('✅ OG images generated successfully!\n');
  console.log(`   📁 ${ogImagePath}`);
  console.log(`   📁 ${twitterImagePath}`);
  console.log('');

  // Get file sizes
  const stats = fs.statSync(ogImagePath);
  const fileSizeInKB = (stats.size / 1024).toFixed(2);
  console.log(`   📊 Size: ${fileSizeInKB} KB`);
  console.log(`   📐 Dimensions: 1200x630px (2x retina)`);
  console.log('');
  console.log('🎉 Done! Your OG images are ready for social sharing.');
}

// Run the generator
generateOGImage().catch((err) => {
  console.error('❌ Error generating OG image:', err);
  process.exit(1);
});
