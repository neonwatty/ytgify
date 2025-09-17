const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SIZES = [16, 32, 48, 128];
const INPUT_SVG = path.join(__dirname, '../logos/ytgify-logo.svg');
const OUTPUT_DIR = path.join(__dirname, '../icons');

// Create an optimized SVG that uses more visual space
const OPTIMIZED_SVG = `<svg width="128" height="128" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Red to Purple gradient -->
    <linearGradient id="redPurpleGradient" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#ff0000;stop-opacity:1" />
      <stop offset="50%" style="stop-color:#ff0066;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
    </linearGradient>

    <!-- Subtle glow effect -->
    <filter id="softGlow">
      <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <!-- Larger circular background - using more space -->
  <circle cx="64" cy="64" r="60" fill="#0f0f0f"/>
  <circle cx="64" cy="64" r="59" fill="none" stroke="url(#redPurpleGradient)" stroke-width="1.5" opacity="0.4"/>

  <!-- Larger play button arrow -->
  <g transform="translate(70, 64) scale(1.35)" filter="url(#softGlow)">
    <!-- Slice 1 - Pure Red -->
    <clipPath id="g1">
      <rect x="-40" y="-32" width="80" height="11"/>
    </clipPath>
    <path d="M -30 -32 L 34 0 L -30 32 Z" fill="#ff0000" clip-path="url(#g1)"/>

    <!-- Slice 2 - Red to Pink -->
    <clipPath id="g2">
      <rect x="-40" y="-19" width="80" height="11"/>
    </clipPath>
    <path d="M -30 -32 L 34 0 L -30 32 Z" fill="#ff0066" clip-path="url(#g2)"/>

    <!-- Slice 3 - Pink to Purple -->
    <clipPath id="g3">
      <rect x="-40" y="-6" width="80" height="11"/>
    </clipPath>
    <path d="M -30 -32 L 34 0 L -30 32 Z" fill="#cc3399" clip-path="url(#g3)"/>

    <!-- Slice 4 - Purple -->
    <clipPath id="g4">
      <rect x="-40" y="7" width="80" height="11"/>
    </clipPath>
    <path d="M -30 -32 L 34 0 L -30 32 Z" fill="#9966cc" clip-path="url(#g4)"/>

    <!-- Slice 5 - Deep Purple -->
    <clipPath id="g5">
      <rect x="-40" y="20" width="80" height="12"/>
    </clipPath>
    <path d="M -30 -32 L 34 0 L -30 32 Z" fill="#764ba2" clip-path="url(#g5)"/>
  </g>
</svg>`;

// Save optimized SVG
const OPTIMIZED_SVG_PATH = path.join(OUTPUT_DIR, 'icon-optimized.svg');
fs.writeFileSync(OPTIMIZED_SVG_PATH, OPTIMIZED_SVG);
console.log('✓ Created optimized SVG with fuller visual space usage');

// Copy optimized SVG as the main icon.svg
fs.writeFileSync(path.join(OUTPUT_DIR, 'icon.svg'), OPTIMIZED_SVG);
console.log('✓ Updated icons/icon.svg with optimized version');

// Generate PNG icons from optimized SVG
async function generateIcons() {
  for (const size of SIZES) {
    const outputPath = path.join(OUTPUT_DIR, `icon${size}.png`);

    try {
      // For smaller sizes (16, 32), we might want even more aggressive scaling
      let scaleFactor = 1;
      if (size <= 32) {
        scaleFactor = 1.1; // Make small icons slightly larger for better visibility
      }

      await sharp(Buffer.from(OPTIMIZED_SVG))
        .resize(Math.round(size * scaleFactor), Math.round(size * scaleFactor), {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .resize(size, size, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png()
        .toFile(outputPath);

      console.log(`✓ Generated ${size}x${size} icon: icon${size}.png (optimized for visibility)`);
    } catch (error) {
      console.error(`✗ Failed to generate ${size}x${size} icon:`, error);
    }
  }

  // Also update store assets
  const storeAssetsDir = path.join(__dirname, '../store-assets');
  if (fs.existsSync(storeAssetsDir)) {
    const icon128Path = path.join(OUTPUT_DIR, 'icon128.png');
    if (fs.existsSync(icon128Path)) {
      fs.copyFileSync(icon128Path, path.join(storeAssetsDir, 'icon-128.png'));
      console.log('✓ Updated store-assets/icon-128.png');
    }
  }

  console.log('\n✅ Optimized icon generation complete!');
  console.log('Icons now use more visual space for better visibility in the extensions bar.');
}

generateIcons().catch(console.error);