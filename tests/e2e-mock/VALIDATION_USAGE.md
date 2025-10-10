# Mock E2E GIF Validation Usage Guide

This guide explains how to use the new GIF validation helpers in mock E2E tests.

## Overview

The mock E2E tests now have full GIF validation capabilities similar to the real E2E tests, but adapted to work with data URLs and blob URLs instead of file paths.

## Available Validation Functions

### 1. `extractGifMetadata(page, gifUrl)`

Extracts comprehensive metadata from a GIF data URL or blob URL.

**Parameters:**

- `page`: Playwright Page object
- `gifUrl`: Data URL (starting with `data:image/gif;base64,`) or blob URL (starting with `blob:`)

**Returns:**

```typescript
{
  width: number; // GIF width in pixels
  height: number; // GIF height in pixels
  frameCount: number; // Total number of frames
  duration: number; // Duration in seconds
  fps: number; // Calculated frames per second
  fileSize: number; // Size in bytes
  hasTransparency: boolean; // Whether GIF supports transparency
}
```

**Example:**

```typescript
const gifUrl = await page.evaluate(() => {
  const img = document.querySelector('.ytgif-gif-preview img');
  return (img as HTMLImageElement).src;
});

const metadata = await extractGifMetadata(page, gifUrl);
console.log(`GIF is ${metadata.width}x${metadata.height}, ${metadata.frameCount} frames`);
```

### 2. `validateGifComplete(page, gifUrl, expectedSettings)`

Performs complete validation of a GIF against expected settings.

**Parameters:**

- `page`: Playwright Page object
- `gifUrl`: Data URL or blob URL of the GIF
- `expectedSettings`: Object with:
  - `resolution`: '144p' | '240p' | '360p' | '480p'
  - `fps`: number (e.g., 5, 10, 15)
  - `duration`: number (in seconds)
  - `hasText?`: boolean (optional)

**Returns:**

```typescript
{
  passed: boolean; // Overall pass/fail
  metadata: GifMetadata; // Full metadata
  results: {
    resolution: {
      valid: boolean;
      message: string;
    }
    frameRate: {
      valid: boolean;
      message: string;
    }
    duration: {
      valid: boolean;
      message: string;
    }
    fileSize: {
      valid: boolean;
      message: string;
      sizeInMB: number;
    }
  }
  summary: string; // Human-readable summary
}
```

**Example:**

```typescript
const validation = await validateGifComplete(page, gifUrl, {
  resolution: '480p',
  fps: 15,
  duration: 3,
});

console.log(validation.summary);
expect(validation.passed).toBe(true);
expect(validation.results.resolution.valid).toBe(true);
```

### 3. Individual Validation Functions

You can also use individual validators for more fine-grained control:

#### `validateResolution(metadata, expectedResolution)`

```typescript
const result = validateResolution(metadata, '480p');
expect(result.valid).toBe(true);
expect(result.message).toContain('Resolution matches');
```

#### `validateFrameRate(metadata, expectedFps, tolerance?)`

```typescript
const result = validateFrameRate(metadata, 15, 2); // 2 fps tolerance
expect(result.valid).toBe(true);
```

#### `validateDuration(metadata, expectedDuration, tolerance?)`

```typescript
const result = validateDuration(metadata, 3, 0.5); // 0.5s tolerance
expect(result.valid).toBe(true);
```

#### `validateFileSize(metadata, resolution, fps, duration)`

```typescript
const result = validateFileSize(metadata, '480p', 15, 3);
console.log(`File size: ${result.sizeInMB.toFixed(2)} MB`);
expect(result.valid).toBe(true);
```

#### `validateAspectRatio(metadata, sourceWidth, sourceHeight, tolerance?)`

```typescript
const result = validateAspectRatio(metadata, 1920, 1080, 0.05); // 5% tolerance
expect(result.valid).toBe(true);
```

## Complete Example: Updated Test

Here's a complete example showing how to update an existing mock test:

### Before (Old Way):

```typescript
test('GIF at 480p has correct dimensions', async ({ page, mockServerUrl }) => {
  // ... create GIF ...

  const successInfo = await page.evaluate(() => {
    const gifPreview = document.querySelector('.ytgif-gif-preview img');
    return {
      hasGifPreview: !!gifPreview,
      gifSrc: gifPreview ? (gifPreview as HTMLImageElement).src : null,
    };
  });

  // Only checks if URL exists - NO ACTUAL VALIDATION!
  expect(successInfo.gifSrc).toBeTruthy();
  const isValidDataUrl = successInfo.gifSrc.startsWith('data:image/gif');
  expect(isValidDataUrl).toBe(true);
});
```

### After (New Way):

```typescript
import { validateGifComplete, extractGifMetadata } from './helpers/gif-validator-mock';

test('GIF at 480p has correct dimensions', async ({ page, mockServerUrl }) => {
  // ... create GIF ...

  const gifUrl = await page.evaluate(() => {
    const gifPreview = document.querySelector('.ytgif-gif-preview img');
    return gifPreview ? (gifPreview as HTMLImageElement).src : null;
  });

  expect(gifUrl).toBeTruthy();

  // ACTUAL VALIDATION - checks dimensions, frame rate, etc.
  const validation = await validateGifComplete(page, gifUrl!, {
    resolution: '480p',
    fps: 5, // default FPS
    duration: 5, // estimated default duration
  });

  console.log(validation.summary);

  // Specific assertions
  expect(validation.passed).toBe(true);
  expect(validation.results.resolution.valid).toBe(true);
  expect(validation.metadata.width).toBeCloseTo(854, 10); // 480p width
  expect(validation.metadata.height).toBeCloseTo(480, 10); // 480p height
});
```

## Expected Resolution Specs

The validator uses these expected dimensions (with 10px tolerance):

| Resolution | Width | Height |
| ---------- | ----- | ------ |
| 144p       | 256   | 144    |
| 240p       | 426   | 240    |
| 360p       | 640   | 360    |
| 480p       | 854   | 480    |

## Tolerance Values

Default tolerances used:

- **Resolution**: ±10 pixels
- **Frame Rate**: ±2 fps (slightly higher than real tests due to GIF encoding variations)
- **Duration**: ±0.5 seconds
- **Aspect Ratio**: ±5%

## Debugging Tips

### View Full Metadata

```typescript
const metadata = await extractGifMetadata(page, gifUrl);
console.log('Full metadata:', metadata);
```

### Get Detailed Validation Results

```typescript
const validation = await validateGifComplete(page, gifUrl, settings);
console.log('Resolution:', validation.results.resolution.message);
console.log('Frame Rate:', validation.results.frameRate.message);
console.log('Duration:', validation.results.duration.message);
console.log('File Size:', validation.results.fileSize.message);
```

### Check Individual Aspects

```typescript
const metadata = await extractGifMetadata(page, gifUrl);

// Just check resolution
const resCheck = validateResolution(metadata, '480p');
if (!resCheck.valid) {
  console.error('Resolution issue:', resCheck.message);
}

// Just check FPS
const fpsCheck = validateFrameRate(metadata, 15);
if (!fpsCheck.valid) {
  console.error('FPS issue:', fpsCheck.message);
}
```

## Common Patterns

### Pattern 1: Quick Validation

```typescript
const gifUrl = await page.evaluate(
  () => (document.querySelector('.ytgif-gif-preview img') as HTMLImageElement)?.src
);

const validation = await validateGifComplete(page, gifUrl!, {
  resolution: '240p',
  fps: 10,
  duration: 3,
});

expect(validation.passed).toBe(true);
```

### Pattern 2: Detailed Assertions

```typescript
const metadata = await extractGifMetadata(page, gifUrl);

expect(metadata.width).toBeCloseTo(640, 10);
expect(metadata.height).toBeCloseTo(360, 10);
expect(metadata.fps).toBeCloseTo(10, 2);
expect(metadata.frameCount).toBeCloseTo(30, 5); // 10fps * 3s
```

### Pattern 3: File Size Correlation Test

```typescript
const smallGifUrl = /* ... 144p @ 5fps ... */;
const largeGifUrl = /* ... 480p @ 15fps ... */;

const smallMeta = await extractGifMetadata(page, smallGifUrl);
const largeMeta = await extractGifMetadata(page, largeGifUrl);

expect(largeMeta.fileSize).toBeGreaterThan(smallMeta.fileSize * 2);
console.log(`Size ratio: ${(largeMeta.fileSize / smallMeta.fileSize).toFixed(2)}x`);
```

## Migration Checklist

When updating an existing mock test:

- [ ] Import validation helpers at top of file
- [ ] Replace basic URL existence checks with `validateGifComplete()`
- [ ] Add specific assertions for dimensions, FPS, duration
- [ ] Log validation summary for debugging
- [ ] Update test timeout if needed (validation adds ~1-2 seconds)
- [ ] Add metadata logging for test visibility

## Next Steps

After familiarizing yourself with these validators:

1. Update tests in `gif-output-validation.spec.ts` first (highest priority)
2. Then update `wizard-settings-matrix.spec.ts`
3. Finally update `wizard-basic.spec.ts`
4. `error-handling.spec.ts` needs minimal changes (workflow validation is sufficient there)
