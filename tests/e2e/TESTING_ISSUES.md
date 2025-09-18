# E2E Testing Issues and Solutions

## Current Problem

The E2E tests are failing because the Chrome extension's content script is not injecting the GIF button into YouTube pages during Playwright tests, even though:

1. ✅ Extension loads successfully (service worker is active)
2. ✅ Extension ID is available
3. ❌ Content script doesn't inject the GIF button
4. ❌ No console logs from content script appear

## Root Cause

The tests are using standard Playwright Chrome browser, but Chrome extensions require special handling:

1. **Persistent Context Required**: Extensions need `chromium.launchPersistentContext()` not regular browser contexts
2. **User Data Directory**: Extensions work better with a persistent user data directory
3. **Timing Issues**: Content scripts may take time to initialize after page load
4. **Manifest V3 Issues**: Service workers and content scripts have different lifecycle in tests

## Solutions to Implement

### 1. Fix Test Infrastructure (Recommended)

Update all test files to use the custom fixtures approach:

```typescript
// Use custom fixtures for all tests
import { test, expect } from './fixtures';

// NOT the default Playwright test
// import { test, expect } from '@playwright/test';
```

### 2. Add Proper Waits

Content scripts need time to inject after YouTube loads:

```typescript
// Wait for YouTube player
await page.waitForSelector('video');

// Wait for content script to inject button
await page.waitForSelector('.ytgif-button', {
  timeout: 30000,
  state: 'visible'
});
```

### 3. Alternative: Manual Testing Mode

For development, you can test the extension manually:

```bash
# Start Chrome with extension loaded
npm run build
open -a "Google Chrome" --args \
  --load-extension=$(pwd)/dist \
  --user-data-dir=/tmp/chrome-test
```

Then run simplified Playwright tests that attach to the existing browser.

### 4. Mock Testing Approach

Instead of testing the full extension integration, test components in isolation:

- Test wizard components with React Testing Library
- Test message passing with mock Chrome API
- Test GIF encoding with unit tests
- Use Playwright only for basic YouTube page interactions

## Temporary Workaround

Until the infrastructure is fixed, you can:

1. **Run a subset of tests** that don't require the button:
   ```bash
   npm run test:e2e -- --grep "validation|output"
   ```

2. **Test manually** with the extension loaded in a real browser

3. **Focus on unit tests** for core functionality:
   ```bash
   npm run test
   ```

## Required Changes for Full E2E Testing

1. **Update all test files** to import from `./fixtures`
2. **Update Playwright config** to use persistent context by default
3. **Add retry logic** for button injection
4. **Implement better logging** in content script for debugging
5. **Consider using Puppeteer** which has better Chrome extension support

## Test Categories That Work

Even without the GIF button, these tests can work:

1. **GIF Validation Tests**: Test the encoding/validation logic directly
2. **Component Tests**: Test React components in isolation
3. **API Tests**: Test message passing and background worker
4. **Performance Tests**: Benchmark encoding algorithms

## Next Steps

1. Fix the test infrastructure to properly load extensions
2. Add debug logging to content script initialization
3. Implement retry logic for dynamic content injection
4. Consider splitting tests into integration vs unit categories

## Known Working Configuration

If you need to get tests working immediately:

1. Use Puppeteer instead of Playwright (better extension support)
2. Use Selenium with ChromeDriver (native extension support)
3. Use Chrome DevTools Protocol directly
4. Run tests in headed mode with manual intervention points