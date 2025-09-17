# Resolution Testing Guide

This guide will help you manually test the resolution functionality of the YouTube GIF Maker extension and verify that different resolution presets produce GIFs with the correct dimensions.

## Setup

1. **Build the extension:**
   ```bash
   npm run build
   ```

2. **Load the extension in Chrome:**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the `dist` folder

3. **Create test output directory:**
   ```bash
   mkdir -p tests/outputs/resolution-test
   ```

## Manual Testing Steps

### Test Video
Use the Rick Roll video: https://www.youtube.com/watch?v=dQw4w9WgXcQ

### For Each Resolution Preset (360p, 480p, 720p, original):

1. **Navigate to the test video** and wait for it to load
2. **Find the GIF button** in the YouTube player controls (should be injected by the extension)
3. **Click the GIF button** to open the GIF creation interface
4. **Set the timeline:**
   - Start time: 10 seconds
   - End time: 15 seconds (5-second GIF)
5. **Select the resolution preset** you're testing
6. **Create the GIF** and download it
7. **Save the file** as `rickroll-{resolution}.gif` in `tests/outputs/resolution-test/`

### Expected Results

| Resolution | Expected Dimensions | Aspect Ratio |
|------------|-------------------|--------------|
| 360p       | 640 × 360        | 16:9         |
| 480p       | 852 × 480        | 16:9         |
| 720p       | 1280 × 720       | 16:9         |
| original   | 1920 × 1080      | 16:9         |

### Verification

You can verify the dimensions of the generated GIFs using:

#### Command Line (macOS/Linux):
```bash
# Install imagemagick if not already installed
brew install imagemagick  # macOS
# or: sudo apt-get install imagemagick  # Linux

# Check dimensions
identify tests/outputs/resolution-test/*.gif
```

#### Online Tools:
- Upload the GIF files to https://www.imagemagick.org/script/identify.php
- Or use any image viewer that shows dimensions

#### Node.js Script:
```javascript
const fs = require('fs');
const path = require('path');

// This would require additional dependencies like 'sharp' or 'jimp'
// to actually analyze GIF files programmatically
```

## Automated Test

To run the automated Playwright test:

```bash
./scripts/run-resolution-test.sh
```

**Note:** The automated test may need adjustment based on the actual UI implementation of your extension.

## Troubleshooting

### Extension Not Loading
- Make sure the extension is built (`npm run build`)
- Check that developer mode is enabled in Chrome
- Verify the extension appears in the extensions list

### GIF Button Not Appearing
- Check browser console for JavaScript errors
- Verify the content script is injecting properly
- Make sure you're on a YouTube video page

### Resolution Not Applied
- Check the ResolutionScaler implementation in `src/processing/resolution-scaler.ts`
- Verify the resolution preset is being passed correctly to the encoding process
- Look for any errors in the background script console

### Large File Sizes
- Higher resolution GIFs will naturally be larger
- Check the file size multipliers in `RESOLUTION_PRESETS`
- Consider the quality settings and frame rate

## Results Analysis

After creating GIFs at all resolutions:

1. **File Size Comparison:**
   - 360p should be smallest
   - Original should be largest
   - File sizes should generally increase with resolution

2. **Quality Assessment:**
   - Higher resolutions should preserve more detail
   - Text and fine details should be more readable at higher resolutions

3. **Performance:**
   - Processing time may increase with higher resolutions
   - Memory usage should be monitored during creation

## Test Data

Record your results:

| Resolution | Actual Dimensions | File Size | Processing Time | Notes |
|------------|------------------|-----------|----------------|--------|
| 360p       |                  |           |                |        |
| 480p       |                  |           |                |        |
| 720p       |                  |           |                |        |
| original   |                  |           |                |        |

## Common Issues and Solutions

### Incorrect Dimensions
- Check `ResolutionScaler.calculateScaledDimensions()` logic
- Verify aspect ratio preservation
- Ensure even dimensions for video encoding compatibility

### File Size Issues
- Review `fileSizeMultiplier` values in presets
- Check GIF encoding quality settings
- Consider frame rate impact on file size

### Performance Problems
- Monitor memory usage during processing
- Consider implementing multi-step scaling for large downscaling operations
- Review the multi-step scaling logic in `ResolutionScaler.multiStepScale()`