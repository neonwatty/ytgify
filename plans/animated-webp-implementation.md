# Animated WebP Implementation Plan

## Current Status
✅ Single-frame WebP conversion working
❌ Animated WebP not yet implemented
❌ GIF frame extraction not integrated

## Problem Statement
The test revealed that our current implementation only converts the first frame of an animated GIF to WebP, not the full animation. This results in:
- Loss of animation data
- Misleading file size comparisons (99.7% reduction is because we're dropping frames)
- Not achieving the goal of animated GIF → animated WebP conversion

## Required Components

### 1. GIF Frame Extraction
**Current Issue**: Only extracting first frame

**Solution**: Integrate proper GIF parsing library
- Use existing `gif.js` library (already installed)
- Or use `gifuct-js` for better frame extraction
- Extract all frames with timing information

```javascript
// Example with gifuct-js
import { parseGIF, decompressFrames } from 'gifuct-js';

async function extractGifFrames(gifBuffer) {
  const gif = parseGIF(gifBuffer);
  const frames = decompressFrames(gif, true);
  
  return frames.map(frame => ({
    imageData: new ImageData(frame.patch, frame.dims.width, frame.dims.height),
    delay: frame.delay * 10, // Convert to ms
    disposal: frame.disposalType
  }));
}
```

### 2. Animated WebP Assembly

#### Option A: WebPXMux.js (Recommended)
- Supports full animated WebP creation
- Requires proper WASM module loading
- Implementation needed:

```javascript
import WebPXMux from 'webpxmux';

async function createAnimatedWebP(frames) {
  const xMux = WebPXMux('./webpxmux.wasm');
  await xMux.waitRuntime();
  
  // Encode each frame
  const webpFrames = [];
  for (const frame of frames) {
    const encoded = await xMux.encodeWebP(frame.imageData);
    webpFrames.push({
      data: encoded,
      delay: frame.delay
    });
  }
  
  // Create animated WebP
  return await xMux.encodeFrames(webpFrames);
}
```

#### Option B: libwebp-wasm
- Google's official WebP library
- More complex but fully featured
- Supports all WebP features

#### Option C: Custom WebP Muxer
- Build WebP container manually
- Most control but complex implementation
- Based on WebP container specification

### 3. Frame Processing Pipeline

```
GIF Input → Parse GIF → Extract Frames → Process Each Frame → Encode to WebP → Mux into Animated WebP → Output
```

## Implementation Steps

### Phase 1: GIF Frame Extraction (Priority)
1. Install `gifuct-js` for reliable frame extraction
2. Create frame extraction utility
3. Test with multi-frame GIFs
4. Preserve frame timing and disposal methods

### Phase 2: WebP Frame Encoding
1. Fix WebPXMux.js module loading issue
2. Encode each frame as WebP
3. Preserve frame metadata

### Phase 3: Animated WebP Assembly
1. Implement frame muxing
2. Set animation parameters (loop count, delays)
3. Generate final animated WebP

### Phase 4: Testing & Optimization
1. Compare file sizes (animated GIF vs animated WebP)
2. Verify animation playback
3. Test browser compatibility
4. Optimize encoding settings

## Expected Results

### File Size Comparison (Realistic)
| Format | Expected Size | Notes |
|--------|--------------|-------|
| Animated GIF | 3.4 MB | Original |
| Animated WebP (lossy) | ~2.2 MB | 35% reduction |
| Animated WebP (lossless) | ~2.8 MB | 18% reduction |

### Performance Targets
- Frame extraction: < 500ms for 100 frames
- WebP encoding: < 50ms per frame
- Total conversion: < 5 seconds for typical GIF

## Test Cases Needed

1. **Multi-frame GIF Test**
   - Input: Animated GIF with 50+ frames
   - Output: Animated WebP with same frame count
   - Verify: All frames preserved

2. **Frame Timing Test**
   - Input: GIF with variable frame delays
   - Output: WebP with matching timing
   - Verify: Animation speed preserved

3. **Transparency Test**
   - Input: GIF with transparent areas
   - Output: WebP with alpha channel
   - Verify: Transparency preserved

## Next Steps

1. **Immediate**: Fix GIF frame extraction in test page
2. **Short-term**: Implement WebPXMux.js properly
3. **Long-term**: Add to main extension for production use

## Resources

- [WebP Container Specification](https://developers.google.com/speed/webp/docs/riff_container)
- [gifuct-js Documentation](https://github.com/matt-way/gifuct-js)
- [WebPXMux.js GitHub](https://github.com/SumiMakito/webpxmux.js)
- [libwebp Documentation](https://developers.google.com/speed/webp/docs/api)