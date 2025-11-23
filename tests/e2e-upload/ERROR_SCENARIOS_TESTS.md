# Error Scenarios & Edge Cases E2E Tests

## Overview

Comprehensive E2E tests for error handling, edge cases, and resilience testing of Phase 3 social features.

## Test File

`tests/e2e-upload/error-scenarios.spec.ts`

## Tests Included

### Test 1: Backend Unavailable During Login

**Coverage:** Network failure handling

**Flow:**
1. Open popup
2. Click Sign In
3. Submit login with unreachable backend
4. Verify error handling (form remains visible)

**Assertions:**
- ✓ Login form still visible after network error
- ✓ Error handled gracefully (no crash)

### Test 2: Empty State - No Trending GIFs

**Coverage:** Empty state handling

**Flow:**
1. Browse trending without login
2. Backend returns empty array

**Assertions:**
- ✓ Trending view opens successfully
- ✓ Empty state message displayed
- ✓ UI doesn't crash on empty data

### Test 3: Empty State - User Has No GIFs

**Coverage:** Empty My GIFs tab

**Flow:**
1. Login with new user (no uploads)
2. Navigate to My GIFs tab
3. Verify empty state

**Assertions:**
- ✓ My GIFs tab loads
- ✓ Empty state handled gracefully
- ✓ Prompts user to create GIF

### Test 4: Invalid Credentials

**Coverage:** Authentication error handling

**Flow:**
1. Submit login with wrong email/password
2. Backend returns 401 Unauthorized

**Assertions:**
- ✓ Login form remains visible
- ✓ Error message displayed
- ✓ User can retry login

### Test 5: GIF Upload Failure

**Coverage:** Upload retry mechanism

**Note:** Requires backend mocking for full simulation

**Assertions:**
- ✓ Retry functionality available

### Test 6: Like Button - Unauthenticated User

**Coverage:** Authorization error handling

**Flow:**
1. Browse trending as anonymous user
2. Click like button
3. Backend returns 401 Unauthorized

**Assertions:**
- ✓ Anonymous like attempt handled
- ✓ Shows login prompt or error

### Test 7: Concurrent Operations

**Coverage:** Multi-instance sync

**Flow:**
1. Open two popup instances
2. Login in first popup
3. Reload second popup

**Assertions:**
- ✓ Two popups don't conflict
- ✓ Login state syncs across instances

### Test 8: Long Running Operations

**Coverage:** Loading states and timeouts

**Flow:**
1. Trigger API call (Browse Trending)
2. Verify loading indicator appears
3. Wait for completion

**Assertions:**
- ✓ Loading state displayed
- ✓ Operation completes successfully
- ✓ Timeout handled if API slow

## Running Tests

### All Error Scenario Tests
```bash
npm run test:e2e:upload tests/e2e-upload/error-scenarios.spec.ts
```

### Specific Test
```bash
npm run test:e2e:upload tests/e2e-upload/error-scenarios.spec.ts -g "Backend unavailable"
```

### Headed Mode
```bash
npm run test:e2e:upload -- --headed tests/e2e-upload/error-scenarios.spec.ts
```

## Prerequisites

Same as social features tests:
- Backend running at `http://localhost:3000`
- Extension built (`npm run build`)

## Test Coverage

### Error Categories

1. **Network Errors**
   - Backend unavailable
   - Timeout
   - Connection refused

2. **Authentication Errors**
   - Invalid credentials
   - Token expiration (future)
   - Unauthorized actions

3. **Empty States**
   - No trending GIFs
   - No user GIFs
   - Empty search results (future)

4. **Concurrent Operations**
   - Multiple popup instances
   - Shared storage state
   - Race conditions

5. **Loading States**
   - API call in progress
   - Long operations
   - Timeout handling

## Known Limitations

### Backend Mocking

Some tests require backend to be unavailable/slow, which is hard to simulate:

**Workaround:**
- Test 1 (Backend unavailable): Uses invalid port (9999)
- Test 5 (Upload failure): Placeholder for future backend mocking
- Test 8 (Timeout): Relies on normal API speed

**Future Enhancement:**
Implement mock server with:
- Configurable delays
- Error injection
- Status code override

### Edge Cases Not Yet Tested

1. **Token Expiration Mid-Session**
   - Requires time manipulation or backend mock
   - Should redirect to login with message

2. **Pagination Edge Cases**
   - Load more when at end of list
   - Duplicate items handling
   - Concurrent page loads

3. **File Upload Edge Cases**
   - File too large
   - Invalid file format
   - Upload interrupted

4. **Rate Limiting**
   - Too many requests
   - Backend returns 429
   - Exponential backoff

## Debugging Tips

### Test Failing?

1. **Check backend logs:**
   ```bash
   cd ../ytgify-share
   tail -f log/development.log
   ```

2. **Run in headed mode:**
   ```bash
   npm run test:e2e:upload -- --headed tests/e2e-upload/error-scenarios.spec.ts
   ```

3. **Check console for React errors:**
   - DevTools opens automatically in headed mode
   - Look for API errors, state management issues

4. **Verify backend is running:**
   ```bash
   curl http://localhost:3000/api/v1/feed/trending
   ```

## Integration with CI

**Note:** These tests require real backend running

**Recommendation:**
- Run locally before PR
- Add to pre-push hook
- Consider docker-compose for CI environment

## Future Enhancements

### Additional Error Scenarios

- [ ] Test token refresh flow
- [ ] Test rate limiting (429 responses)
- [ ] Test large file upload errors
- [ ] Test network interruption during upload
- [ ] Test CORS errors
- [ ] Test malformed API responses
- [ ] Test XSS prevention
- [ ] Test SQL injection prevention (backend)

### Edge Cases

- [ ] Test pagination boundaries
- [ ] Test rapid clicking (debouncing)
- [ ] Test browser back/forward buttons
- [ ] Test extension update while open
- [ ] Test storage quota exceeded
- [ ] Test offline mode

### Performance Testing

- [ ] Load 100+ GIFs in trending
- [ ] Measure initial load time
- [ ] Measure API response times
- [ ] Test memory leaks (long session)
- [ ] Test bundle size impact

## Related Documentation

- Social Features Tests: `tests/e2e-upload/SOCIAL_FEATURES_TESTS.md`
- Upload Tests: `tests/e2e-upload/upload-flow.spec.ts`
- Backend API: `../ytgify-share/API_DOCUMENTATION.md`
