# Manual Testing Guide - Chrome Extension

**Purpose:** Verify Phase 1 (Auth) + Phase 2 (Upload) integration works end-to-end

**Estimated Time:** 30-45 minutes

---

## Prerequisites

### 1. Backend Running

**Terminal 1 - Start ytgify-share backend:**
```bash
cd ../ytgify-share
bin/rails server
# Should start on http://localhost:3000
```

Wait for:
```
* Listening on http://127.0.0.1:3000
```

### 2. Create Test Account (If Needed)

**Option A: Via Rails Console**
```bash
cd ../ytgify-share
bin/rails console

# In console:
User.create!(
  email: 'test@example.com',
  username: 'testuser',
  password: 'password123',
  password_confirmation: 'password123'
)
exit
```

**Option B: Via Web App**
1. Open http://localhost:3000
2. Click "Sign Up"
3. Create account with:
   - Email: test@example.com
   - Username: testuser
   - Password: password123

### 3. Build Extension

**Terminal 2 - Build extension:**
```bash
cd ytgify  # (should already be here)
npm run build
```

Wait for:
```
webpack 5.101.3 compiled with 2 warnings in ~10 seconds
```

---

## Step 1: Load Extension in Chrome

### 1.1 Open Chrome Extensions Page

1. Open Chrome browser
2. Navigate to: `chrome://extensions/`
3. Enable "Developer mode" (toggle in top-right)

### 1.2 Load Unpacked Extension

1. Click "Load unpacked" button
2. Navigate to: `/Users/jeremywatt/Desktop/ytgify-glue/ytgify/dist`
3. Click "Select"

### 1.3 Verify Extension Loaded

You should see:
- Extension card with "YTgify" name
- Version: 1.0.9
- Status: "Service worker" (active)
- Extension ID: `[random string like cbbkeafnogjckengjninbohgglbnohjo]`

**Pin the extension:**
1. Click puzzle piece icon (Extensions) in Chrome toolbar
2. Find "YTgify"
3. Click pin icon

---

## Step 2: Test Anonymous User Flow (No Auth)

### 2.1 Open Extension Popup

1. Click YTgify icon in toolbar
2. Popup should open (~360px wide)

**Expected:**
- Main popup UI visible
- "Sign In" button at bottom
- Button visibility toggle (hidden by default)
- Newsletter/review prompts (if qualified)

### 2.2 Navigate to YouTube Video

1. Open new tab
2. Go to: https://www.youtube.com/watch?v=dQw4w9WgXcQ
   - (or any short YouTube video 10-30 seconds)
3. Wait for video to load

### 2.3 Create GIF (Anonymous)

**YTgify button should NOT be visible** (default hidden)

1. Open popup → toggle "Show YTgify Button" to ON
2. Refresh YouTube page
3. YTgify button should appear on video player

**Create GIF:**
1. Click "Create GIF" button on video
2. Wizard should appear over video:
   - Screen 1: Quick Capture (select time range)
   - Screen 2: Text Overlay (optional)
   - Screen 3: Processing (progress bar)
   - Screen 4: Success (preview + download)

3. On Quick Capture screen:
   - Adjust start/end times (default: 0-5s)
   - Click "Next"

4. On Text Overlay screen:
   - Skip or add text
   - Click "Next"

5. Wait for processing (~10-20 seconds)

6. On Success screen:
   - GIF preview visible
   - "Download GIF" button
   - **NO upload status** (anonymous user)

7. Click "Download GIF"
   - GIF downloads to Downloads folder
   - Filename: `ytgif-[timestamp].gif`

**✅ Anonymous flow: PASS** if GIF downloads successfully

---

## Step 3: Test Authentication Flow

### 3.1 Open Auth UI

1. Click YTgify icon in toolbar
2. Click "Sign In" button at bottom
3. Auth view should appear

**Expected:**
- Login form with email/password inputs
- "Sign In" submit button
- "Forgot password?" link
- "Create Account" button
- Benefits list (checkmarks)

### 3.2 Test Invalid Credentials

1. Enter email: `wrong@example.com`
2. Enter password: `wrongpassword`
3. Click "Sign In"

**Expected:**
- Loading state ("Signing in..." button disabled)
- Error message appears (red background):
  - "Email or password is incorrect"

**✅ Invalid credentials: PASS** if error shown

### 3.3 Test Valid Login

1. Clear error (enter new credentials)
2. Enter email: `test@example.com`
3. Enter password: `password123`
4. Click "Sign In"

**Expected:**
- Loading state
- After ~1-2 seconds, profile view appears:
  - Username: "testuser"
  - Email: "test@example.com"
  - "View Profile" button
  - "Open Web App" button
  - "Logout" button

**Verify in DevTools Console:**
```
[ApiClient] ✅ Login successful
[StorageAdapter] ✅ Auth state saved to local storage
```

**Verify in Chrome Storage:**
1. Right-click extension icon → "Manage Extension"
2. Click "Inspect views service worker"
3. DevTools opens → Console tab
4. Run:
   ```javascript
   chrome.storage.local.get('authState', (result) => {
     console.log('Auth State:', result.authState);
   });
   ```

**Expected output:**
```javascript
Auth State: {
  token: "eyJhbGciOiJIUzI1NiJ9...",
  expiresAt: 1731889234000,
  userId: "some-uuid",
  userProfile: {
    email: "test@example.com",
    username: "testuser",
    ...
  }
}
```

**✅ Login: PASS** if profile view shows correct user

### 3.4 Test Token Persistence

1. Close popup (click outside or close tab)
2. Reopen popup (click extension icon)
3. Click "My Account" button at bottom

**Expected:**
- Profile view appears immediately
- Same username/email displayed
- No login required

**✅ Token persistence: PASS** if still logged in

### 3.5 Test "View Profile" Button

1. In profile view, click "View Profile"

**Expected:**
- New tab opens to: `http://localhost:3000/@testuser`
- User profile page on ytgify-share

### 3.6 Test Logout

1. In profile view, click "Logout"
2. Confirm dialog appears: "Are you sure you want to sign out?"
3. Click "OK"

**Expected:**
- Login form reappears
- Profile view gone

**Verify in DevTools Console:**
```
[ApiClient] ✅ Logout successful
[StorageAdapter] 🗑️ Auth state cleared from storage
```

**✅ Logout: PASS** if login form shown

---

## Step 4: Test Authenticated GIF Upload

### 4.1 Login Again

1. Login with test@example.com / password123
2. Verify profile view appears
3. Keep popup open (or note: you're logged in)

### 4.2 Create GIF While Authenticated

1. Navigate to YouTube video (same as before)
2. Click "Create GIF" button
3. Go through wizard (select time, skip text, process)

### 4.3 Verify Upload Status

**On Success Screen:**

**Expected to see:**
- GIF preview
- "Download GIF" button
- **Upload status badge:**
  - "Uploading..." (yellow/blue) → briefly
  - "Upload Successful!" (green) → final state
  - OR "Upload Failed" (red) if error

**Check DevTools Console (YouTube tab):**
```
[Content] Starting cloud upload...
[ApiClient] 📤 Uploading GIF: [Video Title]
[ApiClient] ✅ GIF uploaded successfully: [gif-id-uuid]
[Content] ✅ Cloud upload successful
```

**✅ Upload: PASS** if status badge shows "Upload Successful!"

### 4.4 Verify GIF on Backend

**Option A: Rails Console**
```bash
cd ../ytgify-share
bin/rails console

# Check last GIF
Gif.last
# Should show your uploaded GIF with:
# - title: Video title
# - youtube_url: Video URL
# - user: testuser
# - file attached (ActiveStorage)
```

**Option B: Web App**
1. Open http://localhost:3000
2. Should see your GIF in feed
3. Click on GIF to view details

**✅ Backend verification: PASS** if GIF visible

---

## Step 5: Test Upload Failure Handling

### 5.1 Stop Backend

1. Go to terminal with rails server
2. Press `Ctrl+C` to stop

### 5.2 Create GIF While Backend Down

1. On YouTube, create another GIF
2. Go through wizard
3. On success screen, watch upload status

**Expected:**
- "Uploading..." appears
- After timeout (~10 seconds):
  - "Upload Failed" (red badge)
  - Error message: "Upload failed" or "Network error"
- GIF still downloads to Downloads folder

**✅ Failure handling: PASS** if error shown but download works

### 5.3 Restart Backend

```bash
cd ../ytgify-share
bin/rails server
```

---

## Step 6: Test Upload Disabled Preference

### 6.1 Open Extension Options (Future Feature)

**Note:** If upload preferences not yet in UI, test via console:

**Service Worker DevTools:**
```javascript
chrome.storage.sync.set({ uploadEnabled: false });
```

### 6.2 Create GIF with Upload Disabled

1. Create another GIF on YouTube
2. On success screen:

**Expected:**
- Upload status: "Upload Disabled"
- Or no upload badge at all
- GIF still downloads

**Re-enable:**
```javascript
chrome.storage.sync.set({ uploadEnabled: true });
```

---

## Step 7: Test Token Refresh

### 7.1 Manually Expire Token

**Service Worker DevTools:**
```javascript
chrome.storage.local.get('authState', (result) => {
  const auth = result.authState;
  auth.expiresAt = Date.now() - 1000; // Expired 1 second ago
  chrome.storage.local.set({ authState: auth });
  console.log('Token manually expired');
});
```

### 7.2 Trigger API Call

1. Create a GIF (this will trigger upload API call)
2. Watch service worker console

**Expected:**
```
[ApiClient] Token expired, attempting refresh...
[ApiClient] ✅ Token refreshed successfully
```

**OR if refresh fails:**
```
[ApiClient] ❌ Token refresh failed
[StorageAdapter] 🗑️ Auth state cleared
```

If cleared:
- Open popup → login form should appear
- Login again to continue testing

**✅ Token refresh: PASS** if token refreshed automatically

---

## Step 8: Test Service Worker Restart

### 8.1 Terminate Service Worker

1. Go to `chrome://extensions/`
2. Find YTgify extension
3. Click "Service worker" link (opens DevTools)
4. In DevTools Console, run:
   ```javascript
   self.close();
   ```

Service worker should terminate.

### 8.2 Trigger Service Worker Wake

1. Click extension icon (opens popup)
2. Service worker should restart automatically

**Check Service Worker Console:**
```
[TokenManager] ✅ Token valid for [X] more minutes
```

**✅ Service worker restart: PASS** if token still valid after restart

---

## Common Issues & Debugging

### Issue: Extension Not Loading

**Check:**
- `dist/` folder exists and has files
- `dist/manifest.json` present
- No webpack build errors

**Fix:**
```bash
npm run build
# Reload extension in chrome://extensions/
```

### Issue: Backend Connection Failed

**Check:**
1. Rails server running: `http://localhost:3000`
2. Check browser console for CORS errors
3. Verify API_BASE_URL in extension

**Fix:**
```bash
cd ../ytgify-share
bin/rails server
```

### Issue: Login Fails

**Check Rails logs:**
```bash
# In ytgify-share terminal
# Look for POST /api/v1/auth/login
# Should show 200 OK
```

**Verify user exists:**
```bash
bin/rails console
User.find_by(email: 'test@example.com')
```

### Issue: Upload Status Not Showing

**Check:**
1. User is authenticated
2. Backend is running
3. Browser console for errors

**Debug:**
```javascript
// In YouTube tab console
// After creating GIF, check:
console.log('Auth status:', await chrome.storage.local.get('authState'));
```

### Issue: GIF Not Appearing on Backend

**Check:**
1. Rails logs for POST /api/v1/gifs
2. S3 configuration (or local storage)

**Verify:**
```bash
bin/rails console
Gif.count  # Should increase after each upload
Gif.last   # See last uploaded GIF
```

---

## Testing Checklist

Use this to track your testing:

**Anonymous User:**
- [ ] Extension loads in Chrome
- [ ] Popup opens
- [ ] Create GIF on YouTube
- [ ] GIF downloads to Downloads folder
- [ ] No upload status (anonymous)

**Authentication:**
- [ ] Login with invalid credentials → error shown
- [ ] Login with valid credentials → profile appears
- [ ] Token persists across popup close/reopen
- [ ] Logout → login form reappears

**Authenticated Upload:**
- [ ] Login successful
- [ ] Create GIF → upload status shows
- [ ] "Uploading..." → "Upload Successful!"
- [ ] GIF visible on backend (rails console or web app)
- [ ] "View on Web" button opens ytgify-share

**Error Handling:**
- [ ] Backend down → upload fails gracefully
- [ ] GIF still downloads even if upload fails
- [ ] Error message displayed

**Token Management:**
- [ ] Expired token → auto-refresh
- [ ] Service worker restart → token survives
- [ ] Token refresh failure → login required

---

## Next Steps After Manual Testing

**If all tests pass:**
1. Create production build: `npm run build:production`
2. Test production build (loads without localhost permissions)
3. Prepare Chrome Web Store submission

**If issues found:**
1. Document failures
2. Check E2E tests for coverage
3. Fix bugs and re-test
4. Update tests if needed

---

**Manual Testing Complete!**

Ready for production build and Chrome Web Store submission.
