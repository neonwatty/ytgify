const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SCREENSHOTS_DIR = path.join(__dirname, '../screenshots');
const OUTPUT_DIR = path.join(__dirname, '../store-assets/screenshots');

// Chrome Store requires 1280x800 or 640x400
const TARGET_WIDTH = 1280;
const TARGET_HEIGHT = 800;

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function processScreenshots() {
  const files = fs.readdirSync(SCREENSHOTS_DIR).filter(f => f.endsWith('.png'));

  console.log(`Found ${files.length} screenshots to process\n`);

  for (let i = 0; i < files.length; i++) {
    const inputFile = path.join(SCREENSHOTS_DIR, files[i]);
    const outputFile = path.join(OUTPUT_DIR, `screenshot-${i + 1}.png`);

    try {
      // Get metadata to determine best approach
      const metadata = await sharp(inputFile).metadata();
      console.log(`Processing ${files[i]} (${metadata.width}x${metadata.height})`);

      // Resize and pad to fit 1280x800 with white background
      await sharp(inputFile)
        .resize(TARGET_WIDTH, TARGET_HEIGHT, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 1 },
          withoutEnlargement: false
        })
        .png()
        .toFile(outputFile);

      console.log(`  ✓ Created screenshot-${i + 1}.png (${TARGET_WIDTH}x${TARGET_HEIGHT})`);
    } catch (error) {
      console.error(`  ✗ Failed to process ${files[i]}:`, error.message);
    }
  }

  console.log(`\n✅ Screenshots prepared for Chrome Store!`);
  console.log(`Location: ${OUTPUT_DIR}`);
  console.log(`\nNote: Chrome Store accepts 1280x800 or 640x400 screenshots.`);
  console.log(`Your screenshots have been resized and padded to fit 1280x800.`);
}

processScreenshots().catch(console.error);