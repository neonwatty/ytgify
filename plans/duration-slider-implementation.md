# Duration Slider Implementation Plan

## Overview
Replace the current duration preset buttons (3s, 5s, 10s) with a continuous slider widget that allows users to select GIF duration between 1 and 20 seconds.

## Current Implementation Analysis

### Existing Components
- **Location**: `/src/content/overlay-wizard/components/TimelineScrubber.tsx`
- **Current UI**: Three preset buttons (3s, 5s, 10s) in a flex container
- **State Management**:
  - `activePreset` state tracks which preset is selected
  - `detectActivePreset()` function checks if current selection matches a preset
  - Preset buttons update the selection range when clicked

### Current Styling
- **Location**: `/src/content/wizard-styles.css`
- **Classes**:
  - `.ytgif-duration-presets`: Flex container for buttons
  - `.ytgif-preset-btn`: Button styling with hover states
  - `.ytgif-preset-btn--active`: Active state with red (#ff0000) theme
  - **Screen-specific theme**: Quick capture screen uses pink (#ff0066) for active states

## Implementation Details

### 1. Component Updates (`TimelineScrubber.tsx`)

#### Remove:
- `activePreset` state variable
- `setActivePreset` setter function
- `detectActivePreset` callback function
- `useEffect` hook that updates active preset
- Entire preset buttons section (lines 285-316)

#### Add:
```typescript
// Import performance optimization hooks
import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';

// Add ref for slider element
const sliderRef = useRef<HTMLInputElement>(null);
const lastUpdateTime = useRef<number>(0);

// New state for duration slider
const [selectedDuration, setSelectedDuration] = useState<number>(5); // Default 5 seconds

// Bidirectional sync: Update slider when timeline handles are dragged
useEffect(() => {
  const actualDuration = endTime - startTime;
  setSelectedDuration(Number(actualDuration.toFixed(1)));
}, [startTime, endTime]);

// Debounced handler for slider changes (prevent excessive updates)
const handleDurationChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
  const now = Date.now();
  if (now - lastUpdateTime.current < 100) return; // 100ms debounce
  lastUpdateTime.current = now;

  const rawValue = parseFloat(e.target.value);

  // Validate input
  if (isNaN(rawValue)) return;

  const newDuration = Math.max(1, Math.min(20, rawValue)); // Clamp to valid range
  const maxPossibleDuration = duration - startTime;
  const clampedDuration = Math.min(newDuration, maxPossibleDuration);

  setSelectedDuration(clampedDuration);

  // Update timeline with new end position
  const newEnd = startTime + clampedDuration;
  requestAnimationFrame(() => {
    onRangeChange(startTime, newEnd);
  });

  // Update progress CSS variable
  updateSliderProgress(clampedDuration);
}, [startTime, duration, onRangeChange]);

// Helper function to update slider visual progress
const updateSliderProgress = useCallback((value: number) => {
  if (sliderRef.current) {
    const progress = ((value - 1) / 19) * 100; // 1-20 range
    sliderRef.current.style.setProperty('--progress', `${progress}%`);
  }
}, []);

// Initialize progress on mount
useEffect(() => {
  updateSliderProgress(selectedDuration);
}, [selectedDuration, updateSliderProgress]);

// Memoize computed values for performance
const sliderMax = useMemo(() => {
  return Math.min(20, duration); // Dynamic max based on video duration
}, [duration]);

const isSliderDisabled = useMemo(() => {
  return duration <= 0 || !duration;
}, [duration]);
```

#### New JSX Structure:
```jsx
{/* Duration Slider */}
<div className="ytgif-duration-slider-container">
  <div className="ytgif-duration-slider-header">
    <span className="ytgif-duration-label">Duration</span>
    <span className="ytgif-duration-value">{selectedDuration.toFixed(1)}s</span>
  </div>
  <input
    ref={sliderRef}
    type="range"
    className="ytgif-duration-slider"
    min="1"
    max={sliderMax}
    step="0.5"
    value={selectedDuration}
    onChange={handleDurationChange}
    disabled={isSliderDisabled}
    aria-label="GIF duration in seconds"
    aria-valuemin={1}
    aria-valuemax={sliderMax}
    aria-valuenow={selectedDuration}
  />
  <div className="ytgif-duration-slider-ticks">
    <span>1s</span>
    <span>5s</span>
    <span>10s</span>
    <span>15s</span>
    <span>20s</span>
  </div>
</div>
```

### 2. CSS Updates (`wizard-styles.css`)

#### Remove:
- `.ytgif-duration-presets` block
- `.ytgif-preset-btn` and all variants
- `.ytgif-preset-btn--active` states

#### Add:
```css
/* CSS Custom Properties for Theming */
:root {
  --slider-thumb-color: #ff0000;
  --slider-thumb-hover-color: rgba(255, 0, 0, 0.4);
  --slider-thumb-focus-color: rgba(255, 0, 0, 0.6);
  --slider-track-bg: rgba(255, 255, 255, 0.1);
  --slider-progress-bg: rgba(255, 0, 0, 0.3);
}

.ytgif-quick-capture-screen {
  --slider-thumb-color: #ff0066;
  --slider-thumb-hover-color: rgba(255, 0, 102, 0.4);
  --slider-thumb-focus-color: rgba(255, 0, 102, 0.6);
  --slider-progress-bg: rgba(255, 0, 102, 0.3);
}

/* Duration Slider Container */
.ytgif-duration-slider-container {
  margin-top: 16px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  will-change: contents;

.ytgif-duration-slider-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.ytgif-duration-label {
  color: rgba(255, 255, 255, 0.8);
  font-size: 14px;
  font-weight: 500;
}

.ytgif-duration-value {
  color: #fff;
  font-size: 16px;
  font-weight: 600;
  font-family: monospace;
}

/* Slider Input Styling */
.ytgif-duration-slider {
  width: 100%;
  height: 6px;
  -webkit-appearance: none;
  appearance: none;
  background: transparent;
  outline: none;
  cursor: pointer;
  transition: opacity 0.2s ease;
}

/* Disabled State */
.ytgif-duration-slider:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.ytgif-duration-slider:disabled::-webkit-slider-thumb {
  cursor: not-allowed;
}

.ytgif-duration-slider:disabled::-moz-range-thumb {
  cursor: not-allowed;
}

/* Slider Track */
.ytgif-duration-slider::-webkit-slider-track {
  width: 100%;
  height: 6px;
  background: var(--slider-track-bg);
  border-radius: 3px;
  transition: background 0.2s ease;
}

.ytgif-duration-slider::-moz-range-track {
  width: 100%;
  height: 6px;
  background: var(--slider-track-bg);
  border-radius: 3px;
  transition: background 0.2s ease;
}

/* Slider Thumb - Using CSS Variables */
.ytgif-duration-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  background: var(--slider-thumb-color);
  border: 2px solid rgba(255, 255, 255, 0.9);
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.2s ease;
  will-change: transform;
}

.ytgif-duration-slider::-moz-range-thumb {
  width: 18px;
  height: 18px;
  background: var(--slider-thumb-color);
  border: 2px solid rgba(255, 255, 255, 0.9);
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.2s ease;
  will-change: transform;
}

/* Hover States */
.ytgif-duration-slider:not(:disabled)::-webkit-slider-thumb:hover {
  transform: scale(1.1);
  box-shadow: 0 0 8px var(--slider-thumb-hover-color);
}

.ytgif-duration-slider:not(:disabled)::-moz-range-thumb:hover {
  transform: scale(1.1);
  box-shadow: 0 0 8px var(--slider-thumb-hover-color);
}

/* Active/Focus States */
.ytgif-duration-slider:focus::-webkit-slider-thumb {
  box-shadow: 0 0 12px var(--slider-thumb-focus-color);
}

.ytgif-duration-slider:focus::-moz-range-thumb {
  box-shadow: 0 0 12px var(--slider-thumb-focus-color);
}

/* Tick marks below slider */
.ytgif-duration-slider-ticks {
  display: flex;
  justify-content: space-between;
  margin-top: 4px;
  padding: 0 4px;
}

.ytgif-duration-slider-ticks span {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.4);
  font-family: monospace;
}

/* Progress fill effect with smooth transitions */
.ytgif-duration-slider {
  background: linear-gradient(
    to right,
    var(--slider-progress-bg) 0%,
    var(--slider-progress-bg) var(--progress, 20%),
    var(--slider-track-bg) var(--progress, 20%),
    var(--slider-track-bg) 100%
  );
  transition: background 0.15s ease;
}
```

### 3. Additional Component Updates

#### Update Parent Components
`QuickCaptureScreen.tsx` needs to be checked for compatibility:
```typescript
// Ensure props are passed correctly to TimelineScrubber
<TimelineScrubber
  duration={duration}
  startTime={startTime}
  endTime={endTime}
  currentTime={currentTime}
  previewTime={previewTime}
  onRangeChange={handleRangeChange}
  onSeek={handleSeek}
  minDuration={0.5}
  maxDuration={20} // Updated from 30 to match slider max
/>
```

#### Helper Functions to Add
```typescript
// Validation helper
const validateDuration = (value: number): number => {
  if (isNaN(value)) return 5; // Default fallback
  return Math.max(1, Math.min(20, value));
};

// Format duration with proper decimal places
const formatDuration = (seconds: number): string => {
  return seconds.toFixed(1) + 's';
};

// Calculate progress percentage
const calculateProgress = (value: number, min: number, max: number): number => {
  return ((value - min) / (max - min)) * 100;
};

### 4. Test Implementation

Create new test file: `/tests/unit/components/TimelineScrubber.test.tsx`

#### Comprehensive Test Suite:
```typescript
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import TimelineScrubber from '@/content/overlay-wizard/components/TimelineScrubber';

describe('TimelineScrubber Duration Slider', () => {
  const defaultProps = {
    duration: 60,
    startTime: 10,
    endTime: 15,
    currentTime: 12,
    onRangeChange: jest.fn(),
    onSeek: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // 1. Rendering Tests
  describe('Rendering', () => {
    it('renders slider with correct attributes', () => {
      render(<TimelineScrubber {...defaultProps} />);
      const slider = screen.getByRole('slider');
      expect(slider).toHaveAttribute('min', '1');
      expect(slider).toHaveAttribute('max', '20');
      expect(slider).toHaveAttribute('step', '0.5');
    });

    it('displays default value of 5 seconds', () => {
      render(<TimelineScrubber {...defaultProps} />);
      const valueDisplay = screen.getByText('5.0s');
      expect(valueDisplay).toBeInTheDocument();
    });

    it('disables slider when video duration is 0', () => {
      render(<TimelineScrubber {...defaultProps} duration={0} />);
      const slider = screen.getByRole('slider');
      expect(slider).toBeDisabled();
    });
  });

  // 2. Interaction Tests
  describe('Slider Interactions', () => {
    it('updates duration when slider is moved', () => {
      render(<TimelineScrubber {...defaultProps} />);
      const slider = screen.getByRole('slider');

      fireEvent.change(slider, { target: { value: '10' } });

      expect(screen.getByText('10.0s')).toBeInTheDocument();
      expect(defaultProps.onRangeChange).toHaveBeenCalledWith(10, 20);
    });

    it('debounces rapid slider changes', async () => {
      render(<TimelineScrubber {...defaultProps} />);
      const slider = screen.getByRole('slider');

      // Rapid changes
      fireEvent.change(slider, { target: { value: '7' } });
      fireEvent.change(slider, { target: { value: '8' } });
      fireEvent.change(slider, { target: { value: '9' } });

      await waitFor(() => {
        // Should only call once due to debouncing
        expect(defaultProps.onRangeChange).toHaveBeenCalledTimes(1);
      }, { timeout: 150 });
    });
  });

  // 3. Bidirectional Sync Tests
  describe('Timeline-Slider Synchronization', () => {
    it('updates slider when timeline handles are dragged', () => {
      const { rerender } = render(<TimelineScrubber {...defaultProps} />);

      // Simulate timeline handle drag
      rerender(<TimelineScrubber {...defaultProps} startTime={5} endTime={12} />);

      const valueDisplay = screen.getByText('7.0s');
      expect(valueDisplay).toBeInTheDocument();
    });

    it('maintains sync when start time changes', () => {
      const { rerender } = render(<TimelineScrubber {...defaultProps} />);

      rerender(<TimelineScrubber {...defaultProps} startTime={20} endTime={25} />);

      expect(screen.getByText('5.0s')).toBeInTheDocument();
    });
  });

  // 4. Edge Case Tests
  describe('Edge Cases', () => {
    it('clamps slider value to video duration', () => {
      render(<TimelineScrubber {...defaultProps} duration={8} startTime={0} />);
      const slider = screen.getByRole('slider');

      fireEvent.change(slider, { target: { value: '10' } });

      // Should clamp to max possible (8 seconds)
      expect(screen.getByText('8.0s')).toBeInTheDocument();
    });

    it('handles NaN input gracefully', () => {
      render(<TimelineScrubber {...defaultProps} />);
      const slider = screen.getByRole('slider');

      fireEvent.change(slider, { target: { value: 'invalid' } });

      // Should maintain previous valid value
      expect(screen.getByText('5.0s')).toBeInTheDocument();
    });

    it('handles videos shorter than 1 second', () => {
      render(<TimelineScrubber {...defaultProps} duration={0.5} />);
      const slider = screen.getByRole('slider');

      expect(slider).toBeDisabled();
    });
  });

  // 5. Performance Tests
  describe('Performance', () => {
    it('uses requestAnimationFrame for smooth updates', () => {
      const rafSpy = jest.spyOn(window, 'requestAnimationFrame');
      render(<TimelineScrubber {...defaultProps} />);
      const slider = screen.getByRole('slider');

      fireEvent.change(slider, { target: { value: '8' } });

      expect(rafSpy).toHaveBeenCalled();
      rafSpy.mockRestore();
    });
  });

  // 6. Integration Tests
  describe('Integration with Parent Components', () => {
    it('works with QuickCaptureScreen props', () => {
      render(
        <div className="ytgif-quick-capture-screen">
          <TimelineScrubber {...defaultProps} />
        </div>
      );

      const slider = screen.getByRole('slider');
      // Should have pink theme applied
      expect(slider).toHaveClass('ytgif-duration-slider');
    });

    it('respects minDuration and maxDuration props', () => {
      render(
        <TimelineScrubber
          {...defaultProps}
          minDuration={0.5}
          maxDuration={20}
        />
      );

      const slider = screen.getByRole('slider');
      expect(slider).toHaveAttribute('max', '20');
    });
  });
});
```

## Implementation Checklist

### Phase 1: Core Implementation
- [ ] Create feature branch `duration-slider-test`
- [ ] Update `TimelineScrubber.tsx` with:
  - [ ] Remove preset button code (lines 29-63, 285-316)
  - [ ] Add slider state and refs
  - [ ] Implement bidirectional sync
  - [ ] Add debouncing logic
  - [ ] Add validation and error handling
  - [ ] Implement performance optimizations (memo, RAF)
- [ ] Update `wizard-styles.css` with:
  - [ ] Remove preset button styles
  - [ ] Add CSS custom properties
  - [ ] Add slider styles with themes
  - [ ] Add disabled state styles
  - [ ] Add smooth transitions

### Phase 2: Integration & Testing
- [ ] Update `QuickCaptureScreen.tsx` for compatibility
- [ ] Create comprehensive test suite
- [ ] Run tests with `npm test`
- [ ] Manual testing in Chrome extension
- [ ] Test edge cases:
  - [ ] Videos < 1 second
  - [ ] Videos > 20 seconds
  - [ ] Dynamic duration changes
  - [ ] Rapid slider movements

### Phase 3: Performance & Polish
- [ ] Verify 60fps slider updates
- [ ] Check memory usage with DevTools
- [ ] Ensure no unnecessary re-renders
- [ ] Add loading/transition animations
- [ ] Final cross-browser testing

## Success Criteria
- [ ] Slider allows selection from 1-20 seconds in 0.5s increments
- [ ] Default value is 5 seconds
- [ ] Bidirectional sync between slider and timeline handles
- [ ] Pink (#ff0066) theme on quick capture screen
- [ ] Smooth 60fps interactions with debouncing
- [ ] Proper error handling for edge cases
- [ ] No regression in existing functionality
- [ ] Tests provide 90%+ coverage
- [ ] Performance optimizations implemented (memo, RAF, refs)

## Rollback Plan
If issues arise, the implementation can be reverted by:
1. Restoring the preset buttons JSX
2. Restoring the preset-related state and functions
3. Restoring the CSS for preset buttons
4. Removing new slider-related code

## Future Enhancements
- Remember last used duration in Chrome storage API
- Visual preset markers on slider track (3s, 5s, 10s)
- Snap-to-preset behavior with magnetic effect
- Dynamic max value based on actual video duration
- Keyboard shortcuts for quick duration changes (e.g., 1-9 keys)
- Visual feedback when hitting min/max bounds
- Optional audio feedback for slider interactions