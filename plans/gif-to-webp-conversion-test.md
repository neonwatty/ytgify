# Isolated GIF to WebP Animation Test Plan

## Objective
Create a standalone HTML test page that can convert an animated GIF to an animated WebP using only browser-based JavaScript, without any integration with the main extension.

## Approach: Three Potential Methods

### Method 1: WebPXMux.js Library (Recommended)
**What it does**: Uses WebAssembly to provide full WebP encoding/decoding capabilities

**Steps**:
1. Create simple HTML page with file input for GIF upload
2. Install webpxmux.js via CDN or local copy
3. Load and parse the uploaded GIF using existing GIF parsing library (like `gifler` or `gif.js`)
4. Extract individual frames from GIF as ImageData
5. Use WebPXMux to encode frames into animated WebP
6. Provide download link for the resulting WebP file

**Pros**: Most comprehensive, handles all WebP features
**Cons**: Requires additional WebAssembly runtime (~500KB)

### Method 2: Canvas + Native WebP Support
**What it does**: Uses Canvas API's built-in WebP encoding for individual frames

**Steps**:
1. Parse GIF frames using GIF parsing library
2. Draw each frame to Canvas
3. Use `canvas.toBlob('image/webp')` to encode each frame
4. Manually construct animated WebP format (complex)

**Pros**: Uses native browser APIs, smaller footprint
**Cons**: No native animated WebP construction - would need custom muxing

### Method 3: Server-Side Proxy (Fallback)
**What it does**: Uses a simple server endpoint to handle conversion

**Steps**:
1. Upload GIF to local test server
2. Server uses ImageMagick or similar to convert
3. Download resulting WebP

**Pros**: Proven, reliable conversion
**Cons**: Not truly client-side, requires server setup

## Recommended Implementation Plan

**Phase 1: Setup Test Environment**
- Create `test-gif-to-webp.html` standalone file
- Include webpxmux.js from CDN or local copy
- Add gifler.js for GIF parsing
- Basic UI: file input, convert button, download link

**Phase 2: Core Conversion Logic**
```javascript
1. Load GIF file → Parse frames with gifler
2. Extract frame data (ImageData array)
3. Initialize WebPXMux runtime
4. Encode frames to animated WebP
5. Create blob URL for download
```

**Phase 3: Testing & Validation**
- Test with various GIF sizes and frame counts
- Compare file sizes (should be 25-35% smaller)
- Verify animation timing preservation
- Test browser compatibility (Chrome, Firefox, Safari)

## Expected Deliverable
Single HTML file demonstrating GIF→WebP conversion that:
- Works in modern browsers without server
- Shows file size reduction
- Preserves animation timing
- Provides downloadable WebP result

## File Size Expectations
- Input: 2MB animated GIF
- Output: ~1.3-1.5MB animated WebP (25-35% reduction)
- Better compression with longer/more complex animations

## Research Findings

### WebP Benefits
- Animated GIFs converted to lossy WebPs are 64% smaller
- Lossless WebPs are 19% smaller than GIFs
- Better support for alpha transparency
- Modern browser support is excellent (Chrome, Firefox, Safari, Edge)

### Performance Considerations
- WebP is more CPU-intensive for straight-line decoding (2.2x for lossy, 1.5x for lossless)
- However, WebP is faster when seeking is involved (0.57x total decode time vs GIF)

### Key Libraries Found
1. **webpxmux.js**: Full-featured WebP manipulation library with WASM
   - Muxing/demuxing animated WebP
   - Encoding/decoding WebP images
   - Works in browser and Node.js
   
2. **ImageMagick WASM**: Can convert between GIF and WebP formats
   - Compiled to WebAssembly
   - Slower but reliable conversion
   
3. **gif.js/gifler.js**: For parsing and extracting GIF frames
   - Well-established libraries
   - Good browser compatibility

## Implementation Notes

### WebPXMux.js Setup
```javascript
const WebPXMux = require("webpxmux");
const xMux = WebPXMux();

// Initialize WebAssembly runtime
await xMux.waitRuntime();

// Decode frames from buffer
const frames = await xMux.decodeFrames(buffer);

// Encode frames to WebP
const webpBuffer = await xMux.encodeFrames(frameData);
```

### Browser Compatibility Requirements
- WebAssembly support (all modern browsers)
- Canvas API
- Blob and URL.createObjectURL support
- File API for uploads

## Next Steps
1. Create the test HTML file
2. Test with sample GIFs of various sizes
3. Measure performance and file size reduction
4. Consider integration options for main extension