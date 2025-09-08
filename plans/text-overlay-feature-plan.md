# Plan: Add Text Overlay Screen to GIF Creation Wizard

## Overview
Add a new screen between "Processing" and "Success" where users can add text overlays to their GIF before downloading. This will provide an interactive canvas-based editor for positioning and styling text.

## Screen Flow Update
1. Welcome → 2. Quick Capture/Custom Range → 3. Processing → **4. Text Overlay (NEW)** → 5. Success

## Library Selection
After analyzing options, I recommend:
- **Primary Choice**: Pure Canvas API with custom implementation
  - Lightweight (no additional dependencies)
  - Full control over rendering
  - Direct integration with existing GIF encoding pipeline
- **Alternative**: Konva.js (if advanced features needed later)
  - Excellent drag-and-drop support
  - Rich text editing capabilities
  - ~80KB gzipped

## Implementation Steps

### 1. Update Navigation Hook
- Add 'text-overlay' to OverlayScreenType enum
- Update screen flow logic to transition from processing → text-overlay → success

### 2. Create TextOverlayScreen Component
- Canvas-based preview of the GIF with text overlay
- Text input controls (content, font, size, color, position)
- Drag-to-position functionality using mouse events
- Live preview updates
- Skip button (if user doesn't want text)

### 3. Text Overlay Features
- Text properties: content, font family, font size, color, stroke
- Positioning: drag-and-drop or manual x/y coordinates
- Multiple text layers support
- Text animation options (static, fade-in, typewriter)
- Preset styles (meme-style, subtitle, watermark)

### 4. Processing Integration
- Modify GIF encoder to accept text overlay parameters
- Apply text to each frame during encoding
- Use Canvas 2D API to draw text on frames
- Maintain performance with efficient rendering

### 5. Data Structure Updates
- Add TextOverlay interface to types
- Store overlay configuration in wizard data
- Pass overlay data to encoder

### 6. UI/UX Considerations
- Show GIF preview as background
- Floating text editor panel
- Real-time preview of text on GIF
- Mobile-responsive controls
- Undo/redo functionality

## Technical Architecture

```typescript
interface TextOverlay {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  fontFamily: string;
  color: string;
  strokeColor?: string;
  strokeWidth?: number;
  animation?: 'none' | 'fade' | 'typewriter';
  startTime?: number;
  endTime?: number;
}
```

## Files to Modify
1. `src/content/overlay-wizard/hooks/useOverlayNavigation.ts` - Add new screen type
2. `src/content/overlay-wizard/OverlayWizard.tsx` - Add screen routing
3. `src/content/overlay-wizard/screens/TextOverlayScreen.tsx` - NEW file
4. `src/types/index.ts` - Add TextOverlay interface
5. `src/processing/gif-encoder.ts` - Add text rendering logic
6. `src/content/wizard-styles.css` - Add text overlay screen styles

## Benefits
- Enhanced user experience with customizable GIFs
- No heavy dependencies (using native Canvas API)
- Seamless integration with existing workflow
- Professional-looking GIF output with text overlays

## Library Research Summary

### Canvas Libraries Evaluated

#### Konva.js
- **Pros**: Excellent drag-and-drop, declarative API, React integration
- **Cons**: Requires GIF parsing library (gifler) for GIF support
- **Size**: ~80KB gzipped
- **Best for**: Complex interactive canvas applications

#### Fabric.js
- **Pros**: Rich text editing, on-canvas controls, mature ecosystem
- **Cons**: Larger size, no native GIF animation support
- **Size**: ~100KB gzipped
- **Best for**: Full-featured image editors

#### Interact.js
- **Pros**: Lightweight, focused on drag interactions
- **Cons**: Not canvas-specific, requires additional rendering logic
- **Size**: ~20KB gzipped
- **Best for**: Adding drag to existing canvas implementations

#### Native Canvas API
- **Pros**: No dependencies, full control, smallest size
- **Cons**: More code to write for interactions
- **Size**: 0KB (native)
- **Best for**: Lightweight, performance-critical applications

### GIF Processing Libraries

#### Current Stack
- **gif.js**: Already in use for encoding
- **gifenc**: Already in use as alternative encoder
- Both support frame manipulation before encoding

### Recommendation
Start with native Canvas API for the text overlay feature since:
1. No additional dependencies needed
2. Full control over rendering pipeline
3. Direct integration with existing GIF encoders
4. Can add Konva.js later if more features needed