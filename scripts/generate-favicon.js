const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const INPUT_SVG = path.join(__dirname, '../logos/ytgify-logo.svg');
const OUTPUT_DIR = path.join(__dirname, '..');

// Generate favicon.png (32x32 is standard for modern browsers)
async function generateFavicon() {
  const faviconPath = path.join(OUTPUT_DIR, 'favicon.png');

  try {
    await sharp(INPUT_SVG)
      .resize(32, 32, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toFile(faviconPath);

    console.log('✓ Generated favicon.png (32x32)');

    // Also create a 16x16 version for legacy support
    const favicon16Path = path.join(OUTPUT_DIR, 'favicon-16.png');
    await sharp(INPUT_SVG)
      .resize(16, 16, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toFile(favicon16Path);

    console.log('✓ Generated favicon-16.png (16x16)');
    console.log('\nFavicon generation complete!');
    console.log('Note: Modern browsers prefer PNG favicons over .ico format');
  } catch (error) {
    console.error('Failed to generate favicon:', error);
  }
}

generateFavicon().catch(console.error);