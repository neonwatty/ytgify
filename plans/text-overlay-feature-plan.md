# Revised Text Overlay Feature Plan

## Overview
**Integration task**: Add existing text overlay editor as a new screen in the GIF creation wizard between "Processing" and "Success".

## Current State Analysis
- ✅ **Text overlay system fully implemented**
  - `src/content/text-overlay-editor.tsx` - Complete drag-and-drop editor
  - `src/content/text-overlay-canvas.tsx` - Canvas-based visual editing
  - `src/content/text-controls.tsx` - Property control panel
  - Full animation support (fade-in, fade-out)
- ✅ **GIF encoder supports text overlays**
  - `src/lib/gif-encoder.ts` lines 442-458 already render text on frames
  - Canvas processing pipeline fully integrated
- ✅ **Types and interfaces defined**
  - `TextOverlay` interface in `src/types/index.ts`
  - Complete with animation, styling, and positioning properties
- ❌ **Missing: Text overlay screen in wizard flow**
  - Current flow: Welcome → QuickCapture/CustomRange → Processing → Success
  - Needed: Text editing step after capture, before final processing

## Implementation Steps

### 1. Create TextOverlayScreen Component
**New File**: `src/content/overlay-wizard/screens/TextOverlayScreen.tsx`
```typescript
// Import and integrate existing TextOverlayEditor
// Add video frame preview showing captured GIF frames
// Include "Skip" and "Apply Text" navigation buttons
// Connect to wizard state management
```

### 2. Update Navigation Hook
**File**: `src/content/overlay-wizard/hooks/useOverlayNavigation.ts`
- Add 'text-overlay' to OverlayScreenType enum
- Update screen flow logic:
  - After quick capture: processing → text-overlay → success
  - After custom range: processing → text-overlay → success
- Add conditional skip if user doesn't want text

### 3. Update Wizard Component
**File**: `src/content/overlay-wizard/OverlayWizard.tsx`
- Import TextOverlayScreen component
- Add to screen routing switch statement
- Pass GIF frames/preview data to text overlay screen
- Store text overlays in wizard state for encoding

### 4. Enhance Video Preview Integration
**File**: `src/content/video-preview.tsx`
- Add optional text overlay rendering on preview
- Show live preview with text overlays during editing
- Sync with TextOverlayCanvas for consistent rendering

### 5. Connect to Encoding Pipeline
- Pass text overlays from wizard state to encoder
- Leverage existing text rendering in `src/lib/gif-encoder.ts`
- No changes needed to encoder (already supports text overlays)

## Existing Components to Leverage

### TextOverlayEditor (`src/content/text-overlay-editor.tsx`)
- Complete editing interface with canvas and controls
- Drag-and-drop positioning
- Keyboard shortcuts (Delete key support)
- State management for multiple text layers

### TextOverlayCanvas (`src/content/text-overlay-canvas.tsx`)
- Visual canvas for text positioning
- Selection handles and visual feedback
- Mouse interaction handling
- Coordinate transformation

### TextControls (`src/content/text-controls.tsx`)
- Font family, size, and color controls
- Stroke settings
- Animation options
- Layer management

## Data Flow

```
Wizard State
    ↓
TextOverlayScreen (new)
    ↓
TextOverlayEditor (existing)
    ├── TextOverlayCanvas (existing)
    └── TextControls (existing)
    ↓
Wizard State (updated with overlays)
    ↓
GIF Encoder (existing, already supports text)
```

## Benefits of This Approach
- **Reuses battle-tested components** - No reinventing the wheel
- **Minimal new code required** - Just integration glue
- **Consistent UI/UX** - Uses existing editor patterns
- **Lower risk** - Proven components reduce bugs
- **Faster implementation** - 1-2 days vs 1 week

## Technical Considerations

### Performance
- Text rendering already optimized in encoder
- Canvas operations efficient for real-time preview
- No additional dependencies needed

### Mobile Responsiveness
- Existing components already handle touch events
- May need minor adjustments for wizard layout

### State Management
- Wizard already has state management pattern
- Add `textOverlays: TextOverlay[]` to wizard state
- Pass through to encoding step

## Files to Modify

1. **Create New**:
   - `src/content/overlay-wizard/screens/TextOverlayScreen.tsx`

2. **Update Existing**:
   - `src/content/overlay-wizard/hooks/useOverlayNavigation.ts` - Add screen type
   - `src/content/overlay-wizard/OverlayWizard.tsx` - Add routing
   - `src/content/overlay-wizard/types.ts` - Add text overlay to wizard data
   - `src/content/styles.css` - Any needed styling adjustments

## Testing Plan

1. **Integration Tests**:
   - Verify navigation flow includes text overlay screen
   - Test skip functionality
   - Ensure text overlays pass to encoder

2. **E2E Tests**:
   - Complete wizard flow with text overlay
   - Verify GIF output includes text
   - Test on different video sources

3. **Manual Testing**:
   - Text positioning and editing
   - Preview accuracy
   - Mobile/touch interactions

## Estimated Timeline

- **Day 1**: 
  - Create TextOverlayScreen component
  - Update navigation and routing
  - Basic integration

- **Day 2**:
  - Polish preview integration
  - Testing and bug fixes
  - Documentation updates

## Conclusion

This revised plan leverages the **extensive existing text overlay implementation** rather than building from scratch. The task is primarily **integration work** - connecting the existing, fully-functional text overlay editor into the wizard flow. This approach significantly reduces development time, risk, and complexity while maintaining feature completeness.