# E2E Testing Documentation

## Overview

Comprehensive end-to-end testing suite for the YouTube GIF Maker Chrome Extension. Tests run against real YouTube videos with the extension loaded in Chromium.

## Test Structure

```
tests/e2e/
├── wizard-complete-flow.spec.ts  # Main wizard flow tests
├── error-handling.spec.ts        # Edge cases and error scenarios
├── page-objects/                 # Page Object Models
│   ├── YouTubePage.ts
│   ├── GifWizard.ts
│   ├── QuickCapturePage.ts
│   ├── TextOverlayPage.ts
│   ├── ProcessingPage.ts
│   ├── SuccessPage.ts
│   └── FeedbackPage.ts
└── helpers/                       # Test utilities
    ├── test-videos.ts            # Curated test video list
    └── extension-helpers.ts      # Extension-specific helpers
```

## Running Tests

### Local Development

```bash
# Build extension first
npm run build

# Run all E2E tests
npm run test:e2e

# Run tests with UI (recommended for debugging)
npm run test:e2e:ui

# Run tests in headed mode (see browser)
npm run test:e2e:headed

# Debug specific test
npm run test:e2e:debug
```

### CI/CD

Tests automatically run on:
- Every pull request
- Pushes to main branch
- Manual workflow dispatch

GitHub Actions workflow includes:
- Parallel test execution (2 shards)
- Automatic retries for flaky tests
- Screenshot/video capture on failure
- Performance metrics collection
- Test report generation

## Test Coverage

### Wizard Paths Tested

1. **Complete Flow with Text**
   - Quick Capture → Add Text → Processing → Success → Download

2. **Flow without Text**
   - Quick Capture → Skip Text → Processing → Success

3. **Flow with Feedback**
   - Complete flow → Success → Feedback submission

4. **Navigation Testing**
   - Back button functionality at each step
   - Progress indicator updates
   - Close button at any stage

5. **Quality Presets**
   - Fast quality setting
   - Balanced quality setting
   - High quality setting

6. **Text Overlay Variations**
   - Different positions (top/middle/bottom)
   - Different styles (meme/subtitle/minimal)
   - Multiple overlays
   - Edit and remove overlays

### Error Scenarios

- Extension not injecting on non-YouTube pages
- Very short selections (< 1 second)
- Maximum duration limits (10 seconds)
- Empty text overlays
- Very long text handling
- Cancellation during processing
- Network interruption handling
- Rapid navigation stress testing
- Multiple overlay limits
- Video boundary handling
- Concurrent wizard prevention

## Test Videos

Using stable, public YouTube videos:

- **Very Short** (19s): "Me at the zoo" - First YouTube video
- **Medium** (213s): Rick Roll - Very stable reference
- **Long** (596s): Big Buck Bunny - Open source content

## Page Object Model

Each screen has its own page object for maintainable tests:

```typescript
// Example usage
const youtube = new YouTubePage(page);
await youtube.navigateToVideo(TEST_VIDEO.url);
await youtube.openGifWizard();

const quickCapture = new QuickCapturePage(page);
await quickCapture.setTimeRange(0, 5);
await quickCapture.selectQuality('balanced');
await quickCapture.clickNext();
```

## Debugging Failed Tests

1. **Check Screenshots**: Located in `tests/screenshots/`
2. **Check Videos**: Located in `tests/test-results/videos/`
3. **HTML Report**: Run `npx playwright show-report`
4. **Run Specific Test**: Use `--grep` flag
5. **Debug Mode**: Use `npm run test:e2e:debug`

## Best Practices

1. **Use Real Videos**: Tests run against actual YouTube videos
2. **Page Objects**: All interactions through page objects
3. **Explicit Waits**: Use proper wait conditions
4. **Cleanup**: Tests clean up after themselves
5. **Isolation**: Each test is independent
6. **Descriptive Names**: Clear test descriptions
7. **Error Screenshots**: Automatic on failure

## Performance Benchmarks

Expected timings (CI environment):
- Extension injection: < 5 seconds
- Wizard open: < 2 seconds
- GIF processing (5s video): < 30 seconds
- Complete flow: < 60 seconds

## Troubleshooting

### Common Issues

1. **Extension not loading**
   - Ensure `npm run build` completed successfully
   - Check `dist/manifest.json` exists

2. **Timeouts on YouTube**
   - YouTube might be slow to load
   - Increase timeout in config
   - Check network connectivity

3. **GIF button not appearing**
   - Extension injection might be delayed
   - Check console for errors
   - Verify extension permissions

4. **Tests flaky in CI**
   - Add retries for specific tests
   - Increase timeouts
   - Use more stable selectors

## Contributing

When adding new tests:
1. Use existing page objects
2. Follow naming conventions
3. Add to appropriate test file
4. Update this documentation
5. Ensure tests pass locally first