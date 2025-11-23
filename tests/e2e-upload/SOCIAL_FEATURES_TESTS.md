# Phase 3 Social Features E2E Tests

## Overview

Comprehensive E2E tests for Phase 3 social features integration, testing the complete user journey from login through GIF viewing and interaction in the extension popup.

## Test File

`tests/e2e-upload/social-features.spec.ts`

## Tests Included

### Test 1: Complete Social Features Flow (Authenticated User)

**Duration:** ~2 minutes
**Coverage:** Complete user journey with all social features

**User Flow:**
1. **Login** - Opens popup and logs in with test credentials
2. **Upload GIF** - Creates and uploads a GIF to the backend
3. **View My GIFs** - Navigates to "My GIFs" tab and verifies uploaded GIF appears
4. **Like/Unlike** - Toggles like on the GIF and verifies count updates
5. **Browse Trending** - Opens trending view and verifies GIFs display
6. **Verify Metadata** - Checks all GIF card elements (thumbnail, username, stats)

**Assertions:**
- ✓ Login successful (user profile visible)
- ✓ Username displayed correctly
- ✓ GIF uploaded successfully to backend
- ✓ GIF appears in "My GIFs" tab
- ✓ Like count increases from 0 → 1
- ✓ Unlike count decreases from 1 → 0
- ✓ Trending view opens and displays GIFs
- ✓ GIF card has thumbnail image
- ✓ GIF card displays username
- ✓ GIF card has comment icon
- ✓ GIF card has view icon

### Test 2: Anonymous User - Trending View Only

**Duration:** ~1 minute
**Coverage:** Anonymous user browsing trending GIFs

**User Flow:**
1. Opens popup (not logged in)
2. Clicks "Browse Trending" button
3. Verifies trending view opens without authentication
4. Verifies like button is visible (but would require auth to use)

**Assertions:**
- ✓ Sign In button visible (user not authenticated)
- ✓ Browse Trending button accessible without login
- ✓ Trending view opens for anonymous users
- ✓ Like button visible on GIF cards

## Prerequisites

### Backend Running
```bash
cd ../ytgify-share
bin/dev
```

Backend must be running at `http://localhost:3000` with:
- User registration enabled
- JWT authentication configured
- GIF upload endpoint functional
- Trending feed endpoint functional

### Extension Built
```bash
npm run build
```

## Running Tests

### All Social Features Tests
```bash
npm run test:e2e:upload tests/e2e-upload/social-features.spec.ts
```

### Specific Test
```bash
npm run test:e2e:upload tests/e2e-upload/social-features.spec.ts -g "Complete social features flow"
```

### Headed Mode (Visual Debugging)
```bash
npm run test:e2e:upload -- --headed tests/e2e-upload/social-features.spec.ts
```

### Debug Mode
```bash
npm run test:e2e:upload -- --debug tests/e2e-upload/social-features.spec.ts
```

## What's Tested

### API Integration
- ✅ POST `/api/v1/auth/login` - User authentication
- ✅ POST `/api/v1/gifs` - GIF upload with JWT token
- ✅ GET `/api/v1/gifs?user_id=<uuid>` - Fetch user's GIFs
- ✅ GET `/api/v1/feed/trending` - Fetch trending GIFs
- ✅ POST `/api/v1/gifs/:id/likes` - Toggle like on GIF

### UI Components
- ✅ PopupWithAuth component - Login/logout flow
- ✅ AuthView component - Login form
- ✅ UserProfileView component - Profile display with tabs
- ✅ GifCard component - GIF display with metadata
- ✅ TrendingView component - Trending GIFs feed
- ✅ Tab navigation (Profile ↔ My GIFs)
- ✅ Section navigation (Main ↔ Account ↔ Trending)

### State Management
- ✅ Authentication state persistence
- ✅ User profile caching
- ✅ GIF list state management
- ✅ Like count real-time updates
- ✅ Pagination state

### Error Handling
- ✅ Network failures (automatic retry in API client)
- ✅ Token expiration (redirects to login)
- ✅ Empty states (no GIFs, no trending)
- ✅ Loading states

## Test Architecture

### Fixtures Used
- `context` - Browser context with extension loaded
- `extensionId` - Extension ID for popup URL
- `cleanContext` - Cleared storage before test
- `backend` - Backend API client for user setup
- `testUser` - Auto-generated test user
- `mockServerUrl` - Mock video server for GIF creation

### Page Objects
- `YouTubePage` - YouTube video page interactions
- `QuickCapturePage` - GIF wizard first screen
- `TextOverlayPage` - GIF wizard second screen
- `ProcessingPage` - GIF processing screen
- `SuccessPage` - GIF success screen with upload button

## Debugging Failed Tests

### Check Backend Logs
```bash
# In ytgify-share directory
tail -f log/development.log
```

### Check Extension Logs
In headed mode (`--headed` flag), DevTools opens automatically. Check:
- Console for React/API errors
- Network tab for API requests
- Storage tab for auth state

### Common Issues

**Issue:** "Sign In button not visible"
**Fix:** Check `cleanContext` fixture cleared storage properly

**Issue:** "GIF not appearing in My GIFs"
**Fix:** Verify backend upload was successful (check `uploadStatus` assertion)

**Issue:** "Like count not updating"
**Fix:** Check backend `/api/v1/gifs/:id/likes` endpoint is working

**Issue:** "Trending view empty"
**Fix:** Backend database may be empty, create some GIFs first

## Test Data

### Test User Format
```typescript
{
  email: "test-upload-<timestamp>@example.com",
  username: "testupload<timestamp>",
  password: "password123"
}
```

### GIF Upload Metadata
- Resolution: 144p (fastest for testing)
- FPS: 5 (fastest for testing)
- Duration: ~3 seconds (veryShort mock video)
- Title: Auto-generated from YouTube video

## Expected Duration

- Test 1 (Complete Flow): ~90-120 seconds
- Test 2 (Anonymous): ~30-60 seconds
- **Total:** ~2-3 minutes

## Test Output Example

```
[Social Test] Starting complete social features flow...
[Social Test] Extension ID: abc123...
[Social Test] Test User: testupload1234567890
[Social Test] Step 1: Opening popup and logging in...
[Social Test] ✓ Clicked Sign In button
[Social Test] ✓ Submitted login form
[Social Test] ✓ Login successful, user profile visible
[Social Test] ✓ Username displayed correctly
[Social Test] Step 2: Creating and uploading GIF...
[Social Test] ✓ GIF created successfully
[Social Test] ✓ Clicked Upload to Cloud button
[Social Test] ✓ GIF uploaded successfully to backend
[Social Test] Step 3: Viewing My GIFs tab...
[Social Test] ✓ Opened My Account section
[Social Test] ✓ Clicked My GIFs tab
[Social Test] ✓ Found 1 GIF(s) in My GIFs tab
[Social Test] ✓ GIF card displays like count
[Social Test] Step 4: Liking GIF...
[Social Test] ✓ Clicked like button
[Social Test] ✓ Like count updated to 1
[Social Test] ✓ Unlike successful, like count back to 0
[Social Test] Step 5: Browsing trending GIFs...
[Social Test] ✓ Navigated back to main popup
[Social Test] ✓ Clicked Browse Trending button
[Social Test] ✓ Trending view opened
[Social Test] ✓ Found 3 trending GIF(s)
[Social Test] ✓ Trending GIF cards display correctly
[Social Test] Step 6: Verifying GIF card metadata...
[Social Test] ✓ GIF card has thumbnail image
[Social Test] ✓ GIF card displays username
[Social Test] ✓ GIF card has comment icon
[Social Test] ✓ GIF card has view icon
✅ [Social Test] Complete social features flow test passed!
[Social Test] All features verified:
  - ✓ Login
  - ✓ GIF Upload
  - ✓ My GIFs Tab
  - ✓ Like/Unlike Functionality
  - ✓ Browse Trending
  - ✓ GIF Card Metadata Display
```

## Integration with CI

These tests require:
- Real backend running (YouTube blocks CI IPs)
- Run locally before submitting PRs
- Use `npm run validate:pre-push` for full validation

## Future Enhancements

- [ ] Test comment functionality when implemented
- [ ] Test collection functionality when implemented
- [ ] Test follow/unfollow when implemented
- [ ] Test personalized feed when implemented
- [ ] Test GIF search when implemented
- [ ] Test notifications when implemented

## Related Documentation

- Main E2E Tests: `tests/e2e-upload/README.md`
- Upload Tests: `tests/e2e-upload/upload-flow.spec.ts`
- Auth Tests: `tests/e2e-auth/`
- Backend API: `../ytgify-share/API_DOCUMENTATION.md`
