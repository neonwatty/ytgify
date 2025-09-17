# Plan to Remove CustomRangeScreen from Codebase

## Summary
CustomRangeScreen exists in both popup and content overlay implementations but is currently unreachable in the UI flow. It's safe to remove without breaking functionality since no navigation paths lead to it.

## Current State Analysis

### What is CustomRangeScreen?
- A screen component that provides manual time range selection for GIF creation
- Has its own custom timeline implementation (doesn't use TimelineScrubber component)
- Exists in two locations:
  - `/src/content/overlay-wizard/screens/CustomRangeScreen.tsx` - Content script version
  - `/src/popup/screens/CustomRangeScreen.tsx` - Popup extension version

### Why is it unused?
- The wizard flow currently goes: `welcome` → `quick-capture` → `text-overlay` → `processing` → `success`
- There's no navigation path to `custom-range` screen (no `goToScreen('custom-range')` calls found)
- An `action-select` screen type is defined but never implemented (likely intended as a choice screen)
- CustomRangeScreen appears to be orphaned code from an incomplete feature

## Files to Modify

### 1. Delete Component Files (2 files)
- `/src/content/overlay-wizard/screens/CustomRangeScreen.tsx`
- `/src/popup/screens/CustomRangeScreen.tsx`

### 2. Update Type Definitions (3 files)

#### `/src/content/overlay-wizard/hooks/useOverlayNavigation.ts`
- Remove `'custom-range'` from `OverlayScreenType` union (line 8)
- Keep `'action-select'` for potential future use

#### `/src/popup/hooks/useScreenNavigation.ts`
- Remove `'custom-range'` from `ScreenType` union (line 7)

#### `/src/popup/components/ScreenNavigator.tsx`
- Remove `'custom-range'` from screens array (line 29)
- Remove `'custom-range': 3` from progressSteps object (line 55)

### 3. Update Main Components (1 file)

#### `/src/content/overlay-wizard/OverlayWizard.tsx`
- Remove import statement (line 6): `import CustomRangeScreen from './screens/CustomRangeScreen';`
- Remove conditional rendering block (lines 214-222):
  ```tsx
  {currentScreen === 'custom-range' && (
    <CustomRangeScreen
      videoDuration={videoDuration}
      currentTime={currentTime}
      onConfirm={handleConfirmCustomRange}
      onBack={goBack}
      onSeekTo={onSeekTo}
    />
  )}
  ```
- Update progress indicator logic (line 150):
  - Change from: `currentScreen === 'quick-capture' || currentScreen === 'custom-range'`
  - Change to: `currentScreen === 'quick-capture'`

### 4. Clean Up CSS (1 file)

#### `/src/content/wizard-styles.css`
Remove all `.ytgif-custom-range-screen` selectors (23 occurrences):
- Line 309: `.ytgif-custom-range-screen .ytgif-button-primary`
- Line 314: `.ytgif-custom-range-screen .ytgif-button-primary:hover:not(:disabled)`
- Line 546: `.ytgif-custom-range-screen .ytgif-preview-play-button`
- Line 551: `.ytgif-custom-range-screen .ytgif-preview-play-button:hover`
- Line 599: `.ytgif-custom-range-screen .ytgif-preview-control-btn.playing`
- Line 648: `.ytgif-custom-range-screen .ytgif-timeline-selection`
- Line 669: `.ytgif-custom-range-screen .ytgif-timeline-handle`
- Line 717: `.ytgif-custom-range-screen .ytgif-timeline-current`
- Line 723: `.ytgif-custom-range-screen .ytgif-timeline-current-in-range`
- Line 725: `.ytgif-custom-range-screen .ytgif-timeline-current-out-range`
- Line 771: `.ytgif-custom-range-screen .ytgif-label-selection`
- Line 815: `.ytgif-custom-range-screen .ytgif-preset-btn.ytgif-preset-btn--active`
- Line 821: `.ytgif-custom-range-screen .ytgif-preset-btn.ytgif-preset-btn--active:hover`
- Line 973: `.ytgif-custom-range-screen .ytgif-timeline-track .ytgif-timeline-selection`
- Line 991: `.ytgif-custom-range-screen .ytgif-selection-handle`
- Line 1122: `.ytgif-custom-range-screen .ytgif-time-input:focus`
- Line 1141: `.ytgif-custom-range-screen .ytgif-duration-value`
- Line 1258: `.ytgif-custom-range-screen .ytgif-frame-rate-label svg`
- Line 1303: `.ytgif-custom-range-screen .ytgif-frame-rate-btn--active`
- Line 1309: `.ytgif-custom-range-screen .ytgif-frame-rate-btn--active:hover`
- Line 155: `.ytgif-custom-range-screen` (CSS custom properties block)

Note: These are all paired with `.ytgif-quick-capture-screen` so we just remove the custom-range parts, keeping the quick-capture styles intact.

### 5. Update Documentation (2 files)

#### `/plans/duration-slider-implementation.md`
- Line 155: Remove `.ytgif-custom-range-screen` from CSS block
- Line 308: Remove reference to `CustomRangeScreen.tsx` in "Update Parent Components" section
- Line 533: Remove "Update `CustomRangeScreen.tsx` for compatibility" task

#### `/plans/webp-integration-plan.md`
- Line 104: Remove `'custom-range'` from screen type list

## Verification Steps

### 1. Build Verification
```bash
npm run build
```
Ensure no compilation errors related to missing imports or types.

### 2. Type Checking
```bash
npm run typecheck
```
Verify TypeScript types are consistent and no errors about missing types.

### 3. Lint Checking
```bash
npm run lint
```
Catch any import issues or unused variables.

### 4. Runtime Testing
- Load the extension in Chrome
- Test the complete wizard flow:
  - Open YouTube video
  - Click GIF button
  - Navigate through: Welcome → Quick Capture → Text Overlay → Processing → Success
  - Ensure all screens render correctly
  - Verify progress indicator shows correct steps

### 5. Search Verification
```bash
# Search for any remaining references
ast-grep --pattern 'CustomRangeScreen' --lang tsx
ast-grep --pattern 'custom-range' --lang ts
grep -r "CustomRangeScreen" src/
grep -r "custom-range" src/
```

## Safety Considerations

### ✅ Safe to Remove Because:
- **No navigation paths exist**: No `goToScreen('custom-range')` calls found anywhere
- **Component is dead code**: Never reachable through normal user flow
- **No data dependencies**: No other components depend on CustomRangeScreen's functionality
- **CSS rules are duplicates**: All styles are paired with QuickCaptureScreen
- **No external references**: No Chrome messages or storage references to this screen
- **Clean separation**: Component is self-contained with no side effects

### ⚠️ Things to Watch:
- **Keep `action-select` type**: Might be used for future feature implementation
- **Test progress indicator**: Ensure dots still show correct active state
- **Verify wizard flow**: Test complete flow to ensure no regressions
- **Check for dynamic references**: Ensure no string-based screen navigation breaks

## Implementation Order

1. **Update type definitions first**
   - Remove from type unions to catch any compilation issues early

2. **Remove from OverlayWizard**
   - Remove import and conditional rendering
   - Update progress indicator logic

3. **Delete component files**
   - Remove both popup and content versions

4. **Clean up CSS**
   - Remove all custom-range-screen selectors

5. **Update documentation**
   - Remove from plan files

6. **Run verification suite**
   - Build, typecheck, lint, test

## Expected Outcomes

### Benefits:
- **Reduced complexity**: ~500 lines of unused code removed
- **Clearer codebase**: No confusion about which screen handles duration selection
- **Smaller bundle**: Reduced JavaScript bundle size
- **Easier maintenance**: Less code to maintain and update
- **Cleaner CSS**: 23 fewer CSS rules to process

### No Impact On:
- Current user experience (screen was already unreachable)
- QuickCaptureScreen functionality (remains the primary capture interface)
- Timeline selection features (QuickCaptureScreen handles this)
- GIF creation workflow (uses QuickCaptureScreen's implementation)

## Rollback Plan

If any issues arise after removal:
1. Revert the commit that removes CustomRangeScreen
2. All files and references will be restored
3. No data migration needed since component was unused

## Future Considerations

If custom range selection is needed in the future:
1. Consider extending QuickCaptureScreen instead of separate screen
2. Or implement as a toggle within QuickCaptureScreen
3. Use shared TimelineScrubber component for consistency
4. Avoid duplicate timeline implementations