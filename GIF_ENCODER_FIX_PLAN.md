# GIF Encoder Fix Implementation Plan

## Overview
Switch from problematic gif.js (with workers:0) to gifenc library, which is designed for synchronous operation and is 2x faster. Implement the encoder abstraction system to allow easy switching between encoders.

## Phase 1: Implement Encoder Abstraction System (30 min)

### 1.1 Create Base Encoder Interface
- [ ] Create `src/lib/encoders/base-encoder.ts`
  - Define `IEncoder` interface with standard methods
  - Define common types (FrameData, EncoderOptions, EncoderResult)

### 1.2 Implement Gifenc Encoder Adapter
- [ ] Install gifenc if not already: `npm install gifenc`
- [ ] Create `src/lib/encoders/gifenc-encoder.ts`
  - Implement IEncoder interface
  - Handle frame processing
  - Return Blob result

### 1.3 Create Legacy gif.js Adapter (for fallback)
- [ ] Create `src/lib/encoders/gifjs-encoder.ts`
  - Wrap existing gif.js implementation
  - Implement IEncoder interface

### 1.4 Create Encoder Factory
- [ ] Create `src/lib/encoders/encoder-factory.ts`
  - Auto-select best encoder based on environment
  - Default to gifenc for content scripts
  - Allow configuration override

## Phase 2: Integrate Gifenc into Content Script (45 min)

### 2.1 Update GIF Processor
- [ ] Modify `src/content/gif-processor.ts`
  - Import encoder factory
  - Replace direct gif.js usage with encoder abstraction
  - Remove gif.js specific workarounds

### 2.2 Implement Gifenc Processing
- [ ] Create gifenc-specific frame processing
  - Convert canvas elements to appropriate format
  - Handle quantization and palette generation
  - Implement progress callbacks

### 2.3 Handle Edge Cases
- [ ] Add proper error handling for gifenc
- [ ] Implement frame size optimization
- [ ] Add memory management for large GIFs

## Phase 3: Test and Verify (30 min)

### 3.1 Create Test Suite
- [ ] Create `tests/test-gifenc-encoding.spec.js`
  - Test frame capture
  - Test encoding completion
  - Test GIF save to IndexedDB
  - Verify GIF extraction and quality

### 3.2 Performance Testing
- [ ] Compare encoding times (gifenc vs gif.js)
- [ ] Measure memory usage
- [ ] Test with various frame counts

### 3.3 Integration Testing
- [ ] Test full flow from button click to GIF save
- [ ] Verify IndexedDB storage
- [ ] Test GIF download functionality

## Phase 4: Optional - Background Script Processing (Future)

### 4.1 Message Protocol
- [ ] Define messages for frame transfer to background
- [ ] Implement chunked transfer for large frame data

### 4.2 Background Worker
- [ ] Move encoding logic to background script
- [ ] Use transferable objects for performance
- [ ] Implement progress reporting back to content

## Implementation Details

### Gifenc Integration Example
```typescript
import { GIFEncoder, quantize, applyPalette } from 'gifenc';

class GifencEncoder implements IEncoder {
  async encode(frames: FrameData[], options: EncoderOptions): Promise<Blob> {
    const encoder = GIFEncoder();
    
    for (const frame of frames) {
      // Quantize to 256 colors
      const palette = quantize(frame.data, 256);
      const indexed = applyPalette(frame.data, palette);
      
      encoder.writeFrame(indexed, frame.width, frame.height, {
        palette,
        delay: options.frameDelay
      });
    }
    
    encoder.finish();
    const buffer = encoder.bytes();
    return new Blob([buffer], { type: 'image/gif' });
  }
}
```

### Expected Improvements
- **Performance**: 2x faster encoding with gifenc
- **Reliability**: No worker issues in content scripts
- **File Size**: Better compression with modern algorithms
- **Maintainability**: Clean encoder abstraction for future improvements

## Success Criteria
- [ ] GIF encoding completes within 10 seconds for 10 frames
- [ ] GIF is successfully saved to IndexedDB
- [ ] GIF can be extracted and downloaded
- [ ] GIF quality is maintained or improved
- [ ] No blocking of UI during encoding

## Timeline
- Phase 1: 30 minutes
- Phase 2: 45 minutes  
- Phase 3: 30 minutes
- Total: ~1.5-2 hours

## Rollback Plan
If gifenc doesn't work as expected:
1. Keep gif.js adapter as fallback
2. Move processing to background script with workers
3. Use encoder factory to switch between implementations