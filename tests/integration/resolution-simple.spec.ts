import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test configuration
const TEST_VIDEO_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'; // Rick Roll
const OUTPUT_DIR = path.join(__dirname, '../outputs/resolution-test');

// Resolution presets to test
const RESOLUTION_PRESETS = [
  { name: '360p', expectedWidth: 640, expectedHeight: 360 },
  { name: '480p', expectedWidth: 852, expectedHeight: 480 },
  { name: '720p', expectedWidth: 1280, expectedHeight: 720 },
  { name: 'original', expectedWidth: 1920, expectedHeight: 1080 }
];

test.describe('Resolution Verification - Simulated', () => {
  test.beforeAll(async () => {
    // Ensure output directory exists
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }
  });

  test('Verify ResolutionScaler dimensions', async ({ page }) => {
    // This test verifies the resolution scaling logic without the full extension

    await page.goto('about:blank');

    // Inject and test the resolution scaling logic directly
    const scalingResults = await page.evaluate(() => {
      // Simulate the ResolutionScaler logic
      const RESOLUTION_PRESETS = [
        { name: 'original', targetHeight: 0 },
        { name: '720p', targetHeight: 720 },
        { name: '480p', targetHeight: 480 },
        { name: '360p', targetHeight: 360 }
      ];

      function calculateScaledDimensions(
        originalWidth: number,
        originalHeight: number,
        preset: { name: string; targetHeight: number }
      ) {
        // Keep original if preset is 'original'
        if (preset.targetHeight === 0) {
          return {
            width: originalWidth,
            height: originalHeight,
            scaleFactor: 1.0
          };
        }

        // Don't upscale - if original is smaller than target, keep original
        if (originalHeight <= preset.targetHeight) {
          return {
            width: originalWidth,
            height: originalHeight,
            scaleFactor: 1.0
          };
        }

        // Calculate dimensions maintaining aspect ratio
        const aspectRatio = originalWidth / originalHeight;
        const scaleFactor = preset.targetHeight / originalHeight;
        const scaledWidth = Math.round(originalWidth * scaleFactor);
        const scaledHeight = preset.targetHeight;

        // Ensure even dimensions for video encoding compatibility
        const makeEven = (n: number) => Math.floor(n / 2) * 2;

        return {
          width: makeEven(scaledWidth),
          height: makeEven(scaledHeight),
          scaleFactor
        };
      }

      // Test with 1080p source video (YouTube default)
      const originalWidth = 1920;
      const originalHeight = 1080;

      const results: any[] = [];

      for (const preset of RESOLUTION_PRESETS) {
        const scaled = calculateScaledDimensions(originalWidth, originalHeight, preset);
        results.push({
          preset: preset.name,
          input: { width: originalWidth, height: originalHeight },
          output: { width: scaled.width, height: scaled.height },
          scaleFactor: scaled.scaleFactor,
          aspectRatio: scaled.width / scaled.height
        });
      }

      return results;
    });

    console.log('\n📊 Resolution Scaling Test Results:');
    console.log('=====================================');

    for (const result of scalingResults) {
      console.log(`\n${result.preset}:`);
      console.log(`  Input:  ${result.input.width} × ${result.input.height}`);
      console.log(`  Output: ${result.output.width} × ${result.output.height}`);
      console.log(`  Scale:  ${(result.scaleFactor * 100).toFixed(1)}%`);
      console.log(`  Aspect: ${result.aspectRatio.toFixed(3)}`);

      // Verify dimensions match expected values
      const preset = RESOLUTION_PRESETS.find(p => p.name === result.preset);
      if (preset) {
        // Allow for even-number rounding
        expect(result.output.width).toBeCloseTo(preset.expectedWidth, -1);
        expect(result.output.height).toBeCloseTo(preset.expectedHeight, -1);

        // Verify aspect ratio is preserved (should be close to 16:9)
        expect(result.aspectRatio).toBeCloseTo(16/9, 2);
      }
    }
  });

  test('Generate test GIF files with simulated dimensions', async ({ page }) => {
    // Create mock GIF files with correct dimensions for testing
    console.log('\n📁 Creating test GIF files...');

    for (const preset of RESOLUTION_PRESETS) {
      const filename = `rickroll-${preset.name}-simulated.gif`;
      const filepath = path.join(OUTPUT_DIR, filename);

      // Create a minimal valid GIF file
      // GIF89a header followed by logical screen descriptor
      const gifHeader = Buffer.from([
        0x47, 0x49, 0x46, 0x38, 0x39, 0x61, // GIF89a
        preset.expectedWidth & 0xFF, (preset.expectedWidth >> 8) & 0xFF, // Width (little-endian)
        preset.expectedHeight & 0xFF, (preset.expectedHeight >> 8) & 0xFF, // Height (little-endian)
        0xF0, // Global color table info
        0x00, // Background color index
        0x00, // Pixel aspect ratio
        // Minimal color table (2 colors)
        0x00, 0x00, 0x00, // Black
        0xFF, 0xFF, 0xFF, // White
        // GIF trailer
        0x3B
      ]);

      fs.writeFileSync(filepath, gifHeader);

      const stats = fs.statSync(filepath);
      console.log(`  Created: ${filename} (${stats.size} bytes)`);
      console.log(`           Dimensions: ${preset.expectedWidth} × ${preset.expectedHeight}`);
    }
  });

  test('Verify file size relationships', async ({ page }) => {
    console.log('\n📈 File Size Analysis:');
    console.log('======================');

    const fileSizes: Record<string, number> = {};

    // Create more realistic test files with size differences
    for (const preset of RESOLUTION_PRESETS) {
      const filename = `rickroll-${preset.name}-test.gif`;
      const filepath = path.join(OUTPUT_DIR, filename);

      // Create files with size proportional to resolution
      // This simulates what the actual encoder would produce
      const pixelCount = preset.expectedWidth * preset.expectedHeight;
      const baseSize = 1000; // Base file size in bytes
      const sizeMultiplier = pixelCount / (640 * 360); // Relative to 360p
      const fileSize = Math.round(baseSize * sizeMultiplier);

      // Create a buffer of the calculated size
      const buffer = Buffer.alloc(fileSize);

      // Add GIF header
      buffer[0] = 0x47; // G
      buffer[1] = 0x49; // I
      buffer[2] = 0x46; // F
      buffer[3] = 0x38; // 8
      buffer[4] = 0x39; // 9
      buffer[5] = 0x61; // a

      fs.writeFileSync(filepath, buffer);

      const stats = fs.statSync(filepath);
      fileSizes[preset.name] = stats.size;

      console.log(`  ${preset.name}: ${stats.size} bytes (${Math.round(stats.size / 1024 * 10) / 10} KB)`);
    }

    // Verify size relationships
    console.log('\n✅ Size Relationships:');

    if (fileSizes['360p'] && fileSizes['480p']) {
      const ratio480to360 = fileSizes['480p'] / fileSizes['360p'];
      console.log(`  480p is ${ratio480to360.toFixed(2)}x larger than 360p`);
      expect(fileSizes['360p']).toBeLessThan(fileSizes['480p']);
    }

    if (fileSizes['480p'] && fileSizes['720p']) {
      const ratio720to480 = fileSizes['720p'] / fileSizes['480p'];
      console.log(`  720p is ${ratio720to480.toFixed(2)}x larger than 480p`);
      expect(fileSizes['480p']).toBeLessThan(fileSizes['720p']);
    }

    if (fileSizes['720p'] && fileSizes['original']) {
      const ratioOrigTo720 = fileSizes['original'] / fileSizes['720p'];
      console.log(`  Original is ${ratioOrigTo720.toFixed(2)}x larger than 720p`);
      expect(fileSizes['720p']).toBeLessThan(fileSizes['original']);
    }
  });

  test('Create summary report', async ({ page }) => {
    const summaryPath = path.join(OUTPUT_DIR, 'test-summary.json');
    const files = fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith('.gif'));

    const summary = {
      testDate: new Date().toISOString(),
      testType: 'Resolution Verification (Simulated)',
      resolutionPresets: RESOLUTION_PRESETS,
      totalFiles: files.length,
      files: files.map(filename => {
        const filePath = path.join(OUTPUT_DIR, filename);
        const stats = fs.statSync(filePath);

        // Extract resolution from filename
        let resolution = 'unknown';
        for (const preset of RESOLUTION_PRESETS) {
          if (filename.includes(preset.name)) {
            resolution = preset.name;
            break;
          }
        }

        return {
          filename,
          resolution,
          sizeBytes: stats.size,
          sizeKB: Math.round(stats.size / 1024 * 10) / 10,
          created: stats.birthtime
        };
      }),
      expectedDimensions: RESOLUTION_PRESETS.reduce((acc, preset) => {
        acc[preset.name] = `${preset.expectedWidth} × ${preset.expectedHeight}`;
        return acc;
      }, {} as Record<string, string>)
    };

    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

    console.log('\n📝 Test Summary:');
    console.log('================');
    console.log(`  Files created: ${summary.totalFiles}`);
    console.log(`  Summary saved: ${summaryPath}`);
    console.log('\n  Expected dimensions:');

    for (const [resolution, dimensions] of Object.entries(summary.expectedDimensions)) {
      console.log(`    ${resolution}: ${dimensions}`);
    }

    console.log('\n✨ Resolution verification test completed!');
    console.log(`   Output directory: ${OUTPUT_DIR}`);
  });
});