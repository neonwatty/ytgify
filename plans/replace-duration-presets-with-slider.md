# Plan: Replace Duration Preset Buttons with Slider Widget

## Overview
Replace the current 3-button duration preset UI (3s, 5s, 10s) with a continuous slider widget allowing selection between 1-20 seconds for GIF clip duration.

## Current Implementation
- **Location**: `src/content/overlay-wizard/components/TimelineScrubber.tsx` (lines 285-316)
- **Styles**: `src/content/wizard-styles.css` (lines 765-811)
- **Current UI**: Three preset buttons for 3s, 5s, and 10s durations
- **Active state tracking**: Uses `activePreset` state to highlight selected duration

## Implementation Steps

### 1. Update TimelineScrubber Component
**File**: `src/content/overlay-wizard/components/TimelineScrubber.tsx`

**Remove**:
- Preset button section (lines 285-316)
- `activePreset` state variable (line 30)
- `detectActivePreset` function (lines 39-57)
- `useEffect` for preset detection (lines 60-63)

**Add**:
- New state for slider value: `const [durationSliderValue, setDurationSliderValue] = useState(endTime - startTime)`
- Duration slider component with:
  - Range: 1-20 seconds
  - Step: 0.1 seconds for fine control
  - Current value display
  - Real-time preview update
- Slider change handler:
  ```typescript
  const handleDurationSliderChange = (value: number) => {
    const maxEnd = Math.min(startTime + value, duration);
    onRangeChange(startTime, maxEnd);
    setDurationSliderValue(value);
  };
  ```
- Ensure slider respects video duration boundaries
- Update slider when timeline handles are dragged

### 2. Add Slider Styles
**File**: `src/content/wizard-styles.css`

**Remove**:
- `.ytgif-duration-presets` block (lines 765-770)
- `.ytgif-preset-btn` styles (lines 772-811)

**Add**:
```css
.ytgif-duration-slider {
  margin-top: 12px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
}

.ytgif-slider-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.ytgif-slider-label {
  color: rgba(255, 255, 255, 0.8);
  font-size: 12px;
}

.ytgif-slider-value {
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  background: rgba(255, 0, 0, 0.2);
  padding: 2px 8px;
  border-radius: 4px;
}

.ytgif-slider-input {
  -webkit-appearance: none;
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.1);
  outline: none;
  transition: background 0.2s;
}

.ytgif-slider-input:hover {
  background: rgba(255, 255, 255, 0.15);
}

.ytgif-slider-input::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #ff0000;
  cursor: pointer;
  transition: transform 0.2s;
}

.ytgif-slider-input::-webkit-slider-thumb:hover {
  transform: scale(1.2);
  box-shadow: 0 0 8px rgba(255, 0, 0, 0.5);
}

.ytgif-slider-input::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #ff0000;
  cursor: pointer;
  transition: transform 0.2s;
}
```

### 3. Update Component Integration
**File**: `src/content/overlay-wizard/screens/QuickCaptureScreen.tsx`
- No changes needed - component already passes necessary props to TimelineScrubber

## Testing Strategy

### Unit Tests
**Create**: `tests/unit/components/TimelineScrubber.test.tsx`

Test cases:
1. **Slider Value Changes**
   - Test that moving slider updates duration correctly
   - Test that endTime updates when slider changes
   - Test that slider value syncs with handle dragging

2. **Boundary Conditions**
   - Test minimum duration (1 second)
   - Test maximum duration (20 seconds)
   - Test video duration limit (slider max adapts to video length)

3. **Integration**
   - Test slider updates when timeline handles are dragged
   - Test slider respects current start position
   - Test slider disabled state for very short videos

### E2E Tests
**Create/Update**: `tests/e2e/timeline-scrubber.spec.js`

Test scenarios:
1. **Slider Interaction**
   ```javascript
   test('duration slider updates GIF length', async ({ page }) => {
     // Navigate to YouTube video
     // Click GIF button
     // Locate slider element
     // Drag slider to different positions
     // Verify duration label updates
     // Verify timeline selection updates
   });
   ```

2. **Keyboard Navigation**
   - Test arrow keys adjust slider
   - Test tab navigation
   - Test enter/space activation

3. **Visual Feedback**
   - Test hover states
   - Test active/dragging states
   - Test value display updates

### Manual Testing Checklist
- [ ] Load extension on YouTube videos of various lengths
- [ ] Test with video < 20 seconds (slider max should adapt)
- [ ] Test with video > 20 seconds (slider max should be 20s)
- [ ] Test with video < 1 second (slider should be disabled)
- [ ] Verify slider updates when dragging timeline handles
- [ ] Test slider responsiveness on different screen sizes
- [ ] Verify GIF generation works with various slider values
- [ ] Test keyboard accessibility (arrow keys, tab)
- [ ] Verify visual feedback (hover, active states)
- [ ] Test value display updates in real-time

## UI/UX Considerations

### Visual Design
- Slider should match the dark theme aesthetic
- Use red accent color (#ff0000) for thumb and active state
- Smooth transitions for hover and drag states

### Accessibility
- Add ARIA labels: `aria-label="GIF duration"`, `aria-valuemin="1"`, `aria-valuemax="20"`
- Include `aria-valuenow` with current value
- Ensure keyboard navigation works (arrow keys for fine adjustment)
- Add focus styles for keyboard users

### User Feedback
- Display current value prominently (e.g., "5.5s")
- Consider adding tick marks at 5s intervals
- Show visual feedback when at min/max limits
- Smooth animation when value changes

## Potential Edge Cases

1. **Video Duration Constraints**
   - Videos shorter than 20 seconds: Slider max = video duration
   - Videos shorter than 1 second: Disable slider, show message
   - Start position near end: Limit slider to remaining duration

2. **User Interaction Conflicts**
   - Dragging timeline handles should update slider value
   - Changing slider should preserve start position when possible
   - If slider change would exceed video duration, adjust start position

3. **Performance**
   - Debounce slider updates to avoid excessive re-renders
   - Optimize preview updates for smooth interaction

4. **Browser Compatibility**
   - Test range input styling across Chrome versions
   - Ensure fallback styles for older browsers

## Implementation Order
1. Remove preset button code from TimelineScrubber
2. Implement basic slider functionality
3. Add styling and visual polish
4. Implement boundary condition handling
5. Add accessibility features
6. Write unit tests
7. Write E2E tests
8. Perform manual testing
9. Address any edge cases discovered

## Success Criteria
- Users can select any duration between 1-20 seconds with 0.1s precision
- Slider respects video duration limits
- UI is intuitive and responsive
- All existing functionality remains intact
- Tests pass and cover main use cases
- Accessibility standards are met