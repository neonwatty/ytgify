# Plan: Add Frame Resolution Options to Screen 2 of GIF Wizard

## Overview
Add 3 resolution options to the QuickCaptureScreen (screen 2) alongside the existing frame rate options, leveraging the existing but unused ResolutionScaler infrastructure. Currently, the extension uses the native video resolution, which results in very large GIF files. This feature will give users control over the quality/size tradeoff.

## Current State Analysis

### Existing Infrastructure
- **ResolutionScaler class** (`src/processing/resolution-scaler.ts`): Fully implemented but unused
  - Provides resolution presets (360p, 480p, 720p, Original)
  - Handles intelligent scaling with aspect ratio preservation
  - Includes multi-step scaling for quality preservation
  - Offers sharpening filters to combat downscaling softness

### Current Implementation Issues
- QuickCaptureScreen only has frame rate options (5, 10, 15 fps)
- `handleCreateGif` in content/index.ts uses hardcoded dimensions:
  - Max 640px on longest side
  - No user control over resolution
- Native video resolution is passed through, creating unnecessarily large files

## Implementation Steps

### 1. Update QuickCaptureScreen Component
**File**: `src/content/overlay-wizard/screens/QuickCaptureScreen.tsx`

#### Add State Management
```typescript
const [selectedResolution, setSelectedResolution] = useState('480p'); // Default to 480p for balance
```

#### Create Resolution Options Section
Add a new section after the frame rate options with 3 resolution choices:
- **480p (SD)** - Standard definition, smaller files, good for sharing
- **720p (HD)** - High definition, balanced quality and size
- **Original** - Native resolution, best quality, largest files

#### Update onConfirm Callback
```typescript
onConfirm: (startTime: number, endTime: number, frameRate?: number, resolution?: string) => void;
```

#### Add Visual Indicators
- Display estimated file size based on: `duration × frameRate × resolutionMultiplier`
- Show resolution dimensions (e.g., "480p (854×480)")
- Add icons and descriptive text similar to frame rate options

### 2. Update Data Flow Through Wizard Components

#### OverlayWizard.tsx Updates
**File**: `src/content/overlay-wizard/OverlayWizard.tsx`

- Modify `handleConfirmQuickCapture`:
```typescript
const handleConfirmQuickCapture = (startTime: number, endTime: number, frameRate?: number, resolution?: string) => {
  const selection: TimelineSelection = {
    startTime,
    endTime,
    duration: endTime - startTime
  };
  setScreenData({ startTime, endTime, frameRate: frameRate || 10, resolution: resolution || '480p' });
  onSelectionChange(selection);
  goToScreen('text-overlay');
};
```

- Update `handleConfirmTextOverlay` and `handleSkipTextOverlay` to pass resolution:
```typescript
onCreateGif(selection, overlays, data.resolution);
```

#### TimelineOverlayWizard.tsx Updates
**File**: `src/content/timeline-overlay-wizard.tsx`

Update the interface to include resolution in the data flow:
```typescript
onCreateGif: (selection: TimelineSelection, textOverlays?: TextOverlay[], resolution?: string) => void;
```

### 3. Integrate ResolutionScaler in Processing Pipeline

#### Update handleCreateGif Method
**File**: `src/content/index.ts`

```typescript
import { ResolutionScaler, RESOLUTION_PRESETS } from '@/processing/resolution-scaler';

private async handleCreateGif(selection?: TimelineSelection, textOverlays?: TextOverlay[], resolution?: string) {
  // ... existing validation code ...

  const resolutionScaler = new ResolutionScaler();
  const preset = resolutionScaler.getPresetByName(resolution || '480p');

  // Calculate scaled dimensions
  const scaledDimensions = resolutionScaler.calculateScaledDimensions(
    this.videoElement!.videoWidth,
    this.videoElement!.videoHeight,
    preset!
  );

  const defaultSettings = {
    frameRate: 15,
    width: scaledDimensions.width,
    height: scaledDimensions.height,
    quality: 'medium' as const
  };

  await this.processGifWithSettings(defaultSettings, textOverlays || []);
}
```

#### Update processGifWithSettings Method
Ensure the scaled dimensions are properly used instead of the current hardcoded logic:
```typescript
// Remove the existing dimension calculation logic
// Use the dimensions passed in settings directly
```

### 4. Update Type Definitions

Add resolution to relevant interfaces:
```typescript
interface WizardScreenData {
  startTime?: number;
  endTime?: number;
  frameRate?: number;
  resolution?: string;
  textOverlays?: TextOverlay[];
  // ... other fields
}
```

### 5. Visual Polish & UX Improvements

#### Resolution Options UI Structure
```jsx
<div className="ytgif-resolution-section">
  <div className="ytgif-resolution-label">
    <svg>/* Resolution icon */</svg>
    <span>Resolution</span>
  </div>
  <div className="ytgif-resolution-options">
    <button className={`ytgif-resolution-btn ${selectedResolution === '480p' ? 'active' : ''}`}>
      480p SD
      <span className="ytgif-resolution-desc">Smaller file • Quick sharing</span>
    </button>
    <button className={`ytgif-resolution-btn ${selectedResolution === '720p' ? 'active' : ''}`}>
      720p HD
      <span className="ytgif-resolution-desc">Balanced • Recommended</span>
    </button>
    <button className={`ytgif-resolution-btn ${selectedResolution === 'original' ? 'active' : ''}`}>
      Original
      <span className="ytgif-resolution-desc">Best quality • Larger file</span>
    </button>
  </div>
</div>
```

#### Enhanced File Size Estimation
Update the existing file size estimation to account for resolution:
```typescript
const resolutionMultipliers = {
  '360p': 1.0,
  '480p': 1.3,
  '720p': 2.0,
  'original': 4.0
};
const estimatedSizeMB = gifDuration * selectedFrameRate * 0.05 * resolutionMultipliers[selectedResolution];
```

### 6. CSS Styling

Add styles for the new resolution section in `src/content/wizard-styles.css`:
```css
.ytgif-resolution-section {
  margin-top: 16px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
}

.ytgif-resolution-options {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.ytgif-resolution-btn {
  flex: 1;
  padding: 12px;
  border: 2px solid transparent;
  /* ... similar to frame rate button styles ... */
}

.ytgif-resolution-btn--active {
  border-color: #ff0000;
  background: rgba(255, 0, 0, 0.1);
}
```

## Benefits

### User Benefits
- **Control**: Choose between quality and file size based on use case
- **Faster Processing**: Lower resolutions encode much faster
- **Better Sharing**: Smaller files are easier to share on social media
- **Storage Savings**: Reduced file sizes mean more GIFs can be stored

### Technical Benefits
- **Reuses Existing Code**: Leverages sophisticated ResolutionScaler already implemented
- **Performance**: Reduces memory usage during processing
- **Scalability**: Easy to add more resolution options in the future

### Default Behavior
- Default to 480p for optimal balance
- Original resolution never upscales (maintains quality)
- Even dimensions ensured for encoding compatibility

## Testing Checklist

- [ ] All 3 resolution options create GIFs successfully
- [ ] File sizes scale appropriately with resolution
- [ ] Aspect ratios are preserved correctly
- [ ] Portrait videos (9:16) scale properly
- [ ] Landscape videos (16:9) scale properly
- [ ] Square videos (1:1) scale properly
- [ ] "Original" option maintains native resolution
- [ ] No upscaling occurs when original is smaller than target
- [ ] File size estimation is reasonably accurate
- [ ] UI updates properly when switching resolutions
- [ ] Resolution setting persists through wizard screens
- [ ] Processing uses the selected resolution correctly

## Estimated File Size Impact

Based on typical YouTube videos:
- **Original (1080p)**: ~10-15 MB for 5 second GIF at 10fps
- **720p HD**: ~5-7 MB for 5 second GIF at 10fps
- **480p SD**: ~2-3 MB for 5 second GIF at 10fps

## Future Enhancements

1. **Custom Resolution**: Allow users to input custom dimensions
2. **Preset Profiles**: Quick selection like "Social Media", "Email", "High Quality"
3. **Smart Recommendations**: Suggest resolution based on video content type
4. **Batch Processing**: Apply same resolution to multiple GIFs
5. **Resolution Preview**: Show preview at different resolutions before processing