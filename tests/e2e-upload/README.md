# Phase 2 Upload E2E Tests

Automated end-to-end tests for the Phase 2 GIF Cloud Upload functionality.

## Overview

These tests verify the hybrid download + upload flow with real backend integration:
- ✅ Anonymous users (download only)
- ✅ Authenticated users (download + upload)
- ✅ Upload settings (enabled/disabled)
- ✅ Upload failure handling
- ✅ Privacy settings
- ✅ Token expiration

## Prerequisites

### 1. Build Extension
```bash
npm run build
```

### 2. Start Backend Server
```bash
cd ../ytgify-share
bin/dev
```

Backend must be running at `http://localhost:3000` with test database ready.

### 3. Verify Backend Health
```bash
curl http://localhost:3000/api/v1/auth/me
# Should return 401 (expected - no token)
```

## Running Tests

### Headless (Default)
```bash
npm run test:e2e:upload
```

### Headed (Visible Browser)
```bash
npm run test:e2e:upload:headed
```

### Debug Mode
```bash
npm run test:e2e:upload:debug
```

### UI Mode (Interactive)
```bash
npm run test:e2e:upload:ui
```

## Test Scenarios

### Test 1: Anonymous User
- **Purpose:** Verify download-only behavior for unauthenticated users
- **Expected:** GIF downloads to folder, no upload UI visible
- **Duration:** ~30s

### Test 2: Authenticated User (Success)
- **Purpose:** Verify full upload flow for authenticated users
- **Expected:** GIF downloads + uploads to backend, status shows "success"
- **Duration:** ~60s

### Test 3: Upload Disabled
- **Purpose:** Verify upload can be disabled in settings
- **Expected:** GIF downloads only, upload status shows "disabled"
- **Duration:** ~60s

### Test 4: Upload Failure
- **Purpose:** Verify error handling when backend returns error
- **Expected:** GIF downloads, upload status shows "failed", error message visible
- **Duration:** ~60s

### Test 5: Privacy Settings
- **Purpose:** Verify privacy setting is sent to backend
- **Expected:** GIF uploads with correct privacy level
- **Duration:** ~60s

### Test 6: Token Expiration
- **Purpose:** Verify auth error handling
- **Expected:** GIF downloads, upload fails with auth error
- **Duration:** ~60s

## Test Architecture

```
tests/e2e-upload/
├── fixtures.ts                    # Playwright fixtures (extension + backend)
├── global-setup.ts                # Backend health check
├── global-teardown.ts             # Cleanup
├── upload-flow.spec.ts            # Main test file (6 scenarios)
├── page-objects/
│   └── SuccessPage.ts             # Extended with upload status methods
└── helpers/                       # (reuses e2e-auth helpers)
    ├── backend-client.ts          # API client for backend
    └── storage-helpers.ts         # Chrome storage utilities
```

## Debugging

### View Test Reports
```bash
npx playwright show-report test-results/html-upload
```

### Check Console Logs
Tests log detailed output with `[Test]` prefix:
```
[Test] Starting authenticated user test...
[Test] Test user: test-upload-123@example.com
[Test] ✓ Login successful
[Test] Waiting for upload to start...
[Test] Upload started: true
[Test] Waiting for upload to complete...
✅ [Test] Authenticated user test passed - upload successful
```

### Common Issues

**Backend not running:**
```
Error: Backend not accessible. Start Rails server before running tests.
```
Solution: Start backend with `cd ../ytgify-share && bin/dev`

**Extension not built:**
```
Error: Failed to load extension from: .../dist
```
Solution: Run `npm run build`

**Test timeout:**
- Increase timeout in `playwright-upload.config.ts`
- Check backend is responding quickly
- Verify YouTube video is accessible

## Implementation Details

### Upload Status Flow
1. GIF created → status: `uploading`
2. API request sent → status: `uploading` (spinner visible)
3. Response received:
   - Success → status: `success` (green badge)
   - Failure → status: `failed` (red badge + error message)
   - Disabled → status: `disabled` (gray badge)

### Assertions
- `success.getUploadStatus()` - Returns current status
- `success.waitForUploadComplete(timeout)` - Waits for success/failure
- `success.getUploadErrorMessage()` - Gets error text if failed
- `success.verifyUploadStatus(expected)` - Asserts exact status

### Backend Integration
Tests use `BackendClient` from Phase 1 auth tests:
- `backend.ensureTestUser(user)` - Creates test user if needed
- `backend.login(email, password)` - Returns JWT token
- `backend.verifyToken(token)` - Checks token validity

## CI/CD Notes

**Not suitable for CI:** These tests use real YouTube videos, which may be blocked by YouTube in CI environments.

**For CI:** Use mock E2E tests instead: `npm run test:e2e:mock`

**Manual Testing Required:** Run these tests locally before deploying Phase 2 to production.

## Coverage

Phase 2 upload functionality is tested at three levels:

1. **Unit Tests** (`tests/unit/lib/api/api-client.test.ts`)
   - API client methods
   - FormData handling
   - Error cases

2. **Integration Tests** (these E2E tests)
   - Full upload flow
   - UI status updates
   - Backend integration

3. **Manual Testing** (when needed)
   - Browser-specific behavior
   - Network conditions
   - Edge cases

## Next Steps

After Phase 2 implementation complete:
- Run full test suite: `npm run test && npm run test:e2e:mock && npm run test:e2e:upload`
- Update PHASE2_PROGRESS.md with test results
- Deploy to production
