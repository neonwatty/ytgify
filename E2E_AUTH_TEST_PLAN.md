# Comprehensive Playwright E2E Test Plan: Phase 1 JWT Authentication

**Created:** 2025-11-12
**Status:** Planning Complete - Ready for Implementation
**Estimated Time:** 2-3 weeks

---

## Overview

This document provides a comprehensive plan for implementing Playwright E2E tests for Phase 1 JWT authentication in the ytgify Chrome extension. Tests will validate the complete authentication flow from login to token persistence across service worker restarts.

---

## 1. Test File Structure

```
tests/
├── e2e-auth/                           # NEW: Auth E2E tests (real backend)
│   ├── global-setup.ts                 # Backend health check + seed data
│   ├── global-teardown.ts              # Cleanup test users
│   ├── fixtures.ts                     # Auth-specific fixtures
│   ├── page-objects/                   # Page objects for auth UI
│   │   ├── PopupPage.ts               # Popup window interactions
│   │   ├── AuthViewPage.ts            # Login form page object
│   │   └── UserProfilePage.ts         # User profile display
│   ├── helpers/                        # Auth test helpers
│   │   ├── backend-client.ts          # Backend API client for test setup
│   │   ├── storage-helpers.ts         # chrome.storage inspection
│   │   └── service-worker-helpers.ts  # SW restart simulation
│   └── auth-flow.spec.ts              # Main auth test suite
├── playwright-auth.config.ts          # NEW: Auth E2E config
└── (existing e2e-mock/, e2e/ unchanged)
```

**Naming Convention:**
- Test files: `<feature>-<scenario>.spec.ts` (e.g., `auth-flow.spec.ts`)
- Page objects: `<Component>Page.ts` (e.g., `AuthViewPage.ts`)
- Helpers: `<purpose>-helpers.ts` (e.g., `storage-helpers.ts`)

---

## 2. Test Setup & Teardown

### 2.1 Global Setup (`tests/e2e-auth/global-setup.ts`)

**Responsibilities:**
1. Check if backend is running at `http://localhost:3000`
2. Verify backend health endpoint
3. Ensure test user exists (`testauth@example.com` / `password123`)
4. Verify extension is built (`dist/` folder)
5. Create test results directories

**Key Features:**
- Fails fast if backend not running
- Idempotent user creation (checks if exists first)
- Clear console output showing setup status
- Provides helpful error messages with instructions

### 2.2 Test-Level Setup

Each test starts with:
- Fresh browser context (no cached auth)
- Cleared `chrome.storage.local`
- Blank page navigation
- Extension loaded

---

## 3. Core Test Cases

### 3.1 Test Suite Organization

```typescript
test.describe('Phase 1: JWT Authentication Flow', () => {
  test.describe('Login Flow', () => {
    // 6 tests
  });

  test.describe('User Profile Display', () => {
    // 3 tests
  });

  test.describe('Token Persistence', () => {
    // 3 tests
  });

  test.describe('Token Refresh', () => {
    // 3 tests
  });

  test.describe('Logout Flow', () => {
    // 3 tests
  });

  test.describe('Error Handling', () => {
    // 4 tests
  });

  test.describe('Edge Cases', () => {
    // 3 tests
  });
});
```

**Total: 25 test cases**

### 3.2 Priority Test Cases

#### **P0 (Must Have):**
1. ✅ Login with valid credentials
2. ✅ Login with invalid credentials shows error
3. ✅ Display user profile after login
4. ✅ Logout clears auth state
5. ✅ Token persists across popup close/reopen
6. ✅ Token persists after service worker restart

#### **P1 (High Priority):**
7. Token refresh when expiring soon
8. Network error handling
9. Backend unavailable error
10. 401 unauthorized handling

#### **P2 (Nice to Have):**
11. Forgot password link opens web page
12. Create account link opens signup page
13. Concurrent login attempts
14. Expired token on popup open

---

## 4. Playwright Patterns

### 4.1 Extension Popup Interaction

```typescript
export class PopupPage {
  constructor(private page: Page, private extensionId: string) {}

  async open() {
    const popupUrl = `chrome-extension://${this.extensionId}/popup.html`;
    await this.page.goto(popupUrl);
    await this.page.waitForLoadState('domcontentloaded');
  }
}
```

### 4.2 Chrome Storage Access

```typescript
export async function getAuthStateFromStorage(
  context: BrowserContext,
  extensionId: string
): Promise<AuthState | null> {
  const serviceWorker = context.serviceWorkers()[0];
  return await serviceWorker.evaluate(async () => {
    return new Promise((resolve) => {
      chrome.storage.local.get('authState', (result) => {
        resolve(result.authState || null);
      });
    });
  });
}
```

### 4.3 Service Worker Restart Simulation

```typescript
export async function restartServiceWorker(
  context: BrowserContext,
  extensionId: string
): Promise<void> {
  const oldWorker = context.serviceWorkers()[0];
  await oldWorker.evaluate(() => self.close()).catch(() => {});
  await context.waitForEvent('serviceworker', { timeout: 10000 });
}
```

### 4.4 Locator Strategies

**Best Practice: Use data-testid attributes**

Add to React components:
```tsx
<button data-testid="login-submit-btn" onClick={handleLogin}>
  Sign In
</button>

<input
  data-testid="email-input"
  type="email"
  value={email}
/>
```

Use in tests:
```typescript
this.emailInput = page.locator('[data-testid="email-input"]');
this.loginButton = page.locator('[data-testid="login-submit-btn"]');
```

**Fallback: ARIA labels**
```typescript
this.page.getByRole('button', { name: 'Sign In' });
this.page.getByLabel('Email');
```

---

## 5. Page Object Patterns

### 5.1 AuthViewPage (Login Form)

```typescript
export class AuthViewPage {
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;
  readonly errorMessage: Locator;

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.loginButton.click();
  }

  async getErrorMessage(): Promise<string> {
    return await this.errorMessage.textContent() || '';
  }
}
```

### 5.2 UserProfilePage

```typescript
export class UserProfilePage {
  readonly usernameDisplay: Locator;
  readonly emailDisplay: Locator;
  readonly logoutButton: Locator;

  async waitForProfile(timeout: number = 10000) {
    await this.profileContainer.waitFor({ state: 'visible', timeout });
  }

  async getUsername(): Promise<string> {
    return await this.usernameDisplay.textContent() || '';
  }

  async clickLogout() {
    await this.logoutButton.click();
  }
}
```

---

## 6. Configuration

### 6.1 Playwright Config (`tests/playwright-auth.config.ts`)

```typescript
export default defineConfig({
  testDir: './e2e-auth',
  fullyParallel: false,        // Sequential execution
  workers: 1,                   // Single worker
  timeout: 60000,               // 1 minute per test

  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chrome-extension-auth',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            `--load-extension=${distPath}`,
            '--no-sandbox',
          ],
        },
      },
    },
  ],

  globalSetup: './e2e-auth/global-setup.ts',
  globalTeardown: './e2e-auth/global-teardown.ts',
});
```

### 6.2 Package.json Scripts

```json
{
  "scripts": {
    "test:e2e:auth": "playwright test --config tests/playwright-auth.config.ts",
    "test:e2e:auth:headed": "playwright test --config tests/playwright-auth.config.ts --headed",
    "test:e2e:auth:debug": "playwright test --config tests/playwright-auth.config.ts --debug",
    "test:e2e:auth:ui": "playwright test --config tests/playwright-auth.config.ts --ui"
  }
}
```

---

## 7. Example Test Implementation

### Test: Login with Valid Credentials

```typescript
test('should successfully login with valid credentials', async ({
  page,
  context,
  extensionId
}) => {
  const popup = new PopupPage(page, extensionId);
  const authView = new AuthViewPage(page);
  const profileView = new UserProfilePage(page);

  // 1. Open popup
  await popup.open();

  // 2. Verify login form visible
  await authView.waitForLoginForm();

  // 3. Login
  await authView.login('testauth@example.com', 'password123');

  // 4. Verify profile displays
  await profileView.waitForProfile();
  const username = await profileView.getUsername();
  expect(username).toBe('testauth');

  // 5. Verify token stored
  const authState = await getAuthStateFromStorage(context, extensionId);
  expect(authState.token).toBeTruthy();
  expect(authState.userProfile.email).toBe('testauth@example.com');
});
```

### Test: Token Persistence After Service Worker Restart

```typescript
test('should restore auth state after service worker restart', async ({
  page,
  context,
  extensionId
}) => {
  const popup = new PopupPage(page, extensionId);
  const authView = new AuthViewPage(page);
  const profileView = new UserProfilePage(page);

  // 1. Login
  await popup.open();
  await authView.login('testauth@example.com', 'password123');
  await profileView.waitForProfile();

  // 2. Get token before restart
  const authStateBefore = await getAuthStateFromStorage(context, extensionId);

  // 3. Close popup
  await popup.close();

  // 4. Restart service worker
  await restartServiceWorker(context, extensionId);
  await page.waitForTimeout(2000);

  // 5. Reopen popup
  await popup.open();

  // 6. Verify still logged in
  await profileView.waitForProfile();
  const username = await profileView.getUsername();
  expect(username).toBe('testauth');

  // 7. Verify token persisted
  const authStateAfter = await getAuthStateFromStorage(context, extensionId);
  expect(authStateAfter.token).toBe(authStateBefore.token);
});
```

---

## 8. CI/CD Considerations

### 8.1 Local-First Approach (RECOMMENDED for Phase 1)

**Run tests locally before PRs:**

```bash
# Terminal 1: Start backend
cd ytgify-share
bin/dev

# Terminal 2: Run auth tests
cd ytgify
npm run test:e2e:auth
```

**Why local-first:**
- Requires running Rails backend (PostgreSQL, Redis)
- Complex CI setup needed (multi-container)
- Faster feedback during development
- No CI resource consumption

### 8.2 Future CI Integration

Options:
1. **Docker Compose** - Run backend services in CI
2. **Separate Auth Test Job** - Only runs when auth code changes
3. **Nightly Runs** - Run auth tests on schedule, not every PR

### 8.3 Test Execution Strategy

**DO NOT parallelize auth tests:**
- Shared test user on backend
- Token state conflicts
- Service worker singleton

**Config ensures sequential execution:**
```typescript
{
  fullyParallel: false,
  workers: 1,
}
```

---

## 9. Backend Integration

### 9.1 Backend Client Helper

```typescript
export class BackendClient {
  async healthCheck(): Promise<boolean> {
    const response = await fetch(`${this.baseURL}/api/v1/health`);
    return response.ok;
  }

  async ensureTestUser(user: TestUser): Promise<void> {
    // Try login first (user might exist)
    const loginResponse = await this.login(user.email, user.password);
    if (loginResponse.ok) return;

    // Create user if doesn't exist
    await this.register(user);
  }

  async verifyToken(token: string): Promise<boolean> {
    const response = await fetch(`${this.baseURL}/api/v1/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.ok;
  }
}
```

---

## 10. Implementation Checklist

### Phase 1: Infrastructure (Week 1, Days 1-2)

- [ ] Create `tests/e2e-auth/` directory
- [ ] Add `playwright-auth.config.ts`
- [ ] Update `package.json` scripts
- [ ] Create `global-setup.ts` with backend health check
- [ ] Create `fixtures.ts` with extension loading
- [ ] Add `BackendClient` helper (`helpers/backend-client.ts`)
- [ ] Add storage helpers (`helpers/storage-helpers.ts`)
- [ ] Add service worker helpers (`helpers/service-worker-helpers.ts`)

### Phase 2: Page Objects (Week 1, Days 3-4)

- [ ] Create `PopupPage.ts`
- [ ] Create `AuthViewPage.ts` with all locators
- [ ] Create `UserProfilePage.ts` with all locators
- [ ] Add `data-testid` attributes to `AuthView.tsx`
- [ ] Add `data-testid` attributes to `UserProfileView.tsx`
- [ ] Add `data-testid` attributes to `PopupWithAuth.tsx`

### Phase 3: P0 Tests (Week 1, Day 5 - Week 2, Day 2)

- [ ] Test: Login with valid credentials
- [ ] Test: Login with invalid credentials
- [ ] Test: Display user profile after login
- [ ] Test: Logout flow
- [ ] Test: Token persistence across popup close/reopen
- [ ] Test: Token persistence after service worker restart

### Phase 4: P1 Tests (Week 2, Days 3-4)

- [ ] Test: Token refresh when expiring soon
- [ ] Test: Network error handling
- [ ] Test: Backend unavailable error
- [ ] Test: 401 unauthorized handling

### Phase 5: Documentation (Week 2, Day 5)

- [ ] Update `CLAUDE.md` with E2E auth test patterns
- [ ] Document test running instructions
- [ ] Add troubleshooting guide
- [ ] Update `PHASE1_PROGRESS.md`

---

## 11. Running the Tests

### Local Development

```bash
# Headless (default)
npm run test:e2e:auth

# Headed (visible browser)
npm run test:e2e:auth:headed

# Debug mode (step through tests)
npm run test:e2e:auth:debug

# UI mode (Playwright inspector)
npm run test:e2e:auth:ui
```

### Before Pull Request

```bash
# Full validation including auth tests
npm run validate:pre-push:with-auth
```

### Prerequisites

1. **Backend must be running:**
   ```bash
   cd ytgify-share
   bin/dev
   ```

2. **Extension must be built:**
   ```bash
   npm run build
   ```

3. **Test user must exist:**
   - Email: `testauth@example.com`
   - Password: `password123`
   - (Global setup creates this automatically)

---

## 12. Troubleshooting

### Backend Not Running

```
❌ Backend not accessible at http://localhost:3000
   Please start the backend: cd ytgify-share && bin/dev
```

**Solution:**
```bash
cd ../ytgify-share
bin/rails db:test:prepare  # First time only
bin/dev
```

### Test User Creation Failed

**Manually create:**
```bash
cd ytgify-share
bin/rails console

User.create!(
  email: 'testauth@example.com',
  username: 'testauth',
  password: 'password123',
  password_confirmation: 'password123'
)
```

### Extension Not Loading

```bash
npm run build
```

### Service Worker Not Found

Wait longer for service worker activation:
```typescript
await page.waitForTimeout(3000);
```

---

## 13. Success Criteria

### Must Pass (P0)
- [ ] All 6 P0 tests passing consistently
- [ ] No flaky tests (pass 10/10 runs)
- [ ] Tests run in < 5 minutes total
- [ ] Clear error messages on failure

### Should Pass (P1)
- [ ] All 4 P1 tests passing
- [ ] Proper cleanup between tests
- [ ] No interference between tests

### Nice to Have (P2)
- [ ] All 25 tests passing
- [ ] Screenshots captured on failure
- [ ] Video recordings of failures
- [ ] HTML report generated

---

## 14. Future Enhancements

### Phase 2 Integration
- [ ] Add tests for GIF upload with auth
- [ ] Test API client with authenticated requests
- [ ] Verify JWT sent in request headers

### Phase 3 Integration
- [ ] Test social features (like, comment) with auth
- [ ] Test collection creation with auth
- [ ] Test follow/unfollow with auth

### CI/CD
- [ ] Docker Compose setup for CI
- [ ] GitHub Actions workflow
- [ ] Test result reporting in PRs

---

## Summary

**Scope:** 25 E2E tests covering complete JWT authentication flow

**Key Components:**
- Global setup with backend health checks
- Page objects for auth UI
- Storage and service worker helpers
- Comprehensive test coverage (login, logout, persistence, refresh, errors)

**Estimated Effort:** 2-3 weeks
- Week 1: Infrastructure + Page Objects + P0 tests
- Week 2: P1 tests + Documentation + Refinement

**Dependencies:**
- Backend running at `http://localhost:3000`
- Test user: `testauth@example.com` / `password123`
- Extension built in `dist/` folder

**Next Steps:**
1. Start with infrastructure (global setup, configs)
2. Add `data-testid` attributes to components
3. Implement page objects
4. Write P0 tests (6 tests)
5. Expand to P1/P2 tests

---

**Last Updated:** 2025-11-12
**Status:** Ready for Implementation
**Assigned To:** Development Team
