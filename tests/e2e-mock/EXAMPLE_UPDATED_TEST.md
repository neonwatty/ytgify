# Example: Before and After Test Update

This document shows a side-by-side comparison of a mock test before and after adding proper GIF validation.

## Test File: gif-output-validation.spec.ts

### ❌ BEFORE (Weak Validation)

```typescript
test('GIF at 480p has correct dimensions', async ({ page, mockServerUrl }) => {
  test.setTimeout(90000);

  const videoUrl = getMockVideoUrl('veryShort', mockServerUrl);
  await page.goto(videoUrl);

  await page.waitForSelector('video', { timeout: 10000 });
  await page.waitForFunction(() => document.querySelector('.ytgif-button') !== null, {
    timeout: 15000,
  });

  await page.click('.ytgif-button');
  await page.waitForTimeout(1000);
  await page.click('.ytgif-resolution-btn:has-text("480p")');
  await page.waitForTimeout(300);

  await page.click('.ytgif-button-primary');
  await page.waitForTimeout(1000);

  try {
    await page.click('button:has-text("Skip")', { timeout: 3000 });
  } catch {
    await page.click('.ytgif-button-primary', { timeout: 3000 });
  }

  // Wait for processing
  const processingInfo = await page.evaluate(() => {
    const processing = document.querySelector('.ytgif-processing-screen');
    return {
      onProcessingScreen: !!processing,
      processingVisible: processing ? (processing as HTMLElement).offsetParent !== null : false,
    };
  });

  if (processingInfo.onProcessingScreen) {
    await page.waitForFunction(
      () => {
        const success = document.querySelector('.ytgif-success-screen');
        const error = document.querySelector('.ytgif-error-message');
        return success || error;
      },
      { timeout: 45000, polling: 500 }
    );

    // OLD VALIDATION - ONLY CHECKS IF URL EXISTS!
    const successInfo = await page.evaluate(() => {
      const success = document.querySelector('.ytgif-success-screen');
      const gifPreview = document.querySelector(
        '.ytgif-gif-preview img, .ytgif-success-preview-image'
      );
      return {
        onSuccessScreen: !!success,
        hasGifPreview: !!gifPreview,
        gifSrc: gifPreview ? (gifPreview as HTMLImageElement).src : null,
      };
    });

    if (successInfo.hasGifPreview && successInfo.gifSrc) {
      expect(successInfo.gifSrc).toBeTruthy();

      // PROBLEM: Only checks URL format, NOT actual content
      const isValidDataUrl = successInfo.gifSrc.startsWith('data:image/gif');
      const isValidBlobUrl = successInfo.gifSrc.startsWith('blob:');
      expect(isValidDataUrl || isValidBlobUrl).toBe(true);

      // No check if GIF is actually 480p (854x480)!
      // No check if it has the right frame rate!
      // No check if duration is correct!
      // Test passes even if GIF is completely wrong!

      console.log('✅ [Mock Test] Successfully created 480p GIF with correct dimensions');
    }
  }
});
```

**Problems with OLD approach:**

- ❌ Doesn't validate actual dimensions (could be 144p and still pass!)
- ❌ Doesn't check frame rate
- ❌ Doesn't check duration
- ❌ Doesn't check frame count
- ❌ Only checks if a GIF URL exists, not if it's correct
- ❌ Provides false confidence - test passes even if app is broken

---

### ✅ AFTER (Proper Validation)

```typescript
import {
  validateGifComplete,
  extractGifMetadata,
  RESOLUTION_SPECS,
} from './helpers/gif-validator-mock';

test('GIF at 480p has correct dimensions', async ({ page, mockServerUrl }) => {
  test.setTimeout(90000);

  const videoUrl = getMockVideoUrl('veryShort', mockServerUrl);
  await page.goto(videoUrl);

  await page.waitForSelector('video', { timeout: 10000 });
  await page.waitForFunction(() => document.querySelector('.ytgif-button') !== null, {
    timeout: 15000,
  });

  await page.click('.ytgif-button');
  await page.waitForTimeout(1000);

  // Select 480p resolution
  await page.click('.ytgif-resolution-btn:has-text("480p")');
  await page.waitForTimeout(300);

  // Verify selection
  const selectedRes = await page.evaluate(() => {
    const btn = document.querySelector('.ytgif-resolution-btn--active');
    return btn?.textContent?.trim() || '';
  });
  expect(selectedRes).toContain('480p');

  await page.click('.ytgif-button-primary');
  await page.waitForTimeout(1000);

  try {
    await page.click('button:has-text("Skip")', { timeout: 3000 });
  } catch {
    await page.click('.ytgif-button-primary', { timeout: 3000 });
  }

  // Wait for processing
  const processingInfo = await page.evaluate(() => {
    const processing = document.querySelector('.ytgif-processing-screen');
    return {
      onProcessingScreen: !!processing,
      processingVisible: processing ? (processing as HTMLElement).offsetParent !== null : false,
    };
  });

  if (processingInfo.onProcessingScreen) {
    await page.waitForFunction(
      () => {
        const success = document.querySelector('.ytgif-success-screen');
        const error = document.querySelector('.ytgif-error-message');
        return success || error;
      },
      { timeout: 45000, polling: 500 }
    );

    // Get GIF URL
    const gifUrl = await page.evaluate(() => {
      const gifPreview = document.querySelector(
        '.ytgif-gif-preview img, .ytgif-success-preview-image'
      );
      return gifPreview ? (gifPreview as HTMLImageElement).src : null;
    });

    expect(gifUrl).toBeTruthy();

    // NEW VALIDATION - COMPREHENSIVE CHECK!
    const validation = await validateGifComplete(page, gifUrl!, {
      resolution: '480p',
      fps: 5, // default FPS
      duration: 5, // estimated default duration for veryShort video
    });

    // Log detailed results
    console.log(validation.summary);

    // ACTUAL VALIDATION
    expect(validation.passed).toBe(true);
    expect(validation.results.resolution.valid).toBe(true);
    expect(validation.results.frameRate.valid).toBe(true);
    expect(validation.results.duration.valid).toBe(true);

    // Specific dimension assertions
    const expectedSpec = RESOLUTION_SPECS['480p'];
    expect(validation.metadata.width).toBeCloseTo(expectedSpec.width, expectedSpec.tolerance);
    expect(validation.metadata.height).toBeCloseTo(expectedSpec.height, expectedSpec.tolerance);

    // Frame count should match fps * duration
    const expectedFrameCount = 5 * 5; // 5fps * 5s
    expect(validation.metadata.frameCount).toBeCloseTo(expectedFrameCount, 5); // ±5 frames tolerance

    // Log success with actual values
    console.log(`✅ [Mock Test] Successfully created 480p GIF:`);
    console.log(`   - Dimensions: ${validation.metadata.width}x${validation.metadata.height}`);
    console.log(`   - Frame Rate: ${validation.metadata.fps} fps`);
    console.log(`   - Duration: ${validation.metadata.duration.toFixed(1)}s`);
    console.log(`   - Frames: ${validation.metadata.frameCount}`);
    console.log(`   - File Size: ${validation.results.fileSize.sizeInMB.toFixed(2)} MB`);
  }
});
```

**Benefits of NEW approach:**

- ✅ Validates actual dimensions (854x480 ±10px for 480p)
- ✅ Validates frame rate (5 fps ±2)
- ✅ Validates duration (5s ±0.5s)
- ✅ Validates frame count (should be fps × duration)
- ✅ Validates file size is reasonable for settings
- ✅ Provides detailed logging for debugging
- ✅ Test fails if GIF has wrong dimensions/fps/duration
- ✅ Catches actual bugs in GIF encoding

---

## Another Example: Frame Rate Test

### ❌ BEFORE

```typescript
test('GIF at 15 fps has correct frame rate', async ({ page, mockServerUrl }) => {
  // ... create GIF with 15 fps ...

  if (successInfo.hasGifPreview && successInfo.gifSrc) {
    expect(successInfo.gifSrc).toBeTruthy();
    const isValidDataUrl = successInfo.gifSrc.startsWith('data:image/gif');
    expect(isValidDataUrl).toBe(true);

    // PROBLEM: Doesn't actually check if it's 15 fps!
    console.log('✅ Successfully created GIF with 15 fps frame rate');
  }
});
```

### ✅ AFTER

```typescript
import { validateGifComplete, extractGifMetadata } from './helpers/gif-validator-mock';

test('GIF at 15 fps has correct frame rate', async ({ page, mockServerUrl }) => {
  // ... create GIF with 15 fps ...

  const gifUrl = await page.evaluate(() => {
    const gifPreview = document.querySelector('.ytgif-gif-preview img');
    return (gifPreview as HTMLImageElement)?.src;
  });

  expect(gifUrl).toBeTruthy();

  // Extract and validate metadata
  const metadata = await extractGifMetadata(page, gifUrl!);

  // ACTUAL FPS VALIDATION
  expect(metadata.fps).toBeCloseTo(15, 2); // 15 fps ±2

  // Also validate frame count
  const expectedFrames = Math.round(15 * metadata.duration);
  expect(metadata.frameCount).toBeCloseTo(expectedFrames, 5);

  console.log(
    `✅ Successfully created GIF with ${metadata.fps} fps (${metadata.frameCount} frames in ${metadata.duration.toFixed(1)}s)`
  );
});
```

---

## File Size Correlation Example

### ❌ BEFORE

```typescript
test('File size correlates with settings', async ({ page, mockServerUrl }) => {
  // Create two GIFs but don't actually compare their sizes...

  const gifSizes: { label: string; dataUrlLength: number }[] = [];

  for (const config of configs) {
    // ... create GIF ...

    gifSizes.push({
      label: config.label,
      dataUrlLength: successInfo.gifSrc.length, // WRONG - string length, not file size!
    });
  }

  // Weak validation
  if (gifSizes.length === 2) {
    console.log('✅ File size correlation validated!'); // No actual validation!
  }
});
```

### ✅ AFTER

```typescript
import { extractGifMetadata } from './helpers/gif-validator-mock';

test('File size correlates with settings', async ({ page, mockServerUrl }) => {
  const gifSizes: { label: string; fileSize: number; metadata: GifMetadata }[] = [];

  for (const config of configs) {
    // ... create GIF ...

    const gifUrl = await page.evaluate(
      () => (document.querySelector('.ytgif-gif-preview img') as HTMLImageElement)?.src
    );

    // Extract actual metadata
    const metadata = await extractGifMetadata(page, gifUrl!);

    gifSizes.push({
      label: config.label,
      fileSize: metadata.fileSize, // CORRECT - actual file size in bytes
      metadata,
    });

    console.log(
      `${config.label}: ${(metadata.fileSize / 1024 / 1024).toFixed(2)} MB (${metadata.width}x${metadata.height}, ${metadata.fps}fps)`
    );
  }

  // ACTUAL SIZE COMPARISON
  const smallestGif = gifSizes.find((g) => g.label === 'smallest')!;
  const largestGif = gifSizes.find((g) => g.label === 'largest')!;

  expect(largestGif.fileSize).toBeGreaterThan(smallestGif.fileSize);

  // More rigorous check - higher settings should be significantly larger
  const sizeRatio = largestGif.fileSize / smallestGif.fileSize;
  expect(sizeRatio).toBeGreaterThan(2); // At least 2x larger

  console.log(`✅ File size correlation validated:`);
  console.log(
    `   - Smallest (${smallestGif.metadata.width}x${smallestGif.metadata.height} @ ${smallestGif.metadata.fps}fps): ${(smallestGif.fileSize / 1024).toFixed(1)} KB`
  );
  console.log(
    `   - Largest (${largestGif.metadata.width}x${largestGif.metadata.height} @ ${largestGif.metadata.fps}fps): ${(largestGif.fileSize / 1024).toFixed(1)} KB`
  );
  console.log(`   - Size ratio: ${sizeRatio.toFixed(2)}x`);
});
```

---

## Summary of Improvements

| Aspect                    | Before                | After                                      |
| ------------------------- | --------------------- | ------------------------------------------ |
| **Resolution Validation** | ❌ None               | ✅ Validates exact dimensions              |
| **FPS Validation**        | ❌ None               | ✅ Validates actual frame rate             |
| **Duration Validation**   | ❌ None               | ✅ Validates actual duration               |
| **Frame Count**           | ❌ Not checked        | ✅ Validates count matches fps × duration  |
| **File Size**             | ⚠️ String length only | ✅ Actual byte size with correlation tests |
| **Error Messages**        | ❌ Generic            | ✅ Specific, actionable                    |
| **Debugging Info**        | ❌ Minimal            | ✅ Detailed metadata logging               |
| **False Positives**       | ❌ High risk          | ✅ Low risk - catches real bugs            |

## Next Steps

1. Review this example
2. Apply similar updates to all tests in:
   - `gif-output-validation.spec.ts` (highest priority)
   - `wizard-settings-matrix.spec.ts`
   - `wizard-basic.spec.ts`
3. Run tests to verify improvements
4. Compare test output before/after to see better error messages
