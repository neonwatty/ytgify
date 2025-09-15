# MP4 Export Feature Implementation Plan

## Overview
Add MP4 video export capability to the YouTube GIF Maker Chrome Extension using WebCodecs API and Mediabunny library. This will provide users with a modern video format option that offers 80-90% smaller file sizes compared to GIF while maintaining better quality.

## Technical Stack
- **WebCodecs API**: Hardware-accelerated H.264 encoding (Chrome 94+)
- **Mediabunny**: Modern TypeScript library for MP4 container muxing
- **Existing Pipeline**: Reuse current frame extraction and processing

## Implementation Phases

### Phase 1: Architecture Preparation (2-3 days)

#### 1.1 Create Encoder Abstraction
- Extract common interface from existing `GifEncoder` class
- Create `BaseEncoder` abstract class with shared functionality:
  - Frame processing pipeline
  - Progress tracking
  - Memory management
  - Error handling
- Define `EncoderInterface` with methods:
  - `encode(frames, settings)`
  - `cancel()`
  - `getStatus()`

#### 1.2 Update Type Definitions
```typescript
// src/types/index.ts
export type ExportFormat = 'gif' | 'mp4';

export interface ExportSettings {
  format: ExportFormat;
  // Common settings
  resolution: string;
  frameRate: number;
  startTime: number;
  endTime: number;
  // Format-specific settings
  gifSettings?: GifSettings;
  mp4Settings?: Mp4Settings;
}

export interface Mp4Settings {
  quality: number; // 1-10, maps to bitrate
  codec: 'h264'; // Future: 'h265', 'av1'
  bitrate?: number; // Override quality with specific bitrate
}
```

#### 1.3 Update UI Components
- Add format selector to editor panel
- Conditionally render format-specific settings
- Update export button to handle multiple formats
- Add format indicator to saved items in library

### Phase 2: MP4 Implementation (1 week)

#### 2.1 Install Dependencies
```bash
npm install mediabunny
```
- Estimated bundle size increase: ~150KB
- Tree-shakable design ensures minimal impact

#### 2.2 Create MP4Encoder Class
```typescript
// src/processing/mp4-encoder.ts
export class Mp4Encoder extends BaseEncoder {
  private videoEncoder: VideoEncoder;
  private muxer: Mp4Muxer;

  async encode(
    frames: ExtractedFrame[],
    settings: Mp4Settings
  ): Promise<Mp4EncodingResult> {
    // Initialize WebCodecs VideoEncoder
    // Configure H.264 encoding
    // Process frames through encoder
    // Mux encoded chunks with Mediabunny
    // Return MP4 blob
  }
}
```

#### 2.3 WebCodecs Pipeline Implementation
1. **Initialize VideoEncoder**
   - Configure for H.264 baseline/main profile
   - Set bitrate based on quality setting (1-10 Mbps range)
   - Enable hardware acceleration

2. **Frame Processing Flow**
   ```
   Canvas → VideoFrame → VideoEncoder → EncodedVideoChunk → Mediabunny → MP4 Blob
   ```

3. **Timing and Synchronization**
   - Maintain frame timestamps
   - Handle variable frame rates
   - Ensure audio sync (future feature)

#### 2.4 MP4-Specific Settings
- **Quality Levels**:
  - Low (1-3): 1-2 Mbps, good for sharing
  - Medium (4-6): 3-5 Mbps, balanced
  - High (7-9): 6-8 Mbps, high quality
  - Maximum (10): 10 Mbps, best quality

- **Resolution Options**:
  - Keep existing: 480p, 720p, 1080p, Original

- **Frame Rate**:
  - Match source video frame rate
  - Option to reduce for smaller files

### Phase 3: Integration (2-3 days)

#### 3.1 Background Worker Updates
- Add MP4 encoding message handlers
- Update message types for format selection
- Implement MP4 encoding pipeline parallel to GIF

#### 3.2 Storage and Library Updates
- Modify storage to handle MP4 blobs
- Update metadata to include format type
- Add MP4 preview capability in library
- Implement video player for MP4 previews

#### 3.3 Export and Download
- Update download functionality with correct MIME type
- Set appropriate file extensions (.mp4)
- Add format-specific metadata

### Phase 4: Testing and Optimization (2-3 days)

#### 4.1 Performance Testing
- Verify hardware acceleration is active
- Benchmark encoding speeds vs GIF
- Memory usage profiling
- Large video handling (5+ minute clips)

#### 4.2 Quality Validation
- Compare output quality at different settings
- Verify playback compatibility
- Test file size reductions (target: 80-90% smaller than GIF)

#### 4.3 Error Handling
- WebCodecs API not available fallback
- Hardware acceleration failure handling
- Out of memory scenarios
- Encoding timeout management

## Expected Outcomes

### Performance Metrics
- **File Size**: 80-90% reduction compared to GIF
- **Encoding Speed**: 2-3x faster than GIF (with hardware acceleration)
- **Quality**: Superior to GIF at same resolution
- **Memory Usage**: Similar to current GIF encoding

### User Benefits
- Modern video format for better sharing
- Significantly smaller file sizes
- Better quality at lower file sizes
- Faster encoding times
- Native video player support

### Technical Benefits
- Hardware acceleration via WebCodecs
- Future-proof architecture for additional formats
- Cleaner codebase with abstracted encoders
- Better performance monitoring

## Future Enhancements

### Phase 5+ (Future)
- **Audio Support**: Include audio track from source video
- **Advanced Codecs**: H.265/HEVC, AV1 (when browser support improves)
- **WebP Format**: Add as additional image format option
- **Batch Export**: Export multiple clips at once
- **Cloud Integration**: Direct upload to YouTube, Google Drive
- **Advanced Editing**: Trimming, filters, effects

## Risk Mitigation

### Potential Issues and Solutions
1. **WebCodecs API Changes**: Pin Mediabunny version, monitor API updates
2. **Large File Handling**: Implement chunked processing, memory limits
3. **Browser Compatibility**: Clear feature detection and user messaging
4. **Bundle Size Growth**: Use dynamic imports, lazy loading

## Success Criteria
- [ ] MP4 export working with hardware acceleration
- [ ] 80%+ file size reduction achieved
- [ ] Encoding speed faster than GIF
- [ ] Clean abstraction allowing easy format additions
- [ ] No regression in existing GIF functionality
- [ ] User satisfaction with MP4 quality and performance

## Timeline
- **Week 1**: Architecture and MP4 implementation
- **Week 2**: Integration, testing, and optimization
- **Total**: 2 weeks to production-ready feature

## Dependencies
- Chrome 94+ (WebCodecs API support)
- Mediabunny library
- Existing frame extraction pipeline
- No server-side components required