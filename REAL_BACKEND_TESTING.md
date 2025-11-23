# Real Backend Integration Testing

Guide for running E2E tests against the actual Rails backend instead of mocked responses.

---

## Overview

By default, E2E tests use route interception (`page.route()`) to mock API responses. This allows testing without a running backend server. However, for comprehensive integration testing, you can run tests against the real Rails backend at `http://localhost:3000`.

### Benefits of Real Backend Testing

- Validates actual CORS configuration
- Tests real database interactions
- Confirms JWT token flow works end-to-end
- Verifies ActiveStorage (S3) uploads work correctly
- Tests rate limiting and error handling with real backend responses
- Catches integration issues that mocks might miss

---

## Prerequisites

1. **Rails Backend Running**
   ```bash
   cd ../ytgify-share
   bin/rails server -p 3000
   ```

   Or use the provided helper script:
   ```bash
   ./scripts/start-backend-for-tests.sh
   ```

2. **Extension Built**
   ```bash
   npm run build
   ```

3. **Database Configured**
   ```bash
   cd ../ytgify-share
   bin/rails db:create db:migrate
   ```

---

## Running Real Backend Tests

### Quick Start

```bash
# Run all upload tests against real backend
npm run test:e2e:upload:real

# Run with visible browser (for debugging)
npm run test:e2e:upload:real:headed
```

### Manual Execution

```bash
# Set environment variable and run
REAL_BACKEND=true npm run test:e2e:upload

# With headed browser
REAL_BACKEND=true HEADED=true npm run test:e2e:upload

# Run specific test file
REAL_BACKEND=true npm run test:e2e:upload -- tests/e2e-upload/upload-flow.spec.ts
```

---

## How It Works

### Configuration

The `useRealBackend` fixture in `tests/e2e-upload/fixtures.ts` controls test behavior:

```typescript
useRealBackend: async ({}, use) => {
  const useReal = process.env.REAL_BACKEND === 'true';
  if (useReal) {
    console.log('[Fixtures] ⚡ REAL BACKEND MODE - Using actual Rails API');
    console.log('[Fixtures] ⚠️  Ensure Rails server is running');
  }
  await use(useReal);
}
```

### Test Adaptation

Tests conditionally skip route interception when `useRealBackend` is true:

```typescript
if (useRealBackend) {
  console.log('[Test] Real backend mode - skipping route interception');
} else {
  // Mock API responses with page.route()
  await page.route('**/api/v1/gifs', (route) => {
    // ...mock response
  });
}
```

### Tests That Run in Real Backend Mode

**Supported:**
- Anonymous user (download only)
- Authenticated user upload success
- Manual upload button visibility
- Privacy settings (public vs private)
- Token refresh flow (partial - no forced 401)

**Skipped in Real Backend Mode:**
- Upload failure tests (require mocking 500 errors)
- Token expiration during upload (require mocking 401)
- Refresh failure tests (require mocking failed refresh)
- Token refresh debug tests (require web UI and manual token manipulation)

These tests require route interception to force error conditions that wouldn't occur in normal operation.

**Debug Tests:**
- `token-refresh-debug.spec.ts` - Both scenarios skipped in real backend mode
  - These tests navigate directly to Rails web UI and manually expire tokens
  - They are diagnostic tools, not core functionality tests

---

## CORS Configuration

The Rails backend is configured in `config/initializers/cors.rb`:

### Development Mode (Used for Testing)

```ruby
if Rails.env.development?
  allow do
    origins '*'  # Allows all origins including chrome-extension://

    resource '*',
      headers: :any,
      methods: [:get, :post, :put, :patch, :delete, :options, :head],
      expose: ['Authorization'],
      credentials: false,
      max_age: 3600
  end
end
```

### Production Mode

```ruby
unless Rails.env.development?
  allow do
    origins(
      /chrome-extension:\/\/.*/,  # All Chrome extensions
      /moz-extension:\/\/.*/,     # All Firefox extensions
      ENV.fetch('FRONTEND_URL', 'https://ytgify.com')
    )

    resource '/api/*',
      headers: :any,
      methods: [:get, :post, :put, :patch, :delete, :options, :head],
      expose: ['Authorization'],
      credentials: true,
      max_age: 3600
  end
end
```

---

## Test Coverage

| Test | Mock Mode | Real Backend Mode |
|------|-----------|-------------------|
| Anonymous user (download only) | ✅ | ✅ |
| Authenticated upload success | ✅ | ✅ |
| Manual upload button visible | ✅ | ✅ |
| Upload failure (500 error) | ✅ | ❌ Skipped |
| Privacy settings | ✅ | ✅ |
| Token expiration (401) | ✅ | ❌ Skipped |
| Token refresh flow | ✅ | ✅ Partial |
| Refresh failure | ✅ | ❌ Skipped |

---

## Troubleshooting

### Issue: "Backend is not accessible"

**Solution:**
1. Check Rails server is running: `curl http://localhost:3000/api/v1/gifs`
2. Check for port conflicts: `lsof -i :3000`
3. Start Rails: `cd ../ytgify-share && bin/rails server`

### Issue: "CORS errors in browser console"

**Solution:**
1. Verify CORS config in `ytgify-share/config/initializers/cors.rb`
2. Restart Rails server after CORS changes
3. Check development mode is active: `echo $RAILS_ENV` should be empty or "development"

### Issue: "Tests fail with 401 Unauthorized"

**Possible causes:**
- JWT_SECRET_KEY mismatch between extension and backend
- Token expired during test execution
- Backend database not migrated (`bin/rails db:migrate`)

**Solution:**
```bash
cd ../ytgify-share
bin/rails db:migrate
bin/rails test test/models/user_test.rb  # Verify auth works
```

### Issue: "Upload succeeds but GIF not in database"

**Possible causes:**
- ActiveStorage not configured (S3 credentials missing)
- Sidekiq not processing jobs
- Database transaction rollback

**Solution:**
```bash
cd ../ytgify-share
bin/rails console
> Gif.last  # Check latest GIF
> Gif.last.file.attached?  # Check attachment
```

---

## Implementation Details

### Files Modified

1. **tests/e2e-upload/fixtures.ts**
   - Added `useRealBackend` fixture (reads `REAL_BACKEND` env var)
   - Provides boolean flag to all tests

2. **tests/e2e-upload/token-refresh-flow.spec.ts**
   - Conditionally skips route interception when `useRealBackend === true`
   - Adjusts assertions for real backend behavior
   - Skips refresh failure test in real backend mode

3. **tests/e2e-upload/upload-flow.spec.ts**
   - Skips error simulation tests in real backend mode
   - All happy-path tests work in both modes

4. **package.json**
   - Added `test:e2e:upload:real` script
   - Added `test:e2e:upload:real:headed` script

5. **scripts/start-backend-for-tests.sh**
   - Helper script to start Rails with proper configuration
   - Checks if server already running
   - Sets up database if needed

---

## Best Practices

### When to Use Real Backend Testing

- **Pre-deployment:** Validate full integration before production release
- **CORS changes:** Test CORS headers work with actual extension origins
- **API changes:** Verify backend changes don't break extension
- **Token flow:** Confirm JWT generation/refresh works end-to-end
- **Database schema changes:** Test migrations don't break functionality

### When to Use Mock Testing

- **CI/CD pipelines:** Faster, no backend dependencies
- **Unit-level E2E:** Test extension logic in isolation
- **Error scenarios:** Easy to simulate edge cases
- **Development:** Quick feedback loop during feature development

### Recommended Testing Strategy

```bash
# During development
npm run test:e2e:upload  # Mock mode (fast)

# Before committing
npm run test:e2e:upload:real  # Real backend (thorough)

# In CI/CD
npm run test:e2e:upload  # Mock mode (no backend required)
```

---

## Environment Variables

| Variable | Values | Purpose |
|----------|--------|---------|
| `REAL_BACKEND` | `true` / `false` | Enable real backend mode |
| `BACKEND_URL` | URL | Backend API URL (default: `http://localhost:3000`) |
| `HEADED` | `true` / `false` | Show browser during tests |
| `DEBUG` | `true` / `false` | Enable verbose logging |

---

## Example Test Run

```bash
$ npm run test:e2e:upload:real

> ytgify@1.0.10 test:e2e:upload:real
> REAL_BACKEND=true playwright test --config tests/playwright-upload.config.ts

[Fixtures] ⚡ REAL BACKEND MODE - Using actual Rails API at http://localhost:3000
[Fixtures] ⚠️  Ensure Rails server is running: cd ../ytgify-share && bin/rails server

[Global Setup] Checking backend at http://localhost:3000...
[Global Setup] ✓ Backend is accessible

Running 25 tests using 1 worker

✓ Anonymous user - download only, no upload UI (8.2s)
✓ Authenticated user - download + successful upload (12.5s)
✓ Authenticated user - manual upload button always visible (9.1s)
- Authenticated user - upload fails with backend error (skipped in real backend mode)
✓ Authenticated user - manual upload with private privacy setting (11.3s)
- Authenticated user - token expiration during upload (skipped in real backend mode)
✓ Token refresh flow - automatic refresh on 401 (partial) (15.8s)
- Token refresh flow - handles failure gracefully (skipped in real backend mode)

19 passed, 6 skipped (1.2m)
```

---

## Next Steps

1. **Add more real backend tests**: Implement tests that don't require mocking errors
2. **Test rate limiting**: Add tests for 429 responses (requires backend config)
3. **Test WebSocket notifications**: Validate ActionCable integration
4. **Test concurrent uploads**: Verify token refresh mutex works under load
5. **Add performance tests**: Measure real API latency vs mocks

---

**Last Updated:** 2025-11-22
**Rails Backend:** `../ytgify-share`
**API URL:** `http://localhost:3000`
**CORS Mode:** Development (allow all origins)

