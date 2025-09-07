# YouTube GIF Maker - Wizard Screen Flow

This document lists all the screens in our wizard flow and their purposes.

## Screen Types

### 1. **Welcome Screen** (`welcome`)
- **File**: `src/content/overlay-wizard/screens/WelcomeScreen.tsx`
- **Purpose**: Initial greeting screen that introduces the GIF creation wizard
- **Features**: 
  - Shows video title and duration
  - Auto-advances after 1.5 seconds
  - Optional manual "Get Started" button
- **Navigation**: Automatically goes to Action Select screen

### 2. **Action Select Screen** (`action-select`)
- **File**: `src/content/overlay-wizard/screens/ActionSelectScreen.tsx`
- **Purpose**: Main choice screen where users select how they want to create their GIF
- **Features**:
  - "Quick Capture" button - for fast 5-second clips
  - "Custom Range" button - for precise time selection
  - Shows current video time and duration
- **Navigation**: Goes to either Quick Capture or Custom Range

### 3. **Quick Capture Screen** (`quick-capture`)
- **File**: `src/content/overlay-wizard/screens/QuickCaptureScreen.tsx`
- **Purpose**: Enhanced video preview and timeline selection for quick GIF creation
- **Features**:
  - **Video Preview**: Real-time video canvas (480x270)
  - **Timeline Scrubber**: Full video timeline with draggable handles
  - **Range Playback**: Play/pause selected range in loop
  - **Duration Presets**: 3s, 5s, 10s, "At Current" buttons
  - **Visual Feedback**: Selection duration, time labels
- **Navigation**: Creates GIF and goes to Processing screen

### 4. **Custom Range Screen** (`custom-range`)
- **File**: `src/content/overlay-wizard/screens/CustomRangeScreen.tsx`
- **Purpose**: Precise time selection with manual input controls
- **Features**:
  - Interactive timeline with draggable selection
  - Text input fields for start/end times
  - Duration presets (4s at current, 10s at current, First 10s)
  - Click timeline to center selection
- **Navigation**: Creates GIF and goes to Processing screen

### 5. **Processing Screen** (`processing`)
- **File**: `src/content/overlay-wizard/screens/ProcessingScreen.tsx`
- **Purpose**: Shows real-time progress during GIF creation
- **Features**:
  - Circular progress indicator with percentage
  - Status messages (frame capture, encoding, finalizing)
  - Stage information with icons
  - Progress bar visualization
  - Animated loading dots
- **Navigation**: Automatically goes to Success screen when complete

### 6. **Success Screen** (`success`)
- **File**: `src/content/overlay-wizard/screens/SuccessScreen.tsx`
- **Purpose**: Completion confirmation with action buttons
- **Features**:
  - Success checkmark animation
  - GIF size display
  - "Download GIF" button
  - "Create Another" button to restart flow
  - "Close" button to exit wizard
- **Navigation**: Can restart flow or close wizard

## Screen Flow Diagram

```
Welcome Screen (auto 1.5s)
    ↓
Action Select Screen
    ├─ Quick Capture → Quick Capture Screen ──┐
    └─ Custom Range → Custom Range Screen ─────┤
                                              ↓
                                    Processing Screen
                                              ↓
                                     Success Screen
                                    (Download/Create Another/Close)
```

## Navigation Logic

The wizard uses the `useOverlayNavigation` hook located in:
- `src/content/overlay-wizard/hooks/useOverlayNavigation.ts`

### Screen State Management
- Maintains screen history for back navigation
- Stores data between screens (start time, end time, etc.)
- Provides navigation functions: `goToScreen()`, `goBack()`, `resetNavigation()`

## Key Features by Screen

### Video Integration
- **Quick Capture & Custom Range**: Both screens can receive `videoElement` prop for live video preview
- **Timeline Scrubbers**: Interactive timeline components for precise selection
- **Preview Playback**: Real-time video playback of selected ranges

### Progress Tracking
- **Processing Screen**: Receives real-time updates via `processingStatus` prop
- Updates include: stage (capturing/encoding), progress percentage, status message

### User Experience
- **Visual Feedback**: All interactions provide immediate visual response
- **Responsive Design**: All screens adapt to different overlay sizes
- **Keyboard Navigation**: Support for keyboard shortcuts and accessibility
- **Error Handling**: Graceful fallbacks when video unavailable

## Testing

All screens are covered by end-to-end tests in:
- `tests/test-wizard-complete-e2e.spec.js` - Full wizard flow
- `tests/test-wizard-video-preview.spec.js` - Video preview specific tests
- `tests/test-wizard-gif-creation.spec.js` - GIF creation flow

## Styling

All wizard screens use styles from:
- `src/content/wizard-styles.css` - Complete styling for all screens and components