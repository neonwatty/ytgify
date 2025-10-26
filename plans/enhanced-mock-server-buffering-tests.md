# Enhanced Mock Server for Buffering Edge Case Tests

## Problem Statement

### Current Test Coverage Gap

**What Works**:
- ✅ Slow network success path (mock E2E with network throttling)
- ✅ Adaptive duplicate threshold (mock E2E)
- ✅ Buffer verification unit logic (unit tests)

**What Doesn't Work in E2E**:
- ❌ Geo-block detection (readyState stuck at 0)
- ❌ Buffer stuck detection (buffer doesn't progress)
- ❌ Total wait budget timeout (120s limit)

### Why Property Mocking Failed

**Approach Tried**:
```javascript
// Override video element properties
Object.defineProperty(video, 'readyState', {
  get: () => 0  // Always return HAVE_NOTHING
});

Object.defineProperty(video, 'buffered', {
  get: () => ({
    length: 1,
    start: (i) => 0,
    end: (i) => 2  // Buffer stuck at 2 seconds
  })
});
```

**Why It Failed**:
- Property overrides work for synchronous JavaScript reads
- Video element's internal state (managed by browser's C++ media pipeline) bypasses JavaScript property getters
- Real buffering/decoding continues in background
- Next property read returns real browser-managed value, not mocked value
- Async video operations don't respect JavaScript-layer mocks

### Root Cause
Can't simulate real buffering behavior by mocking DOM properties. Need to control actual network responses and video file delivery.

---

## Solution Architecture

### Core Idea
**Enhance mock server to simulate real buffering failures** by controlling HTTP response behavior, not DOM properties.

### Current Mock Server Stack
- **Framework**: Express.js
- **Files**: Synthetic WebM videos (test-medium-10s.webm, etc.)
- **Network**: Playwright CDP throttling (slow3G, verySlow profiles)
- **Location**: `tests/mock-server/`

### Proposed Enhancements

Add specialized routes that simulate edge cases through HTTP-level behavior:

1. **Geo-blocked route** → Returns 403 or hangs request
2. **Partial buffer route** → Sends partial file, then stops indefinitely
3. **Very slow route** → Drip-feeds bytes at 1KB/5s to trigger timeout

---

## Implementation Details

### 1. Geo-Block / Network Failure Simulation

**Route**: `/videos/geo-blocked.webm`

**Server Implementation**:
```javascript
// tests/mock-server/server.js

app.get('/videos/geo-blocked.webm', (req, res) => {
  // Option A: Return 403 Forbidden
  res.status(403).send('Video not available in your region');

  // Option B: Hang request indefinitely (simulates timeout)
  // req.setTimeout(0);
  // Don't send any response - connection stays open forever
});
```

**Expected Behavior**:
- Video element never loads data
- `readyState` stays at 0 or 1 (HAVE_NOTHING / HAVE_METADATA)
- Our detection logic: After 1s stuck at readyState < 2, abort with error

**Test Specification**:
```javascript
test('Detect geo-restriction via blocked video request', async ({ page, mockServerUrl }) => {
  const videoUrl = getMockVideoUrl('geo-blocked', mockServerUrl);
  await page.goto(videoUrl);

  // Try to create GIF
  await page.click('.ytgif-button');
  await page.click('.ytgif-button-primary');
  await page.click('button:has-text("Skip")');

  // Wait for error detection (should abort within 3-5 seconds)
  await page.waitForTimeout(5000);

  const errorState = await page.evaluate(() => ({
    hasError: !!document.querySelector('.ytgif-error-message'),
    errorText: document.querySelector('.ytgif-error-message')?.textContent || ''
  }));

  expect(errorState.hasError).toBe(true);
  expect(errorState.errorText.toLowerCase()).toContain('loading');
  expect(errorState.errorText.toLowerCase()).toContain('network');
});
```

**Estimated Time**: 30 minutes

---

### 2. Buffer Stuck Simulation

**Route**: `/videos/buffer-stuck.webm`

**Server Implementation**:
```javascript
app.get('/videos/buffer-stuck.webm', (req, res) => {
  const filePath = path.join(__dirname, '../videos/test-medium-10s.webm');
  const stream = fs.createReadStream(filePath);

  // Set correct content type
  res.setHeader('Content-Type', 'video/webm');

  // Don't set Content-Length - allows partial response
  let bytesSent = 0;
  const BUFFER_LIMIT = 2_000_000; // Send 2MB then stop (~2 seconds of video)

  stream.on('data', (chunk) => {
    bytesSent += chunk.length;

    if (bytesSent > BUFFER_LIMIT) {
      console.log(`[Mock Server] Buffer stuck at ${BUFFER_LIMIT} bytes, stopping stream`);
      stream.destroy(); // Stop reading file
      // Don't end response - connection stays open, client keeps waiting
      return;
    }

    res.write(chunk);
  });

  stream.on('error', (err) => {
    console.error('[Mock Server] Stream error:', err);
    res.end();
  });

  // Don't attach 'end' listener - prevents auto-closing response
});
```

**Expected Behavior**:
- Video buffers first ~2 seconds
- `video.buffered.end(0)` stops at ~2.0s
- Attempting to seek to 5s+ → buffer doesn't contain target time
- Our detection logic: After 500ms with buffer not progressing toward target, abort

**Test Specification**:
```javascript
test('Detect buffer stuck at partial position', async ({ page, mockServerUrl }) => {
  const videoUrl = getMockVideoUrl('buffer-stuck', mockServerUrl);
  await page.goto(videoUrl);

  await page.waitForSelector('video');

  // Wait for partial buffer to load
  await page.waitForTimeout(3000);

  // Seek to position beyond buffer (5 seconds)
  await page.evaluate(() => {
    const video = document.querySelector('video');
    video.currentTime = 5;
  });

  await page.click('.ytgif-button');
  await page.click('.ytgif-button-primary');
  await page.click('button:has-text("Skip")');

  // Wait for buffer stuck detection
  await page.waitForTimeout(3000);

  const errorState = await page.evaluate(() => ({
    hasError: !!document.querySelector('.ytgif-error-message'),
    errorText: document.querySelector('.ytgif-error-message')?.textContent || ''
  }));

  expect(errorState.hasError).toBe(true);
  expect(errorState.errorText.toLowerCase()).toMatch(/buffer|stuck/);
});
```

**Estimated Time**: 1 hour (requires WebM format validation)

---

### 3. Total Wait Time Budget Timeout

**Route**: `/videos/extremely-slow.webm`

**Server Implementation**:
```javascript
app.get('/videos/extremely-slow.webm', async (req, res) => {
  const filePath = path.join(__dirname, '../videos/test-medium-10s.webm');
  const file = fs.readFileSync(filePath);

  res.setHeader('Content-Type', 'video/webm');

  console.log('[Mock Server] Starting extremely slow video delivery (1KB per 5s)');

  const CHUNK_SIZE = 1024; // 1KB chunks
  const DELAY_MS = 5000; // 5 second delay between chunks

  for (let offset = 0; offset < file.length; offset += CHUNK_SIZE) {
    const chunk = file.slice(offset, offset + CHUNK_SIZE);
    res.write(chunk);

    if (offset + CHUNK_SIZE < file.length) {
      await new Promise(resolve => setTimeout(resolve, DELAY_MS));
    }
  }

  res.end();
  console.log('[Mock Server] Extremely slow video delivery complete');
});
```

**Expected Behavior**:
- Each frame capture waits 3-5 seconds for buffering
- Total wait time accumulates: 10 frames × 4s = 40s, 30 frames × 4s = 120s
- Our detection logic: After 120s total wait across all frames, abort

**Alternative**: Use larger file or slower rate
```javascript
// For 10s video at 10fps = 100 frames
// To trigger 120s timeout: need 100 frames × 1.5s/frame average
// Use: 1KB per 2s delay
const DELAY_MS = 2000; // Triggers timeout around frame 60-80
```

**Test Specification**:
```javascript
test('Enforce total wait time budget with extremely slow buffering', async ({ page, mockServerUrl }) => {
  test.setTimeout(180000); // 3 minutes

  const videoUrl = getMockVideoUrl('extremely-slow', mockServerUrl);
  await page.goto(videoUrl);

  await page.waitForSelector('video');

  // Set parameters designed to hit timeout:
  // - 10 second clip at 10fps = 100 frames
  // - Server delivers 1KB per 2s
  // - Each frame waits ~1-2s
  // - Should hit 120s budget around frame 60-80

  await page.click('.ytgif-button');
  await page.click('.ytgif-button-primary');

  // Set 10fps, 10s duration
  await page.selectOption('select[name="fps"]', '10');
  const durationInput = await page.$('input[placeholder*="duration"]');
  await durationInput?.fill('10');

  await page.click('.ytgif-button-primary');
  await page.click('button:has-text("Skip")');

  // Wait for timeout to trigger (120s budget + detection overhead)
  await page.waitForTimeout(150000); // 2.5 minutes

  const errorState = await page.evaluate(() => ({
    hasError: !!document.querySelector('.ytgif-error-message'),
    errorText: document.querySelector('.ytgif-error-message')?.textContent || '',
    stillProcessing: !!document.querySelector('.ytgif-processing-screen')
  }));

  expect(errorState.stillProcessing).toBe(false);
  expect(errorState.hasError).toBe(true);
  expect(errorState.errorText.toLowerCase()).toMatch(/too long|timeout|120/);
});
```

**Estimated Time**: 1.5 hours (including timeout tuning)

---

## Technical Considerations

### WebM Format Requirements

**Concern**: Can browsers play partially-delivered WebM files?

**Research Needed**:
- WebM uses Matroska container format
- Headers/metadata at file start
- May need minimum bytes for valid playback
- Test: Does `buffer-stuck` route allow first 2s to play?

**Mitigation**:
- Ensure first 2-3MB includes full headers + initial frames
- Use `ffprobe` to find exact byte offset for 2s mark
- Alternative: Generate custom short WebM files

### CI Runtime Impact

**Current Mock Tests**: ~1.2 minutes (2 tests)

**With New Tests**:
- Geo-block test: +5 seconds
- Buffer stuck test: +10 seconds
- Timeout test: +150 seconds (2.5 minutes)

**Total**: ~3.5 minutes for slow buffering suite

**Mitigation**:
- Run timeout test separately (`test.slow()` marker)
- Use shorter timeout threshold for test (60s instead of 120s)
- Mark as optional in CI, required in local pre-push

### Mock Server Lifecycle

**Current**: Global setup starts server, teardown stops it

**Enhancement Needed**:
```javascript
// tests/mock-server/routes.js

function registerBufferingRoutes(app) {
  app.get('/videos/geo-blocked.webm', handleGeoBlocked);
  app.get('/videos/buffer-stuck.webm', handleBufferStuck);
  app.get('/videos/extremely-slow.webm', handleExtremelySlow);
}

module.exports = { registerBufferingRoutes };
```

**Estimated Time**: 30 minutes

---

## Comparison: Unit Tests vs. E2E Tests

### Current Approach (Unit Tests)

**Pros**:
- Fast (<1 second per test)
- Reliable, no flakiness
- Easy to debug
- Tests logic in isolation

**Cons**:
- Doesn't test real video element behavior
- Doesn't validate UI error messages
- Doesn't test full integration path
- Requires manual validation for confidence

**Coverage**:
- ✅ `waitForVideoReady()` logic
- ✅ Buffer verification conditions
- ✅ Timeout calculations
- ❌ DOM integration
- ❌ User-facing error messages
- ❌ Full extraction pipeline

### Proposed Approach (Enhanced Mock E2E)

**Pros**:
- Tests real video element behavior
- Validates actual error messages shown to user
- Full integration coverage (extraction → error → UI)
- CI-safe (no real YouTube needed)
- Reproducible across environments

**Cons**:
- Slower (3.5 minutes total)
- More complex server implementation
- Potential flakiness with timing
- Requires WebM format knowledge

**Coverage**:
- ✅ Real video buffering behavior
- ✅ DOM integration
- ✅ User-facing error messages
- ✅ Full extraction pipeline
- ✅ Exact error scenarios user would encounter

---

## Implementation Plan

### Phase 1: Infrastructure (1 hour)
1. Create `tests/mock-server/routes/buffering-edge-cases.js`
2. Add route registration to main server
3. Add mock video URL helper: `getMockVideoUrl('geo-blocked', ...)`
4. Test routes manually with curl/browser

### Phase 2: Geo-Block Test (30 min)
1. Implement geo-blocked route (403 response)
2. Write E2E test
3. Verify error detection and message
4. Document in TESTING_SLOW_BUFFERING.md

### Phase 3: Buffer Stuck Test (1.5 hours)
1. Research WebM byte offsets for 2s mark
2. Implement partial delivery route
3. Write E2E test with seek
4. Debug timing issues
5. Verify buffer stuck detection

### Phase 4: Timeout Test (2 hours)
1. Implement drip-feed route
2. Tune delay rate to trigger 120s budget reliably
3. Write E2E test with long timeout
4. Add `test.slow()` marker
5. Verify timeout enforcement

### Phase 5: Integration (30 min)
1. Update TESTING_SLOW_BUFFERING.md
2. Update SLOW_BUFFERING_FIX_SUMMARY.md
3. Add to CI pipeline (with timeout test optional)
4. Document in README

**Total Estimated Time**: 5.5 hours

---

## Success Criteria

### Functional
- ✅ All 3 new tests pass consistently (5 runs without flake)
- ✅ Tests complete within timeout limits
- ✅ Error messages match expectations
- ✅ Mock server routes work in CI environment

### Quality
- ✅ No false positives (tests don't fail on valid scenarios)
- ✅ No false negatives (tests catch real issues)
- ✅ Tests fail quickly when logic is broken (don't wait full timeout)
- ✅ Clear console logs for debugging failures

### Documentation
- ✅ TESTING_SLOW_BUFFERING.md updated with new tests
- ✅ Mock server routes documented with comments
- ✅ README explains how to run buffering tests
- ✅ CI configuration documented

---

## Alternative: Hybrid Approach

**Recommendation**: Implement geo-block + buffer stuck E2E tests, **skip timeout test**

**Rationale**:
- Geo-block test: Fast (5s), high value, easy to implement
- Buffer stuck test: Medium (10s), high value, moderate complexity
- Timeout test: Slow (150s), medium value, high complexity

**Coverage with Hybrid**:
- E2E: Geo-block, buffer stuck
- Unit: Timeout logic
- Manual: User scenario validation

**Effort**: 3 hours instead of 5.5 hours

---

## Files to Modify/Create

### New Files
- `tests/mock-server/routes/buffering-edge-cases.js` - Route implementations
- `tests/mock-server/utils/stream-helpers.js` - Partial delivery helpers

### Modified Files
- `tests/mock-server/server.js` - Register new routes
- `tests/e2e-mock/helpers/mock-videos.ts` - Add new video types
- `tests/e2e-mock/slow-buffering.spec.ts` - Add 2-3 new tests
- `TESTING_SLOW_BUFFERING.md` - Document new tests
- `SLOW_BUFFERING_FIX_SUMMARY.md` - Update coverage section

---

## Risk Assessment

### Low Risk ✅
- Geo-block test: Simple HTTP 403, unlikely to break

### Medium Risk ⚠️
- Buffer stuck test: Depends on WebM format, may need iteration

### High Risk ⚠️
- Timeout test: Long runtime, timing-sensitive, could be flaky

**Mitigation**:
- Start with geo-block test to validate approach
- Prototype buffer stuck route locally before full test
- Consider skipping timeout test in favor of unit tests

---

## Next Steps

1. **Validate approach**: Test partial WebM delivery manually
2. **Prototype**: Implement geo-block route + test (1 hour)
3. **Evaluate**: If successful, proceed with buffer stuck
4. **Decision point**: Ship with 2 E2E tests + unit test for timeout, or continue to full implementation

---

## References

- Current implementation: `src/lib/simple-frame-extractor.ts:46-130`
- Existing mock server: `tests/mock-server/server.js`
- Network profiles: `tests/e2e-mock/helpers/network-profiles.ts`
- WebM spec: https://www.webmproject.org/docs/container/
- Playwright CDP: https://playwright.dev/docs/api/class-cdpsession
