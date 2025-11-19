# Manual Authentication Testing Guide

**Phase 1: JWT Authentication - Manual Testing**

---

## Prerequisites

✅ **Backend Running:** `http://localhost:3000` (ytgify-share)
✅ **Extension Built:** `dist/` folder ready
✅ **Test Credentials:**
- Email: `testauth@example.com`
- Password: `password123`

---

## Setup

### 1. Load Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right corner)
3. Click **"Load unpacked"**
4. Select: `/Users/jeremywatt/Desktop/ytgify-glue/ytgify/dist`
5. Verify extension appears in list with name "YTgify"

### 2. Open Extension Popup

**Method 1:** Click extension icon in Chrome toolbar
**Method 2:** Press `Cmd+Shift+G` (Mac) or `Ctrl+Shift+G` (Windows/Linux)

---

## Test Cases

### Test 1: Initial State (Unauthenticated)

**Steps:**
1. Open extension popup
2. Observe bottom section

**Expected:**
- ✅ "Sign in to upload GIFs and join the community" message visible
- ✅ Blue "Sign In" button visible
- ✅ Main popup UI above auth section unchanged

**Screenshot Location:** Take screenshot for documentation

---

### Test 2: Open Login Form

**Steps:**
1. Click "Sign In" button

**Expected:**
- ✅ Login form appears with header "Sign In to YTGify"
- ✅ Email input field visible
- ✅ Password input field visible
- ✅ "Sign In" submit button visible
- ✅ "Forgot password?" link visible
- ✅ "Create Account" button visible
- ✅ Benefits list visible (4 items with checkmarks)
- ✅ Back arrow button in header

**Verify Form Fields:**
- [ ] Email input accepts text
- [ ] Password input masks characters
- [ ] Form has proper styling (no layout issues)

---

### Test 3: Login with Valid Credentials

**Steps:**
1. Enter email: `testauth@example.com`
2. Enter password: `password123`
3. Click "Sign In" button

**Expected:**
- ✅ Button shows "Signing in..." during request
- ✅ No error message appears
- ✅ Form transitions to user profile view
- ✅ Backend logs show successful login (check terminal)

**Verify Profile View:**
- [ ] Username "testauth" displayed
- [ ] Email "testauth@example.com" displayed
- [ ] Avatar/initial displayed (letter "T")
- [ ] Stats grid visible (GIFs: 0, Followers: 0, Following: 0)
- [ ] "View Profile on Web" button
- [ ] "Browse Community" button
- [ ] "Sign Out" button (red text)

---

### Test 4: Verify Token Storage

**Steps:**
1. After successful login, open Chrome DevTools
2. Go to **Application** tab → **Storage** → **Local Storage** → Extension ID
3. Look for `authState` key

**Expected:**
- ✅ `authState` object present with keys:
  - `token`: JWT string (starts with "eyJ")
  - `expiresAt`: Unix timestamp
  - `userId`: UUID
  - `userProfile`: User object with username, email, etc.

**Inspect Token:**
```bash
# Decode JWT (copy token from storage)
# In browser console or terminal:
echo "YOUR_JWT_TOKEN" | cut -d. -f2 | base64 -D | jq
```

**Expected JWT Payload:**
```json
{
  "sub": "user-uuid",
  "jti": "token-uuid",
  "exp": 1234567890,
  "scp": "user"
}
```

---

### Test 5: Return to Main Popup

**Steps:**
1. From user profile view, click back arrow
2. Observe main popup

**Expected:**
- ✅ Returns to main popup UI
- ✅ Bottom section now shows "My Account" button (instead of "Sign In")
- ✅ Button has user icon
- ✅ No auth prompt text

---

### Test 6: Reopen Profile

**Steps:**
1. Click "My Account" button

**Expected:**
- ✅ User profile view appears immediately
- ✅ No loading delay (profile cached)
- ✅ All profile data present

---

### Test 7: Token Persistence (Service Worker Restart)

**Steps:**
1. While logged in, close popup
2. Open Chrome Task Manager (`Shift+Esc`)
3. Find "Extension: YTgify" process
4. End the process (simulates service worker termination)
5. Wait 5 seconds
6. Reopen extension popup

**Expected:**
- ✅ Popup still shows "My Account" button (not logged out)
- ✅ Clicking "My Account" loads profile successfully
- ✅ No login prompt appears
- ✅ Token refreshed if needed (check background script logs)

**Check Background Logs:**
1. Go to `chrome://extensions/`
2. Click "Service Worker" link under YTgify
3. Look for logs:
   - `[TokenManager] ⏱️ Checking auth state on service worker activation`
   - `[TokenManager] ✅ Token valid`

---

### Test 8: Logout

**Steps:**
1. Open user profile
2. Click "Sign Out" button
3. Confirm in dialog

**Expected:**
- ✅ Confirmation dialog appears
- ✅ Button shows "Signing out..." during request
- ✅ Returns to main popup
- ✅ Bottom section shows "Sign In" button again
- ✅ Auth state cleared from storage (verify in DevTools)

**Verify Storage Cleared:**
- [ ] `authState` key removed from Local Storage
- [ ] No cached profile data

---

### Test 9: Login with Invalid Credentials

**Steps:**
1. Click "Sign In"
2. Enter email: `testauth@example.com`
3. Enter password: `wrongpassword`
4. Click "Sign In"

**Expected:**
- ✅ Error message appears: "Email or password is incorrect"
- ✅ Error has red background
- ✅ Form remains open (not dismissed)
- ✅ Email/password fields retain values
- ✅ Button returns to "Sign In" (not stuck on "Signing in...")

---

### Test 10: Network Error Handling

**Steps:**
1. Stop backend server (`Ctrl+C` in ytgify-share terminal)
2. Click "Sign In"
3. Enter valid credentials
4. Click "Sign In"

**Expected:**
- ✅ Error message appears (network-related)
- ✅ Form remains open
- ✅ Button returns to "Sign In"
- ✅ User can retry

**Then:**
1. Restart backend: `cd ../ytgify-share && bin/dev`
2. Click "Sign In" again

**Expected:**
- ✅ Login succeeds

---

### Test 11: Token Expiry (Advanced)

**Note:** Token expires in 15 minutes by default.

**Quick Test (Modify Token):**
1. Login successfully
2. Open DevTools → Application → Local Storage
3. Edit `authState.expiresAt` to a past timestamp
4. Close and reopen popup
5. Try to access profile

**Expected:**
- ✅ Automatically logged out
- ✅ "Sign In" button appears
- ✅ No errors in console

---

### Test 12: Forgot Password Link

**Steps:**
1. Click "Forgot password?" link

**Expected:**
- ✅ Opens new tab to: `http://localhost:3000/password/new`
- ✅ Popup remains open

---

### Test 13: Create Account Link

**Steps:**
1. Click "Create Account" button

**Expected:**
- ✅ Opens new tab to: `http://localhost:3000/signup?source=extension`
- ✅ Popup remains open

---

### Test 14: View Profile on Web

**Steps:**
1. Login
2. Open user profile
3. Click "View Profile on Web"

**Expected:**
- ✅ Opens new tab to: `http://localhost:3000/@testauth`
- ✅ Web profile page loads

---

### Test 15: Browse Community

**Steps:**
1. From user profile, click "Browse Community"

**Expected:**
- ✅ Opens new tab to: `http://localhost:3000`
- ✅ Web app home page loads

---

## Debugging Tips

### Check Background Script Logs
1. Go to `chrome://extensions/`
2. Click "Service Worker" link
3. Look for:
   - `[ApiClient]` logs (API requests)
   - `[TokenManager]` logs (token lifecycle)
   - `[StorageAdapter]` logs (storage operations)

### Check Network Requests
1. Open DevTools (F12)
2. Go to Network tab
3. Filter: `api/v1/auth`
4. Look for:
   - `POST /api/v1/auth/login` → 200 OK
   - Response contains `token` and `user` fields

### Check Console Errors
1. Open DevTools Console
2. Look for red error messages
3. Common issues:
   - CORS errors → Backend needs CORS config (future task)
   - Network errors → Backend not running
   - Auth errors → Invalid credentials

---

## Success Criteria

### Must Pass
- [ ] Login with valid credentials succeeds
- [ ] Token persists after service worker restart
- [ ] Logout clears auth state
- [ ] Invalid credentials show error
- [ ] Profile view displays user data
- [ ] Navigation between main UI and auth section works

### Should Pass
- [ ] Network errors handled gracefully
- [ ] Token expiry handled
- [ ] External links open correctly
- [ ] Loading states display
- [ ] No console errors

---

## Known Issues

1. **`display_name` Field:** Fixed in ytgify-share (app/models/user.rb:113, 37)
2. **CORS Not Configured:** Will be needed for production (Phase 2)
3. **Token Refresh:** Currently on activation + 10-min alarm (works for testing)

---

## Next Steps After Manual Testing

1. Document any issues found
2. Add unit tests for:
   - StorageAdapter methods
   - API client methods
   - Token manager logic
3. Add E2E auth tests (Playwright)
4. Fix any bugs discovered

---

**Last Updated:** 2025-11-12
**Tested By:** [Your Name]
**Date:** [Test Date]
