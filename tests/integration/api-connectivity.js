/**
 * API Connectivity Test (Standalone)
 *
 * Purpose: Verify basic connectivity between extension and backend API
 * Scope: Phase 0 baseline - tests network connectivity and CORS only
 * Does NOT test: Authentication, JWT tokens, or business logic
 *
 * Run: node tests/integration/api-connectivity.js
 */

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

console.log(`\n[API Connectivity Test] Testing against: ${API_BASE_URL}\n`);

let testsRun = 0;
let testsPassed = 0;
let testsFailed = 0;

async function test(name, fn) {
  testsRun++;
  try {
    await fn();
    testsPassed++;
    console.log(`✅ ${name}`);
    return true;
  } catch (error) {
    testsFailed++;
    console.error(`❌ ${name}`);
    console.error(`   Error: ${error.message}`);
    return false;
  }
}

async function testBackendHealth() {
  await test('Backend server should be reachable', async () => {
    const response = await fetch(`${API_BASE_URL}/up`);

    if (!response) {
      throw new Error('No response from server');
    }

    if (response.status >= 500) {
      throw new Error(`Server error: ${response.status}`);
    }

    console.log(`   Status: ${response.status}`);
  });
}

async function testCORS() {
  await test('Backend should return CORS headers', async () => {
    const response = await fetch(`${API_BASE_URL}/up`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'chrome-extension://test',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'Authorization',
      },
    });

    const allowOrigin = response.headers.get('Access-Control-Allow-Origin');

    if (!allowOrigin) {
      throw new Error('No Access-Control-Allow-Origin header found');
    }

    console.log(`   Access-Control-Allow-Origin: ${allowOrigin}`);
    console.log(
      `   Access-Control-Allow-Methods: ${response.headers.get('Access-Control-Allow-Methods')}`
    );
  });
}

async function testAuthEndpoints() {
  await test('Auth endpoints should exist (login)', async () => {
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    if (response.status === 404) {
      throw new Error('Endpoint not found (404)');
    }

    if (response.status >= 500) {
      throw new Error(`Server error: ${response.status}`);
    }

    console.log(`   Status: ${response.status} (expected 4xx validation error)`);
  });

  await test('Auth endpoints should exist (register)', async () => {
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    if (response.status === 404) {
      throw new Error('Endpoint not found (404)');
    }

    if (response.status >= 500) {
      throw new Error(`Server error: ${response.status}`);
    }

    console.log(`   Status: ${response.status} (expected 4xx validation error)`);
  });
}

async function testGIFEndpoints() {
  await test('GIF endpoints should exist', async () => {
    const response = await fetch(`${API_BASE_URL}/api/v1/gifs`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (response.status === 404) {
      throw new Error('Endpoint not found (404)');
    }

    if (response.status >= 500) {
      throw new Error(`Server error: ${response.status}`);
    }

    console.log(`   Status: ${response.status} (expected 200 or 401)`);
  });
}

async function testJSONResponse() {
  await test('Backend should return JSON responses', async () => {
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user: {
          email: 'nonexistent@example.com',
          password: 'wrong',
        },
      }),
    });

    const contentType = response.headers.get('Content-Type');

    if (!contentType || !contentType.includes('application/json')) {
      throw new Error(`Expected JSON, got: ${contentType}`);
    }

    const data = await response.json();

    if (!data || typeof data !== 'object') {
      throw new Error('Response is not valid JSON object');
    }

    console.log(`   Response keys: ${Object.keys(data).join(', ')}`);
  });
}

async function testResponseTime() {
  await test('Backend should respond quickly (< 5 seconds)', async () => {
    const startTime = Date.now();

    await fetch(`${API_BASE_URL}/up`);

    const duration = Date.now() - startTime;

    if (duration >= 5000) {
      throw new Error(`Response time too slow: ${duration}ms`);
    }

    console.log(`   Response time: ${duration}ms`);
  });
}

async function runAllTests() {
  try {
    await testBackendHealth();
    await testCORS();
    await testAuthEndpoints();
    await testGIFEndpoints();
    await testJSONResponse();
    await testResponseTime();
  } catch (error) {
    console.error(`\n❌ Fatal error: ${error.message}`);
    process.exit(1);
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log(`Tests run: ${testsRun}`);
  console.log(`✅ Passed: ${testsPassed}`);
  console.log(`❌ Failed: ${testsFailed}`);
  console.log(`${'='.repeat(50)}\n`);

  if (testsFailed > 0) {
    console.error(
      `❌ ${testsFailed} test(s) failed. Ensure backend is running: cd ../ytgify-share && bin/dev\n`
    );
    process.exit(1);
  }

  console.log(`✅ All API connectivity tests passed!\n`);
  process.exit(0);
}

runAllTests().catch((error) => {
  console.error(`\n❌ Unhandled error: ${error.message}\n`);
  process.exit(1);
});
