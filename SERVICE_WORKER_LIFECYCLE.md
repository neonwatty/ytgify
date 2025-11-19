# Service Worker Lifecycle Documentation

**Date:** 2025-11-12
**Purpose:** Document service worker behavior for Phase 1 JWT authentication integration

---

## Service Worker Lifecycle Events

### 1. onInstalled
**Trigger:** First install, extension update, or Chrome update
**Current Behavior:**
- Initializes default storage preferences
- Sets up engagement tracking on first install
- Cleans up legacy IndexedDB on updates
- Does NOT open welcome tabs (per design decision)

**Source:** `src/background/index.ts:11-130`

### 2. onStartup
**Trigger:** Browser launch
**Current Behavior:**
- Logs extension startup
- Clears runtime state via `extensionStateManager`
- Prepares for new session

**Source:** `src/background/index.ts:132-145`

### 3. onSuspend
**Trigger:** Before service worker terminates (cleanup opportunity)
**Current Behavior:**
- Cleans up message handler resources
- Cleans up old worker jobs
- Clears logger buffer

**Source:** `src/background/index.ts:469-484`

### 4. Auto-Termination
**Behavior:** Service worker terminates after ~5 minutes of inactivity
**Implications:**
- All in-memory state is lost
- Message listeners and timers are cleared
- No persistent connections (WebSockets, long-lived ports, etc.)

---

## Critical Implications for JWT Authentication

### ❌ What WILL NOT Work

1. **In-Memory Token Storage**
   - Service worker terminates → token lost
   - Next API call fails with 401 Unauthorized
   - User forced to re-login unexpectedly

2. **Cached Authentication State**
   - Cannot rely on variables like `let isAuthenticated = true`
   - State resets on every service worker restart

3. **Timer-Based Token Refresh**
   - `setInterval()` for token refresh will be cleared
   - Cannot use background timers for proactive refresh

4. **Long-Lived Connections**
   - WebSocket connections for real-time updates not supported
   - Must use polling or content script-based connections

### ✅ What WILL Work

1. **Persistent Token Storage**
   - Store JWT tokens in `chrome.storage.local`
   - Retrieve on every API call
   - Token survives service worker restarts

2. **On-Demand Token Refresh**
   - Check token expiry before each API call
   - Refresh if expired or close to expiry
   - No background refresh needed

3. **Stateless Authentication**
   - Every API call retrieves token from storage
   - Validates token expiry
   - Handles refresh inline

---

## Current Storage Architecture

### chrome.storage.local
**Used for:**
- User preferences (frame rate, quality, theme, etc.)
- Engagement tracking data
- Local-only settings

**Access Pattern:**
```typescript
// Read
const result = await chrome.storage.local.get(['userPreferences']);

// Write
await chrome.storage.local.set({ userPreferences: {...} });
```

**Source:** `src/background/index.ts:336-421`

### chrome.storage.sync (Not Currently Used)
**Potential use:** Cross-device JWT token sync (not recommended for security)

### No IndexedDB
**Status:** Removed in recent updates
**Cleanup:** Runs on extension update to remove legacy data

---

## Message Passing Architecture

### Message Flow
```
Content Script → Background (onMessage) → Message Handler → Response
Popup → Background (onMessage) → Message Handler → Response
```

### Async Message Support
**Pattern:**
```typescript
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Return true to keep message channel open for async response
  handleMessageAsync(message).then(sendResponse);
  return true; // Important!
});
```

**Source:** `src/background/index.ts:148-291`

### Error Handling
- Comprehensive error boundaries
- Retry logic with exponential backoff
- Fallback responses for critical failures
- Performance tracking for all messages

---

## Keep-Alive Mechanism

### Current Implementation
**Purpose:** Prevent premature service worker termination during active processing

**Methods:**
1. Message listeners keep worker alive during processing
2. Periodic cleanup every 5 minutes (300000ms)
3. Job queue monitoring

**Source:** `src/background/index.ts:487-517`

**Note:** Keep-alive does NOT prevent eventual termination (still happens after ~5 min idle)

---

## Phase 1 JWT Integration Recommendations

### Storage Strategy
```typescript
interface AuthState {
  token: string;           // JWT access token
  refreshToken: string;    // JWT refresh token
  expiresAt: number;       // Unix timestamp (ms)
  userId: string;          // User UUID
}

// Store in chrome.storage.local
await chrome.storage.local.set({ authState });
```

### Token Refresh Pattern
```typescript
async function getValidToken(): Promise<string | null> {
  const { authState } = await chrome.storage.local.get(['authState']);

  if (!authState) return null;

  const now = Date.now();
  const bufferTime = 60000; // 1 minute buffer

  if (now + bufferTime >= authState.expiresAt) {
    // Token expired or close to expiry - refresh
    const newAuthState = await refreshTokens(authState.refreshToken);
    await chrome.storage.local.set({ authState: newAuthState });
    return newAuthState.token;
  }

  return authState.token;
}
```

### API Client Pattern
```typescript
async function apiRequest(endpoint: string, options: RequestInit) {
  const token = await getValidToken();

  if (!token) {
    throw new AuthenticationError('Not authenticated');
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
    },
  });

  if (response.status === 401) {
    // Token invalid - clear auth state and retry once
    await chrome.storage.local.remove(['authState']);
    throw new AuthenticationError('Session expired');
  }

  return response;
}
```

### Logout Pattern
```typescript
async function logout() {
  // Call backend logout endpoint (adds JWT to denylist)
  try {
    await apiRequest('/api/v1/auth/logout', { method: 'DELETE' });
  } catch (error) {
    // Ignore errors - clear local state regardless
  }

  // Clear local auth state
  await chrome.storage.local.remove(['authState']);
}
```

---

## Testing Considerations

### Service Worker Restart Simulation
**Manual Test:**
1. Open `chrome://extensions/`
2. Click "Service worker (Inactive)" to restart
3. Verify authentication state persists

**Automated Test:**
```typescript
// Kill service worker programmatically (test only)
await chrome.runtime.reload();

// Verify auth state after restart
const { authState } = await chrome.storage.local.get(['authState']);
expect(authState).toBeDefined();
```

### Token Expiry Testing
**Mock expired token:**
```typescript
const expiredAuthState = {
  token: 'mock-token',
  refreshToken: 'mock-refresh',
  expiresAt: Date.now() - 1000, // 1 second ago
  userId: 'test-user-id',
};

await chrome.storage.local.set({ authState: expiredAuthState });
const token = await getValidToken(); // Should trigger refresh
```

---

## Security Considerations

### Token Storage
- ✅ `chrome.storage.local` is isolated per-extension (not accessible to web pages)
- ✅ No XSS risk (extension sandbox)
- ⚠️ Accessible to extension code only
- ❌ Do NOT use `chrome.storage.sync` for tokens (syncs across devices, increased exposure)

### Token Transmission
- ✅ Always use HTTPS for API calls
- ✅ Use `Authorization: Bearer` header (not URL params)
- ⚠️ Validate SSL certificates (fetch API does this by default)

### Token Lifecycle
- ✅ Short-lived access tokens (15 minutes per backend config)
- ✅ Refresh tokens for extended sessions
- ✅ Backend JWT denylist on logout (via devise-jwt)
- ⚠️ Clear tokens on logout (prevent reuse)

---

## Performance Considerations

### Token Retrieval Overhead
- `chrome.storage.local.get()` is async but fast (~1-2ms)
- Acceptable overhead for every API call
- No need to cache in memory (service worker instability)

### Storage Quota
- `chrome.storage.local`: 10MB limit (Chrome)
- Auth state: ~500 bytes (negligible)
- No storage quota concerns for JWT tokens

---

## Next Steps for Phase 1

1. **Create API Client Module** (`src/lib/api/client.ts`)
   - Implement token storage/retrieval
   - Implement token refresh logic
   - Implement authenticated request wrapper

2. **Create Auth Service** (`src/lib/api/auth.ts`)
   - Login endpoint (`POST /api/v1/auth/login`)
   - Logout endpoint (`DELETE /api/v1/auth/logout`)
   - Token refresh endpoint (`POST /api/v1/auth/refresh`)
   - Auth state management

3. **Update Message Bus** (`src/shared/message-bus.ts`)
   - Add auth-related message types
   - Handle 401 responses globally

4. **Add Auth UI** (Popup or Content Script)
   - Login form
   - Logout button
   - Auth status indicator

5. **E2E Auth Tests**
   - Login flow (stores token)
   - Service worker restart (preserves token)
   - Token expiry (triggers refresh)
   - Logout (clears token)
   - API call with invalid token (handles 401)

---

**Last Updated:** 2025-11-12
**Status:** Ready for Phase 1 implementation
