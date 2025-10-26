# WXT Migration E2E Test Blocker

**Status**: BLOCKED
**Date**: 2025-10-26
**Issue**: Mock E2E tests failing after WXT migration - content script not loading

## Problem Summary

After migrating from standard Chrome extension build to WXT framework, all mock E2E tests fail with timeout waiting for GIF button. Content script never initializes in Playwright test environment despite:
- Extension service worker loading successfully (ID visible in logs)
- Content script properly compiled and referenced in manifest
- WXT runtime wrapper code present in compiled output

## Attempted Fixes (All Unsuccessful)

1. **CSS Injection Mode**: Changed `cssInjectionMode` from 'ui' to 'manifest'
   - Result: No effect

2. **Missing Import**: Added explicit `defineContentScript` import from 'wxt/sandbox'
   - Result: No effect

3. **Unsafe Browser API**: Removed `browser.runtime.id` from initialization console.log
   - Result: No effect

4. **Window API Timing**: Moved `window.location.hostname` check from class property to constructor
   - Result: No effect

## Key Observations

- Pre-WXT tests worked fine with same Playwright configuration
- Extension uses `launchPersistentContext` (correct for extensions)
- No console.log output from content script appears in test
- Service worker logs appear normally
- Content script `main()` function never executes

## Files Modified

- `src/entrypoints/content/index.ts`: Added import, changed CSS mode, removed browser.runtime.id
- `src/entrypoints/content/gif-maker.ts`: Moved window.location check to constructor
- `wxt.config.ts`: Removed localhost from host_permissions (may need revert)
- `tests/e2e-mock/fixtures.ts`: Added button visibility and permission grant attempts

## Hypothesis

WXT's content script initialization may be incompatible with Playwright's extension loading mechanism. The compiled code contains proper WXT wrapper, but something prevents execution in test environment that didn't affect pre-WXT build.

## Next Steps

1. Compare pre-WXT vs post-WXT manifest.json structure
2. Check if WXT has specific Playwright testing requirements
3. Consider temporary WXT revert to unblock E2E tests
4. Investigate headed browser test with manual inspection
5. Check WXT GitHub issues for similar Playwright problems

## Relevant Links

- WXT E2E Testing: https://wxt.dev/guide/essentials/e2e-testing
- WXT Content Scripts: https://wxt.dev/guide/essentials/content-scripts.html
- Playwright Chrome Extensions: https://playwright.dev/docs/chrome-extensions
