/**
 * API Connectivity Test
 *
 * Purpose: Verify basic connectivity between extension and backend API
 * Scope: Phase 0 baseline - tests network connectivity and CORS only
 * Does NOT test: Authentication, JWT tokens, or business logic
 *
 * Run: npm test -- tests/integration/api-connectivity.test.ts
 */

describe('API Connectivity', () => {
  const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

  beforeAll(() => {
    console.log(`[API Connectivity Test] Testing against: ${API_BASE_URL}`);
  });

  describe('Backend Health Check', () => {
    it('should reach backend server', async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/up`);

        expect(response).toBeDefined();
        expect(response.status).toBeLessThan(500);

        console.log(`[API Connectivity Test] Backend responded with status: ${response.status}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[API Connectivity Test] Backend unreachable: ${errorMessage}`);

        throw new Error(
          `Backend server is not reachable at ${API_BASE_URL}. ` +
            `Ensure Rails server is running: cd ../ytgify-share && bin/dev`
        );
      }
    });

    it('should receive CORS headers on preflight request', async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/up`, {
          method: 'OPTIONS',
          headers: {
            Origin: 'chrome-extension://test',
            'Access-Control-Request-Method': 'GET',
            'Access-Control-Request-Headers': 'Authorization',
          },
        });

        const corsHeaders = {
          'Access-Control-Allow-Origin': response.headers.get('Access-Control-Allow-Origin'),
          'Access-Control-Allow-Methods': response.headers.get('Access-Control-Allow-Methods'),
          'Access-Control-Allow-Headers': response.headers.get('Access-Control-Allow-Headers'),
        };

        console.log('[API Connectivity Test] CORS headers:', corsHeaders);

        expect(corsHeaders['Access-Control-Allow-Origin']).toBeDefined();

        // Note: Backend may allow all origins (*) in development
        // In production, this should be a whitelist of extension IDs
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[API Connectivity Test] CORS check failed: ${errorMessage}`);

        throw new Error(
          `CORS preflight request failed. Backend CORS may not be configured correctly.`
        );
      }
    });
  });

  describe('API Endpoint Discovery', () => {
    it('should have JWT auth endpoints available', async () => {
      // Test that auth endpoints exist (expect 4xx, not 404)
      const endpoints = [
        { path: '/api/v1/auth/login', method: 'POST' },
        { path: '/api/v1/auth/register', method: 'POST' },
      ];

      for (const endpoint of endpoints) {
        try {
          const response = await fetch(`${API_BASE_URL}${endpoint.path}`, {
            method: endpoint.method,
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({}), // Empty body - should get validation error, not 404
          });

          console.log(
            `[API Connectivity Test] ${endpoint.method} ${endpoint.path}: ${response.status}`
          );

          // Expect 4xx (validation error), not 404 (not found)
          expect(response.status).toBeGreaterThanOrEqual(400);
          expect(response.status).toBeLessThan(500);
          expect(response.status).not.toBe(404);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error(
            `[API Connectivity Test] ${endpoint.method} ${endpoint.path} failed: ${errorMessage}`
          );

          throw new Error(`Endpoint ${endpoint.path} is not reachable`);
        }
      }
    });

    it('should have GIF endpoints available', async () => {
      // Test that GIF endpoints exist (expect 401 without auth, not 404)
      const endpoint = '/api/v1/gifs';

      try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        console.log(`[API Connectivity Test] GET ${endpoint}: ${response.status}`);

        // Expect 200 (public GIFs) or 401 (requires auth), not 404
        expect(response.status).toBeLessThan(500);
        expect(response.status).not.toBe(404);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[API Connectivity Test] GET ${endpoint} failed: ${errorMessage}`);

        throw new Error(`Endpoint ${endpoint} is not reachable`);
      }
    });
  });

  describe('Response Format', () => {
    it('should return JSON responses', async () => {
      try {
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

        console.log(`[API Connectivity Test] Content-Type: ${contentType}`);

        expect(contentType).toContain('application/json');

        // Verify we can parse JSON
        const data = await response.json();
        expect(data).toBeDefined();
        expect(typeof data).toBe('object');

        console.log('[API Connectivity Test] JSON response structure:', Object.keys(data));
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[API Connectivity Test] JSON parsing failed: ${errorMessage}`);

        throw new Error(`Backend is not returning valid JSON responses`);
      }
    });
  });

  describe('Network Timeout', () => {
    it('should respond within reasonable time (< 5 seconds)', async () => {
      const startTime = Date.now();

      try {
        await fetch(`${API_BASE_URL}/up`);

        const duration = Date.now() - startTime;

        console.log(`[API Connectivity Test] Response time: ${duration}ms`);

        expect(duration).toBeLessThan(5000);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[API Connectivity Test] Timeout test failed: ${errorMessage}`);

        throw error;
      }
    });
  });
});
