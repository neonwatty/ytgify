# Testing Discord Error Link Feature

This guide explains how to test the Discord help link that appears when GIF processing fails.

## Test Coverage

### ✅ Unit Tests (Automated)
Location: `tests/unit/content/overlay-wizard/ProcessingScreen.test.tsx`

**Tests:**
1. Discord help section appears on error state
2. Discord help section hidden during normal processing
3. Discord button opens correct Discord link

**Run:**
```bash
npm test -- ProcessingScreen.test.tsx
```

### ✅ E2E Mock Tests (Automated)
Location: `tests/e2e-mock/error-discord-link.spec.ts`

**Tests:**
1. Discord component structure exists in ProcessingScreen
2. Discord link constant is correct

**Run:**
```bash
npm run test:e2e:mock -- error-discord-link
```

**Note:** CSS verification not included in E2E tests because wizard styles are dynamically injected only when wizard opens. Discord functionality is comprehensively tested via unit tests.

### 📝 Manual Testing (Recommended)

Manual testing is recommended to verify the full user experience with real errors.

## Manual Test Scenarios

### Scenario 1: Force Memory Error (Easiest)

1. **Build extension:**
   ```bash
   npm run build
   ```

2. **Load in Chrome:**
   - Navigate to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist/` folder

3. **Trigger error:**
   - Go to any YouTube video
   - Open GIF wizard (click GIF button or press Ctrl+Shift+G)
   - Select a very long time range (20+ seconds)
   - Choose highest resolution (480p)
   - Choose high frame rate (15 fps)
   - Click through to start processing
   - This should trigger a memory error

4. **Verify Discord section appears:**
   - [ ] Title shows "GIF Creation Failed"
   - [ ] Message reads "Need help? Join our Discord community for support."
   - [ ] Blue "Get Help on Discord" button with Discord icon appears
   - [ ] Button has hover effect (lighter blue on hover)

5. **Test button click:**
   - [ ] Click "Get Help on Discord" button
   - [ ] New tab opens with URL `https://discord.gg/8EUxqR93`
   - [ ] Discord invite page loads correctly

### Scenario 2: Network Buffering Timeout

1. **Setup:**
   - Use Chrome DevTools Network throttling
   - Set to "Slow 3G" or "Offline"

2. **Trigger error:**
   - Open GIF wizard on a YouTube video
   - Start creating a GIF
   - Due to slow network, buffering will timeout
   - After ~40 consecutive duplicate frames, error will occur

3. **Verify Discord link appears** (same checks as Scenario 1)

### Scenario 3: Temporary Code Modification (For Testing)

If you need to reliably trigger errors for testing:

1. **Add debug error trigger:**
   In `src/content/gif-processor.ts`, add to line ~290 (in `processVideoToGif` method):

   ```typescript
   // DEBUG: Force error for testing
   if (window.location.search.includes('test-error')) {
     throw createError('gif', 'Test error - Discord link should appear');
   }
   ```

2. **Rebuild:**
   ```bash
   npm run build
   ```

3. **Test:**
   - Go to YouTube video with `?test-error` in URL
   - Open wizard and start GIF creation
   - Error will immediately occur
   - Verify Discord section appears

4. **Remember to remove debug code before committing!**

## Expected Behavior

### Error State UI
- **Title:** "GIF Creation Failed"
- **Subtitle:** "Error occurred"
- **Discord Container:**
  - Light blue background (`rgba(88, 101, 242, 0.1)`)
  - Border with Discord brand color
  - Centered layout

### Discord Button
- **Text:** "Get Help on Discord"
- **Icon:** Discord logo (left of text)
- **Colors:**
  - Background: `rgba(88, 101, 242, 0.2)`
  - Border: `rgba(88, 101, 242, 0.4)`
  - Hover: Lighter background, moves up 1px
- **Action:** Opens `https://discord.gg/8EUxqR93` in new tab

### States Where Discord Link Should NOT Appear
- ❌ During normal processing (CAPTURING, ANALYZING, ENCODING, FINALIZING)
- ❌ On completion state (when GIF created successfully)
- ❌ On other wizard screens (QuickCapture, TextOverlay, Success)

## Troubleshooting

### Discord link doesn't appear on error
**Check:**
1. Ensure you're testing with a build that includes the changes
2. Verify error state is actually reached (check console logs)
3. Confirm CSS is loaded (check DevTools → Elements → Styles)

### Button doesn't open Discord
**Check:**
1. Pop-up blocker settings
2. Console for any JavaScript errors
3. Verify `openExternalLink` function is not blocked

### CSS styles not applying
**Check:**
1. CSS file was rebuilt (`npm run build`)
2. Clear browser cache and reload extension
3. Check DevTools → Elements to verify classes are present

## Regression Testing

When making future changes, verify:
- [ ] Discord link still appears on error states
- [ ] Link opens correct Discord invite
- [ ] Button styling remains consistent with design
- [ ] No console errors when clicking button
- [ ] Link does NOT appear during normal operation

## Test Checklist

Before considering this feature complete, verify:

- [x] Unit tests pass
- [x] E2E mock tests pass
- [ ] Manual test: Memory error triggers Discord link
- [ ] Manual test: Discord button opens correct invite
- [ ] Manual test: Link does not appear during normal processing
- [ ] Manual test: Link does not appear on success
- [ ] Visual QA: Styling matches design (Discord brand colors)
- [ ] Visual QA: Button hover effect works
- [ ] Cross-browser: Works in Chrome/Edge/Brave
- [ ] Accessibility: Button is keyboard accessible (Tab + Enter)

## Notes

- Real E2E tests cannot reliably trigger processing errors (mock server is stable)
- Manual testing is essential for real-world error scenarios
- Consider testing on slow networks to verify buffering timeout errors
- Discord invite link may change - verify it's current before release
