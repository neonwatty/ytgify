# Token Refresh Debug Test

This test is designed to debug and verify the JWT token refresh functionality when tokens expire during GIF upload operations.

## Problem Being Debugged

Users reported seeing console errors like:
```
[ApiClient] Token expired, attempting refresh...
[updateTimelineOverlay] isWizardMode: true
```

The token refresh appears to be triggered but uploads still fail, suggesting the refresh is not completing successfully or the new token is not being saved.

## What This Test Does

The test creates two scenarios:

### Scenario 1: Upload with Expired Token
1. **Login** - User registers/logs in to get initial valid token
2. **Manually Expire Token** - Sets `expiresAt` to 1 minute in the past
3. **Create GIF** - User creates a GIF on YouTube
4. **Upload** - Attempts to upload with expired token
5. **Verify Refresh** - Checks console logs for:
   - `"Token expired, attempting refresh..."`
   - `"Token refreshed successfully"`
   - `"GIF uploaded successfully"`
6. **Verify State** - Confirms new token is saved and different from original

### Scenario 2: Proactive Refresh (Token Expiring Soon)
1. **Login** - Get initial token
2. **Set Near Expiry** - Sets token to expire in 3 minutes
3. **Upload** - Should trigger proactive refresh (5-min threshold)
4. **Verify** - Checks for proactive refresh log message

## Prerequisites

1. **Rails Backend Running**
   ```bash
   cd ../ytgify-share
   bin/rails server
   ```

2. **Extension Built**
   ```bash
   npm run build
   ```

## Running the Test

### Headed Mode (Recommended for Debugging)
```bash
npm run test:e2e:upload:headed -- tests/e2e-upload/token-refresh-debug.spec.ts
```

This will:
- Open a visible browser window
- Show all console logs in terminal
- Let you see exactly what's happening

### Debug Mode (Step Through)
```bash
npm run test:e2e:upload:debug -- tests/e2e-upload/token-refresh-debug.spec.ts
```

This will:
- Open Playwright Inspector
- Let you step through each action
- Inspect state at each step

### Headless Mode
```bash
npm run test:e2e:upload -- tests/e2e-upload/token-refresh-debug.spec.ts
```

### Run Specific Scenario
```bash
# Only expired token scenario
npm run test:e2e:upload:headed -- tests/e2e-upload/token-refresh-debug.spec.ts -g "expired token"

# Only proactive refresh scenario
npm run test:e2e:upload:headed -- tests/e2e-upload/token-refresh-debug.spec.ts -g "expiring soon"
```

## What to Look For

### Console Output

The test will print detailed logs like:
```
[Test] Step 1: Login to get initial token
[Test] ✅ Initial token received
[Test] Token expires at: 2025-11-22T15:30:00.000Z

[Test] Step 4: Manually expire token
[Test] ✅ Token expired (expiresAt in past)

[Test] Step 7: Upload GIF with expired token
[Test] 🔍 This should trigger automatic token refresh...

[Console log] [ApiClient] Token expired, attempting refresh...
[Console log] [ApiClient] ✅ Token refreshed successfully
[Console log] [ApiClient] ✅ GIF uploaded successfully

[Test] Log Analysis:
  - Token expired detected: ✅
  - Token refresh success: ✅
  - Upload success: ✅

[Test] Final token: eyJhbGciOiJIUzI1NiI...
[Test] Token is valid: ✅
[Test] ✅ Upload confirmed successful
```

### If Test Fails

Look for:
1. **Missing refresh attempt** - "Token expired, attempting refresh..." not logged
2. **Refresh fails** - "Token refresh failed" error
3. **Token not saved** - Final token same as initial token
4. **Upload fails** - No "Uploaded successfully" message

## Debugging Tips

### Capture Full Console Logs
```bash
npm run test:e2e:upload:headed -- tests/e2e-upload/token-refresh-debug.spec.ts 2>&1 | tee token-refresh-debug.log
```

### Check Auth State Manually
Add breakpoints in test:
```typescript
const authState = await getAuthState(context);
console.log('Current auth state:', JSON.stringify(authState, null, 2));
debugger; // If running in debug mode
```

### Monitor Network Requests
The test runs in headed mode, so you can:
1. Open Chrome DevTools (F12)
2. Go to Network tab
3. Watch for `/api/v1/auth/refresh` request
4. Check request/response details

### Common Issues

**Issue: "No auth state to expire"**
- Login failed or popup didn't open
- Check backend is running on `http://localhost:3000`

**Issue: Test times out on YouTube**
- YouTube video URL may be unavailable
- Try different video or check internet connection

**Issue: Token refresh logs but upload still fails**
- This is the bug we're debugging!
- Check if new token is actually being saved
- Look at `[ApiClient] ⚠️ Auth state cleared during refresh` warning

## Expected Behavior (When Working)

1. **Expired token detected** ✅
2. **Refresh endpoint called** (`POST /api/v1/auth/refresh`)
3. **New token received** (different JWT)
4. **New token saved** to `chrome.storage.local`
5. **Upload retried** with new token
6. **Upload succeeds** ✅

## What the Fixes Changed

### Before Fix
```typescript
// refreshToken() in api-client.ts
const authState = await StorageAdapter.getAuthState();
if (authState) {
  authState.token = data.token;
  await StorageAdapter.saveAuthState(authState);
}
// ❌ If authState is null, new token is NEVER SAVED
```

### After Fix
```typescript
let authState = await StorageAdapter.getAuthState();
if (!authState) {
  console.warn('[ApiClient] ⚠️ Auth state cleared during refresh, recreating...');
  authState = {
    token: data.token,
    expiresAt: decoded.exp * 1000,
    userId: decoded.sub,
    userProfile: null,
  };
}
await StorageAdapter.saveAuthState(authState);
// ✅ Token ALWAYS saved, even if state was cleared
```

## Files Being Tested

- `src/lib/api/api-client.ts` - Token refresh logic
- `src/lib/storage/storage-adapter.ts` - Auth state storage
- `src/content/gif-processor.ts` - Upload flow

## Test Configuration

Uses `tests/playwright-upload.config.ts`:
- Timeout: 120 seconds per test
- Retries: 0 (we want to see failures)
- Extension loaded from `dist/`
- Backend URL: `http://localhost:3000`

## Next Steps

If this test reveals the bug:
1. Check console logs for the exact failure point
2. Add additional logging in `api-client.ts` if needed
3. Verify auth state is being saved correctly
4. Check for race conditions between content script and background worker

## Related Files

- Implementation: `src/lib/api/api-client.ts`
- Test: `tests/e2e-upload/token-refresh-debug.spec.ts`
- Config: `tests/playwright-upload.config.ts`
- Documentation: This file
