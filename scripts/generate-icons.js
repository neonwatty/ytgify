const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SIZES = [16, 32, 48, 128];
const INPUT_SVG = path.join(__dirname, '../logos/ytgify-logo.svg');
const OUTPUT_DIR = path.join(__dirname, '../icons');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Copy SVG to icons directory as source
fs.copyFileSync(INPUT_SVG, path.join(OUTPUT_DIR, 'icon.svg'));
console.log('✓ Copied source SVG to icons/icon.svg');

// Generate PNG icons
async function generateIcons() {
  for (const size of SIZES) {
    const outputPath = path.join(OUTPUT_DIR, `icon${size}.png`);

    try {
      await sharp(INPUT_SVG)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png()
        .toFile(outputPath);

      console.log(`✓ Generated ${size}x${size} icon: icon${size}.png`);
    } catch (error) {
      console.error(`✗ Failed to generate ${size}x${size} icon:`, error);
    }
  }

  // Also create a copy for store assets
  const storeAssetsDir = path.join(__dirname, '../store-assets');
  if (!fs.existsSync(storeAssetsDir)) {
    fs.mkdirSync(storeAssetsDir, { recursive: true });
  }

  // Copy 128px icon to store assets
  const icon128Path = path.join(OUTPUT_DIR, 'icon128.png');
  if (fs.existsSync(icon128Path)) {
    fs.copyFileSync(icon128Path, path.join(storeAssetsDir, 'icon-128.png'));
    console.log('✓ Copied 128x128 icon to store-assets/');
  }

  console.log('\n✅ Icon generation complete!');
  console.log('Icons saved to:', OUTPUT_DIR);
}

generateIcons().catch(console.error);