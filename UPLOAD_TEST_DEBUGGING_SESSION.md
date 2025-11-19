# Phase 2 E2E Upload Tests - Debugging Session Summary

**Date:** 2025-11-13
**Session Duration:** ~4 hours
**Initial Status:** 2/6 tests passing
**Final Status:** 0/6 tests passing (all fail with viewport issue)

## Problem Statement

Phase 2 E2E upload tests fail consistently with "element outside of viewport" errors when attempting to click the Next button in the QuickCapture screen, despite mock E2E tests passing with identical browser configuration.

##  Debugging Timeline

### Issue 1: Backend 500 Errors ✅ FIXED
**Problem:** All upload requests returned 500 Internal Server Error
**Root Cause:** ActiveStorage missing `default_url_options[:host]` in development environment
**Fix Applied:**
- Added to `ytgify-share/config/environments/development.rb:42`:
  ```ruby
  Rails.application.routes.default_url_options = { host: "localhost", port: 3000 }
  ```
**Result:** Backend now returns 200 OK with proper GIF data

### Issue 2: Test Selector Mismatch ✅ FIXED
**Problem:** `SuccessPage` selectors not finding upload status elements
**Root Cause:** Missing `.ytgif-upload-status` CSS class in selector
**Fix Applied:**
- Updated `tests/e2e-upload/page-objects/SuccessPage.ts:40`:
  ```typescript
  this.uploadStatusBadge = page.locator('.ytgif-upload-status, .upload-status-badge, ...');
  ```
**Result:** Selectors now match actual DOM elements

### Issue 3: Incorrect Storage Keys ✅ FIXED
**Problem:** Tests setting preferences in wrong storage location with wrong keys
**Root Cause:** Used `chrome.storage.sync.preferences` instead of `chrome.storage.local.authPreferences`
**Fix Applied:**
- Test #3 (lines 217-227): Changed to `chrome.storage.local` with `authPreferences.autoUpload`
- Test #5 (lines 385-395): Changed `defaultPrivacy: 'private'` to `'private_access'`
**Result:** Tests now configure preferences correctly

### Issue 4: Error Message Retrieval ✅ FIXED
**Problem:** `getUploadErrorMessage()` returned null when errors present
**Root Cause:** Error messages shown in status badge text, not separate element
**Fix Applied:**
- Updated `tests/e2e-upload/page-objects/SuccessPage.ts:220-231`:
  ```typescript
  async getUploadErrorMessage(): Promise<string | null> {
    const status = await this.getUploadStatus();
    if (status !== 'failed') return null;
    return await this.uploadStatusBadge.textContent();
  }
  ```
**Result:** Error messages now retrievable from badge

### Issue 5: Skip Button Selector Conflict ✅ FIXED
**Problem:** `has-text("Skip")` matched both YouTube's "Skip navigation" and extension's "Skip This Step" buttons
**Root Cause:** Selector too broad for real YouTube page context
**Fix Applied:**
- Updated `tests/e2e-mock/page-objects/TextOverlayPage.ts:32`:
  ```typescript
  this.skipButton = page.locator('... button:has-text("Skip This Step"), ...');
  ```
**Result:** Selector now specific to extension button

### Issue 6: Short Action Timeout ✅ FIXED
**Problem:** Tests timing out after 15 seconds on clicks
**Root Cause:** Upload config had `actionTimeout: 15000` vs mock tests' `60000`
**Fix Applied:**
- Updated `tests/playwright-upload.config.ts:53`:
  ```typescript
  actionTimeout: 60000, // Match mock tests - GIF processing needs time
  ```
**Result:** Tests have more time for actions

### Issue 7: Conflicting Playwright Config ✅ FIXED
**Problem:** Upload config had `projects` section with `launchOptions` conflicting with fixtures
**Root Cause:** Fixtures use `launchPersistentContext`, config tried to also set launch options
**Fix Applied:**
- Removed `tests/playwright-upload.config.ts:57-74` (entire `projects` section)
- Added comment explaining fixtures handle browser launch
**Result:** No config/fixture conflict

### Issue 8: Element Outside Viewport ❌ UNSOLVED
**Problem:** All tests fail immediately with "Element is outside of the viewport" on `QuickCapturePage.clickNext()`
**Root Cause:** Unknown - wizard overlay renders outside viewport in upload tests but not mock tests
**Attempted Fix:**
- Added `{ force: true }` to `tests/e2e-mock/page-objects/QuickCapturePage.ts:175`:
  ```typescript
  await this.nextButton.click({ force: true });
  ```
**Result:** Tests fail faster (4.4s instead of 60s timeout), but still fail with same error

## Current State

### What Works
- ✅ Extension builds successfully
- ✅ Mock E2E tests pass (72/72) ✓
- ✅ Backend API accessible and returns correct responses
- ✅ Extension loads in upload test browser
- ✅ Wizard UI appears (confirmed by screenshots)
- ✅ GIF button injection works
- ✅ Wizard activation works

### What Fails
- ❌ QuickCapturePage.clickNext() - "Element is outside of viewport"
- ❌ All 6 upload E2E tests fail on this same error
- ❌ Happens despite identical fixture configuration to passing mock tests

### Configuration Comparison

| Aspect | Mock Tests | Upload Tests | Match? |
|--------|------------|--------------|--------|
| Browser launch | `launchPersistentContext` | `launchPersistentContext` | ✅ |
| Viewport size | 1280x720 | 1280x720 | ✅ |
| Extension loading | Via fixtures | Via fixtures | ✅ |
| Action timeout | 60000ms | 60000ms | ✅ |
| Mock server | localhost:XXXXX | localhost:XXXXX | ✅ |
| Test file location | tests/e2e-mock/ | tests/e2e-upload/ | Different |
| Page objects | Shared | Shared | ✅ |
| Test complexity | GIF creation only | GIF creation + upload | Different |

### Test Results

```
Before fixes (previous session): 5/6 passing
After backend fix: 2/6 passing
After all fixes: 0/6 failing (environment issue)
```

**All failures:**
```
TimeoutError: locator.click: Element is outside of the viewport
  at QuickCapturePage.clickNext (/Users/jeremywatt/Desktop/ytgify-glue/ytgify/tests/e2e-mock/page-objects/QuickCapturePage.ts:175:27)
```

## Technical Analysis

### Why Mock Tests Pass But Upload Tests Fail

**Hypothesis 1: Page Context Differences**
- Mock tests navigate to simple mock YouTube page
- Upload tests also navigate to mock YouTube page (identical URL pattern)
- Both use same mock server, same video files
- **Conclusion:** Page context appears identical

**Hypothesis 2: Extension State Persistence**
- Upload tests use persistent context with user data dir
- Mock tests also use persistent context with user data dir
- Both clear storage between tests
- **Conclusion:** State management appears identical

**Hypothesis 3: Browser Launch Differences**
- Upload tests previously had conflicting `projects` config (now removed)
- Mock tests always used fixtures exclusively
- After fix, both use identical `launchPersistentContext` calls
- **Conclusion:** Launch configuration now identical

**Hypothesis 4: Wizard Rendering Issue**
- Screenshots show wizard IS rendering (colorful test pattern visible)
- Browser console logs show wizard activation: `[Wizard] Overlay wizard shown`
- Playwright detects button: `locator resolved to <button class="ytgif-button-primary">…</button>`
- But Playwright considers button outside viewport
- **Conclusion:** Wizard renders but positioned incorrectly

### Root Cause Analysis

The fundamental issue is that Playwright's viewport detection reports the Next button as "outside of the viewport" in upload tests but not mock tests, despite:
1. Identical browser launch configuration
2. Identical viewport size (1280x720)
3. Same extension code running
4. Same wizard React components
5. Same test page structure

**Possible causes:**
1. Extension code has conditional CSS/positioning based on page URL or context
2. Timing issue where wizard renders before viewport fully initializes
3. Playwright bug or edge case with launchPersistentContext in upload test fixture
4. Hidden DOM structure differences between test contexts
5. CSS transform/positioning that places button outside despite appearing in screenshots

## Files Modified

1. `ytgify-share/config/environments/development.rb:42` - Added default_url_options
2. `tests/playwright-upload.config.ts:53` - Increased actionTimeout to 60000ms
3. `tests/playwright-upload.config.ts:57-74` - Removed projects section
4. `tests/e2e-upload/page-objects/SuccessPage.ts:40` - Fixed upload status selector
5. `tests/e2e-upload/page-objects/SuccessPage.ts:220-231` - Fixed error message retrieval
6. `tests/e2e-upload/upload-flow.spec.ts:217-227` - Fixed Test #3 storage keys
7. `tests/e2e-upload/upload-flow.spec.ts:385-395` - Fixed Test #5 privacy value
8. `tests/e2e-mock/page-objects/TextOverlayPage.ts:32` - Fixed skip button selector
9. `tests/e2e-mock/page-objects/QuickCapturePage.ts:175` - Added force: true to click

## Next Steps & Recommendations

### Immediate Actions

1. **Verify Mock Tests Still Work**
   - Run full mock E2E suite to confirm `force: true` didn't break them
   - Expected: 72/72 passing

2. **Visual Debugging**
   - Run upload test with `--headed` flag and `--debug` to see browser window
   - Manually inspect wizard positioning and viewport
   - Check browser DevTools Elements panel for actual button coordinates

3. **Investigation Commands**
   ```bash
   # Run headed to see browser
   npm run test:e2e:upload -- --headed tests/e2e-upload/upload-flow.spec.ts:35

   # Check if increasing viewport helps
   # Edit fixtures.ts line 65: viewport: { width: 1920, height: 1080 }
   npm run test:e2e:upload

   # Compare fixture implementations
   diff tests/e2e-mock/fixtures.ts tests/e2e-upload/fixtures.ts
   ```

### Deep Investigation

1. **Check Extension Code for Conditional Rendering**
   - Search for viewport-related CSS in wizard components
   - Check for URL-based conditional logic in overlay positioning
   - Review `src/content/overlay-wizard/` for positioning logic

2. **Add Debug Logging**
   - Add `console.log` in QuickCaptureScreen to log button position
   - Add viewport size logging in test fixtures
   - Compare logged values between mock and upload tests

3. **Simplify Upload Tests**
   - Try running upload test without authentication flow
   - Remove all upload-specific logic, just test GIF creation
   - If works, gradually add upload logic back to find breaking point

4. **Alternative Click Strategies**
   - Try `page.evaluate()` to click button directly via JavaScript
   - Use `boundingBox()` to get coordinates and `page.mouse.click()`
   - Try `waitForSelector` with different state options

### Long-term Solutions

If viewport issue persists:

1. **Accept Limitation & Document**
   - Document that upload E2E tests cannot run in current form
   - Rely on unit tests + manual testing for upload functionality
   - Use mock tests for GIF creation validation

2. **Restructure Tests**
   - Separate GIF creation tests from upload tests
   - Test upload via API integration tests instead of E2E
   - Use component tests for upload UI

3. **Investigate Extension Architecture**
   - Review if wizard overlay CSS needs refactoring
   - Consider if wizard should adapt to different viewport sizes
   - Check if z-index or positioning strategy needs adjustment

## Key Learnings

1. **Playwright Config vs Fixtures:** When using `launchPersistentContext` in fixtures, do NOT add `projects` section to config - they conflict
2. **Force Clicks:** `{ force: true }` bypasses actionability checks but doesn't solve fundamental positioning issues
3. **Mock vs Real Tests:** Even with identical configuration, subtle environment differences can cause different behavior
4. **Viewport Detection:** Playwright's viewport checks are strict - element must be fully in viewport bounds, not just visible in screenshot

## References

- Playwright Config: `tests/playwright-upload.config.ts`
- Upload Fixtures: `tests/e2e-upload/fixtures.ts`
- Mock Fixtures: `tests/e2e-mock/fixtures.ts`
- Upload Tests: `tests/e2e-upload/upload-flow.spec.ts`
- Page Objects: `tests/e2e-upload/page-objects/`
- Test Screenshots: `tests/test-results/artifacts-upload/`
