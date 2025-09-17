# Stage-Based Progress Display for GIF Generation

## Overview

Replace percentage-based progress reporting with a clear 4-stage display that shows users what phase of GIF creation is currently active, with cycling messages to indicate ongoing work.

## Problem Statement

Current implementation shows progress as a percentage (0-100%) which gets "stuck" at 50% during color palette generation, creating a poor user experience where the app appears frozen.

## Solution: 4-Stage Display

Instead of showing "50% complete", display the current stage of processing with informative, cycling messages.

## The 4 Stages

### Stage 1: 📹 **Capturing Frames**

Cycling messages:

```javascript
const captureMessages = [
  'Reading video data...',
  'Extracting frames...',
  'Processing frame timings...',
  'Capturing pixel data...',
  'Organizing frame sequence...',
];
```

### Stage 2: 🎨 **Analyzing Colors**

Cycling messages:

```javascript
const paletteMessages = [
  'Scanning color distribution...',
  'Finding dominant colors...',
  'Building color histogram...',
  'Optimizing palette...',
  'Reducing to 256 colors...',
];
```

### Stage 3: 🔧 **Encoding GIF**

Cycling messages:

```javascript
const encodingMessages = [
  'Initializing encoder...',
  'Writing frame data...',
  'Applying compression...',
  'Optimizing frame deltas...',
  'Processing animations...',
];
```

### Stage 4: ✨ **Finalizing**

Cycling messages:

```javascript
const finalizingMessages = [
  'Writing file headers...',
  'Optimizing file size...',
  'Preparing for download...',
  'Final quality checks...',
  'Almost ready...',
];
```

## Visual Implementation

The UI would show:

```
┌─────────────────────────────────────┐
│  Stage 2 of 4: Analyzing Colors    │
│                                     │
│  [✓] Capturing Frames               │
│  [●] Analyzing Colors               │
│  [ ] Encoding GIF                   │
│  [ ] Finalizing                     │
│                                     │
│  Finding dominant colors...         │
│  ⚬ ⚬ ⚬ (animated dots)            │
└─────────────────────────────────────┘
```

## Implementation Code Structure

```javascript
class GifProcessor {
  stages = {
    CAPTURING: {
      name: 'Capturing Frames',
      icon: '📹',
      messages: [
        'Reading video data...',
        'Extracting frames...',
        'Processing frame timings...',
        'Capturing pixel data...',
        'Organizing frame sequence...',
      ],
    },
    ANALYZING: {
      name: 'Analyzing Colors',
      icon: '🎨',
      messages: [
        'Scanning color distribution...',
        'Finding dominant colors...',
        'Building color histogram...',
        'Optimizing palette...',
        'Reducing to 256 colors...',
      ],
    },
    ENCODING: {
      name: 'Encoding GIF',
      icon: '🔧',
      messages: [
        'Initializing encoder...',
        'Writing frame data...',
        'Applying compression...',
        'Optimizing frame deltas...',
        'Processing animations...',
      ],
    },
    FINALIZING: {
      name: 'Finalizing',
      icon: '✨',
      messages: [
        'Writing file headers...',
        'Optimizing file size...',
        'Preparing for download...',
        'Final quality checks...',
        'Almost ready...',
      ],
    },
  };

  currentStage = null;
  messageIndex = 0;
  messageTimer = null;

  updateStage(stageName) {
    this.currentStage = this.stages[stageName];
    this.messageIndex = 0;
    this.startMessageCycling();

    this.onProgress({
      stage: stageName,
      stageNumber: this.getStageNumber(stageName),
      totalStages: 4,
      stageName: this.currentStage.name,
      message: this.currentStage.messages[0],
    });
  }

  startMessageCycling() {
    // Clear existing timer
    if (this.messageTimer) clearInterval(this.messageTimer);

    // Cycle through messages every 500ms
    this.messageTimer = setInterval(() => {
      this.messageIndex = (this.messageIndex + 1) % this.currentStage.messages.length;
      this.onProgress({
        message: this.currentStage.messages[this.messageIndex],
      });
    }, 500);
  }

  async processGif() {
    // Stage 1
    this.updateStage('CAPTURING');
    const frames = await this.captureFrames();

    // Stage 2
    this.updateStage('ANALYZING');
    const palette = await this.generatePalette(frames);

    // Stage 3
    this.updateStage('ENCODING');
    const encoded = await this.encodeFrames(frames, palette);

    // Stage 4
    this.updateStage('FINALIZING');
    const blob = await this.finalizeGif(encoded);

    // Complete
    clearInterval(this.messageTimer);
    this.onProgress({
      complete: true,
      message: '✅ GIF created successfully!',
    });

    return blob;
  }
}
```

## Benefits of Stage-Based Approach

1. **No confusing percentages**: Users don't wonder why it's "stuck" at 50%
2. **Clear expectations**: Users know there are 4 stages total
3. **Informative messages**: Cycling text shows work is happening
4. **Better UX**: Users understand what the system is doing, not just how far along it is
5. **No artificial progress**: Removes the need for fake progress increments
6. **Educational**: Users learn what goes into making a GIF

## Implementation Notes

- Messages should cycle every 500ms to show activity without being distracting
- Each stage should clear check when complete (✓)
- Current stage should show active indicator (●)
- Future stages should show empty indicator (○)
- Include animated dots or spinner to reinforce that work is happening
- On completion, show success message with checkmark

## Files to Update

- `/src/content/gif-processor.ts` - Update progress reporting
- `/src/lib/encoders/gifenc-encoder.ts` - Change from percentage to stage-based callbacks
- `/src/processing/task-manager.ts` - Update progress tracking logic
- `/src/content/index.ts` - Update UI to display stages instead of progress bar
- `/src/content/wizard-styles.css` - Add styles for stage display
