import { Page } from '@playwright/test';

/**
 * GIF validation utilities for mock E2E tests
 * These work with data URLs and blob URLs instead of file paths
 */

export interface GifMetadata {
  width: number;
  height: number;
  frameCount: number;
  duration: number; // in seconds
  fps: number;
  fileSize: number; // in bytes
  hasTransparency: boolean;
}

export interface ResolutionSpec {
  name: string;
  width: number;
  height: number;
  tolerance: number; // pixels tolerance
}

// Expected resolutions based on wizard settings
export const RESOLUTION_SPECS: Record<string, ResolutionSpec> = {
  '144p': { name: '144p', width: 256, height: 144, tolerance: 10 },
  '240p': { name: '240p', width: 426, height: 240, tolerance: 10 },
  '360p': { name: '360p', width: 640, height: 360, tolerance: 10 },
  '480p': { name: '480p', width: 854, height: 480, tolerance: 10 },
};

/**
 * Convert data URL or blob URL to Buffer
 * For blob URLs, we need to fetch them first
 */
export async function urlToBuffer(page: Page, url: string): Promise<Buffer> {
  if (url.startsWith('data:image/gif;base64,')) {
    // Data URL - extract base64 and convert
    const base64Data = url.replace(/^data:image\/gif;base64,/, '');
    return Buffer.from(base64Data, 'base64');
  } else if (url.startsWith('blob:')) {
    // Blob URL - need to fetch via page context
    const base64 = await page.evaluate(async (blobUrl) => {
      const response = await fetch(blobUrl);
      const blob = await response.blob();
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const dataUrl = reader.result as string;
          const base64 = dataUrl.split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }, url);
    return Buffer.from(base64, 'base64');
  } else {
    throw new Error(`Unsupported URL type: ${url}`);
  }
}

/**
 * Parse GIF buffer and extract metadata
 * GIF87a/GIF89a format parser - works with Buffer instead of file paths
 */
export function extractGifMetadataFromBuffer(buffer: Buffer): GifMetadata {
  // Verify GIF signature
  const signature = buffer.toString('ascii', 0, 6);
  if (signature !== 'GIF87a' && signature !== 'GIF89a') {
    throw new Error(`Invalid GIF signature: ${signature}`);
  }

  // Read logical screen descriptor (bytes 6-12)
  const width = buffer.readUInt16LE(6);
  const height = buffer.readUInt16LE(8);
  const packedFields = buffer[10];

  // Check for Global Color Table
  const hasGlobalColorTable = (packedFields & 0x80) !== 0;
  const globalColorTableSize = hasGlobalColorTable ? 2 ** ((packedFields & 0x07) + 1) : 0;
  const globalColorTableBytes = globalColorTableSize * 3;

  // Count frames by looking for image separator (0x2C)
  let frameCount = 0;
  // Start after header, logical screen descriptor, AND global color table (if present)
  let position = 13 + globalColorTableBytes;

  while (position < buffer.length) {
    const byte = buffer[position];

    if (byte === 0x21) { // Extension introducer
      // Skip extension blocks
      position += 2; // Skip extension label
      let blockSize = buffer[position];
      while (blockSize > 0) {
        position += blockSize + 1;
        if (position >= buffer.length) break;
        blockSize = buffer[position];
      }
      position++; // Skip block terminator
    } else if (byte === 0x2C) { // Image separator
      frameCount++;
      position++; // Move past separator

      // Read image descriptor (9 bytes): left, top, width, height, packed fields
      position += 9;

      // Check for local color table
      const localPackedFields = buffer[position - 1]; // Last byte of image descriptor
      const hasLocalColorTable = (localPackedFields & 0x80) !== 0;

      if (hasLocalColorTable) {
        const localColorTableSize = 2 ** ((localPackedFields & 0x07) + 1);
        const localColorTableBytes = localColorTableSize * 3;
        position += localColorTableBytes;
      }

      // Skip image data (LZW + sub-blocks)
      const lzwMinimum = buffer[position];
      position++; // LZW minimum code size

      // Skip sub-blocks
      let subBlockSize = buffer[position];
      while (subBlockSize > 0) {
        position += subBlockSize + 1;
        if (position >= buffer.length) break;
        subBlockSize = buffer[position];
      }
      position++; // Skip block terminator
    } else if (byte === 0x3B) { // Trailer (end of file)
      break;
    } else {
      position++;
    }
  }

  // Get file size
  const fileSize = buffer.length;

  // Parse duration by looking for Graphic Control Extensions
  // Use same structure-aware parsing as frame counting
  let totalDelay = 0;
  position = 13 + globalColorTableBytes;

  while (position < buffer.length) {
    const byte = buffer[position];

    if (byte === 0x21) { // Extension introducer
      const extensionLabel = buffer[position + 1];

      if (extensionLabel === 0xF9) {
        // Graphic Control Extension - contains frame delay
        position += 2; // Skip introducer and label
        const blockSize = buffer[position];
        position++; // Move to block data

        // Read delay time (2 bytes, little-endian, in 1/100ths of a second)
        const delay = buffer.readUInt16LE(position + 1);
        totalDelay += delay;

        // Skip rest of block and terminator
        position += blockSize + 1;
      } else {
        // Other extension - skip it
        position += 2; // Skip introducer and label
        let blockSize = buffer[position];
        while (blockSize > 0) {
          position += blockSize + 1;
          if (position >= buffer.length) break;
          blockSize = buffer[position];
        }
        position++; // Skip block terminator
      }
    } else if (byte === 0x2C) { // Image separator
      position++; // Move past separator

      // Read image descriptor (9 bytes)
      position += 9;

      // Check for local color table
      const localPackedFields = buffer[position - 1];
      const hasLocalColorTable = (localPackedFields & 0x80) !== 0;

      if (hasLocalColorTable) {
        const localColorTableSize = 2 ** ((localPackedFields & 0x07) + 1);
        const localColorTableBytes = localColorTableSize * 3;
        position += localColorTableBytes;
      }

      // Skip image data (LZW + sub-blocks)
      position++; // Skip LZW minimum code size

      // Skip sub-blocks
      let subBlockSize = buffer[position];
      while (subBlockSize > 0) {
        position += subBlockSize + 1;
        if (position >= buffer.length) break;
        subBlockSize = buffer[position];
      }
      position++; // Skip block terminator
    } else if (byte === 0x3B) { // Trailer (end of file)
      break;
    } else {
      position++;
    }
  }

  const duration = totalDelay / 100; // Convert to seconds
  const fps = frameCount > 0 && duration > 0 ? frameCount / duration : 0;

  return {
    width,
    height,
    frameCount,
    duration,
    fps: Math.round(fps),
    fileSize,
    hasTransparency: signature === 'GIF89a', // GIF89a supports transparency
  };
}

/**
 * Extract GIF metadata from data URL or blob URL
 * This is the main entry point for mock tests
 */
export async function extractGifMetadata(
  page: Page,
  gifUrl: string
): Promise<GifMetadata> {
  const buffer = await urlToBuffer(page, gifUrl);
  return extractGifMetadataFromBuffer(buffer);
}

/**
 * Validate GIF resolution matches expected settings
 */
export function validateResolution(
  metadata: GifMetadata,
  expectedResolution: '144p' | '240p' | '360p' | '480p'
): { valid: boolean; message: string } {
  const spec = RESOLUTION_SPECS[expectedResolution];

  const widthDiff = Math.abs(metadata.width - spec.width);
  const heightDiff = Math.abs(metadata.height - spec.height);

  const valid = widthDiff <= spec.tolerance && heightDiff <= spec.tolerance;

  const message = valid
    ? `Resolution matches ${expectedResolution}: ${metadata.width}x${metadata.height}`
    : `Resolution mismatch! Expected ${spec.width}x${spec.height} (±${spec.tolerance}px) for ${expectedResolution}, got ${metadata.width}x${metadata.height}`;

  return { valid, message };
}

/**
 * Validate GIF frame rate matches expected settings
 */
export function validateFrameRate(
  metadata: GifMetadata,
  expectedFps: number,
  tolerance: number = 2 // Slightly higher tolerance for GIF encoding variations
): { valid: boolean; message: string } {
  const fpsDiff = Math.abs(metadata.fps - expectedFps);
  const valid = fpsDiff <= tolerance;

  const message = valid
    ? `Frame rate matches: ${metadata.fps} fps (expected ${expectedFps} fps)`
    : `Frame rate mismatch! Expected ${expectedFps} fps (±${tolerance}), got ${metadata.fps} fps`;

  return { valid, message };
}

/**
 * Validate GIF duration matches expected settings
 */
export function validateDuration(
  metadata: GifMetadata,
  expectedDuration: number,
  tolerance: number = 0.5
): { valid: boolean; message: string } {
  const durationDiff = Math.abs(metadata.duration - expectedDuration);
  const valid = durationDiff <= tolerance;

  const message = valid
    ? `Duration matches: ${metadata.duration.toFixed(1)}s (expected ${expectedDuration}s)`
    : `Duration mismatch! Expected ${expectedDuration}s (±${tolerance}s), got ${metadata.duration.toFixed(1)}s`;

  return { valid, message };
}

/**
 * Validate expected file size based on settings
 */
export function validateFileSize(
  metadata: GifMetadata,
  resolution: '144p' | '240p' | '360p' | '480p',
  fps: number,
  duration: number
): { valid: boolean; message: string; sizeInMB: number } {
  // Estimate expected file size based on settings
  const spec = RESOLUTION_SPECS[resolution];
  const pixels = spec.width * spec.height;
  const frames = Math.round(fps * duration);

  // Rough estimation: ~1-2 bytes per pixel per frame for GIF
  // This varies greatly based on content complexity
  const minExpectedSize = pixels * frames * 0.5;
  const maxExpectedSize = pixels * frames * 3;

  const sizeInMB = metadata.fileSize / (1024 * 1024);
  const valid = metadata.fileSize >= minExpectedSize && metadata.fileSize <= maxExpectedSize;

  const message = valid
    ? `File size reasonable: ${sizeInMB.toFixed(2)} MB for ${resolution} @ ${fps}fps, ${duration}s`
    : `File size unexpected: ${sizeInMB.toFixed(2)} MB (expected ${(minExpectedSize / 1024 / 1024).toFixed(2)}-${(maxExpectedSize / 1024 / 1024).toFixed(2)} MB)`;

  return { valid, message, sizeInMB };
}

/**
 * Validate GIF from data URL or blob URL
 */
export async function validateGifFromUrl(
  page: Page,
  gifUrl: string,
  expectedSettings: {
    resolution: '144p' | '240p' | '360p' | '480p';
    fps: number;
    duration: number;
  }
): Promise<{
  valid: boolean;
  metadata: GifMetadata;
  validationResults: {
    resolution: { valid: boolean; message: string };
    frameRate: { valid: boolean; message: string };
    duration: { valid: boolean; message: string };
  };
}> {
  const metadata = await extractGifMetadata(page, gifUrl);

  const validationResults = {
    resolution: validateResolution(metadata, expectedSettings.resolution),
    frameRate: validateFrameRate(metadata, expectedSettings.fps),
    duration: validateDuration(metadata, expectedSettings.duration),
  };

  const valid =
    validationResults.resolution.valid &&
    validationResults.frameRate.valid &&
    validationResults.duration.valid;

  return { valid, metadata, validationResults };
}

/**
 * Complete validation suite for a GIF from URL
 */
export async function validateGifComplete(
  page: Page,
  gifUrl: string,
  expectedSettings: {
    resolution: '144p' | '240p' | '360p' | '480p';
    fps: number;
    duration: number;
    hasText?: boolean;
  }
): Promise<{
  passed: boolean;
  metadata: GifMetadata;
  results: {
    resolution: { valid: boolean; message: string };
    frameRate: { valid: boolean; message: string };
    duration: { valid: boolean; message: string };
    fileSize: { valid: boolean; message: string; sizeInMB: number };
  };
  summary: string;
}> {
  const metadata = await extractGifMetadata(page, gifUrl);

  const results = {
    resolution: validateResolution(metadata, expectedSettings.resolution),
    frameRate: validateFrameRate(metadata, expectedSettings.fps),
    duration: validateDuration(metadata, expectedSettings.duration),
    fileSize: validateFileSize(
      metadata,
      expectedSettings.resolution,
      expectedSettings.fps,
      expectedSettings.duration
    ),
  };

  const passed =
    results.resolution.valid &&
    results.frameRate.valid &&
    results.duration.valid;

  const summary = `
[Mock Test] GIF Validation Results:
- Resolution: ${results.resolution.valid ? '✅' : '❌'} ${results.resolution.message}
- Frame Rate: ${results.frameRate.valid ? '✅' : '❌'} ${results.frameRate.message}
- Duration: ${results.duration.valid ? '✅' : '❌'} ${results.duration.message}
- File Size: ${results.fileSize.valid ? '✅' : '⚠️'} ${results.fileSize.message}
- Frame Count: ${metadata.frameCount} frames
`.trim();

  return { passed, metadata, results, summary };
}

/**
 * Helper to check aspect ratio preservation
 */
export function validateAspectRatio(
  metadata: GifMetadata,
  sourceWidth: number,
  sourceHeight: number,
  tolerance: number = 0.05 // 5% tolerance
): { valid: boolean; message: string } {
  const sourceAspectRatio = sourceWidth / sourceHeight;
  const gifAspectRatio = metadata.width / metadata.height;

  const ratioDiff = Math.abs(sourceAspectRatio - gifAspectRatio) / sourceAspectRatio;
  const valid = ratioDiff <= tolerance;

  const message = valid
    ? `Aspect ratio preserved: ${gifAspectRatio.toFixed(2)} (source: ${sourceAspectRatio.toFixed(2)})`
    : `Aspect ratio changed! Source: ${sourceAspectRatio.toFixed(2)}, GIF: ${gifAspectRatio.toFixed(2)} (diff: ${(ratioDiff * 100).toFixed(1)}%)`;

  return { valid, message };
}

/**
 * Visual comparison for text overlay validation
 * This checks if text is visible in the GIF by analyzing color variation
 */
export async function validateTextOverlay(
  page: Page,
  gifSelector: string,
  expectedText?: string[]
): Promise<{ hasText: boolean; confidence: number }> {
  // Take screenshot of GIF element
  const screenshot = await page.locator(gifSelector).screenshot();

  // In a real implementation, you'd use OCR here (like Tesseract.js)
  // For now, we'll do a simple check based on image characteristics

  // Check if the image has enough variation (text adds complexity)
  const buffer = Buffer.from(screenshot);
  const uniqueColors = new Set();

  for (let i = 0; i < Math.min(buffer.length, 10000); i += 4) {
    const color = `${buffer[i]},${buffer[i+1]},${buffer[i+2]}`;
    uniqueColors.add(color);
  }

  // More colors = likely has text overlay
  const hasText = uniqueColors.size > 100;
  const confidence = Math.min(uniqueColors.size / 200, 1);

  return { hasText, confidence };
}
