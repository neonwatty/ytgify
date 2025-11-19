/**
 * Backend API Client for E2E Auth Tests
 *
 * Provides utilities for:
 * - Health checking backend
 * - Creating/verifying test users
 * - Verifying JWT tokens
 */

export interface TestUser {
  email: string;
  username: string;
  password: string;
}

export class BackendClient {
  private baseURL: string;

  constructor(baseURL: string = 'http://localhost:3000') {
    this.baseURL = baseURL;
  }

  /**
   * Check if backend is accessible
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseURL}/api/v1/auth/me`);
      // 401 is expected (no token), but shows backend is up
      return response.status === 401;
    } catch (error) {
      console.error('[BackendClient] Health check failed:', error);
      return false;
    }
  }

  /**
   * Ensure test user exists (idempotent)
   * - Tries to login first (user might exist)
   * - Creates user if login fails
   */
  async ensureTestUser(user: TestUser): Promise<void> {
    try {
      // Try to login first (user might already exist)
      const loginResponse = await fetch(`${this.baseURL}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: {
            email: user.email,
            password: user.password,
          },
        }),
      });

      if (loginResponse.ok) {
        console.log(`  ✓ Test user ${user.email} already exists`);
        return;
      }

      // User doesn't exist, create it
      const registerResponse = await fetch(`${this.baseURL}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: {
            email: user.email,
            username: user.username,
            password: user.password,
            password_confirmation: user.password,
          },
        }),
      });

      if (!registerResponse.ok) {
        const error = await registerResponse.json();
        throw new Error(`Failed to create test user: ${JSON.stringify(error)}`);
      }

      console.log(`  ✓ Created test user ${user.email}`);
    } catch (error) {
      console.error(`  ✗ Failed to ensure test user:`, error);
      throw error;
    }
  }

  /**
   * Verify if JWT token is valid
   */
  async verifyToken(token: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseURL}/api/v1/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Login with credentials and get token
   */
  async login(email: string, password: string): Promise<{
    ok: boolean;
    token?: string;
    error?: string;
  }> {
    try {
      const response = await fetch(`${this.baseURL}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: { email, password },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        return { ok: false, error: error.message || error.error };
      }

      const data = await response.json();
      return { ok: true, token: data.token };
    } catch (error) {
      return { ok: false, error: String(error) };
    }
  }

  /**
   * Register new user
   */
  async register(user: TestUser): Promise<{
    ok: boolean;
    token?: string;
    error?: string;
  }> {
    try {
      const response = await fetch(`${this.baseURL}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: {
            email: user.email,
            username: user.username,
            password: user.password,
            password_confirmation: user.password,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        return { ok: false, error: JSON.stringify(error) };
      }

      const data = await response.json();
      return { ok: true, token: data.token };
    } catch (error) {
      return { ok: false, error: String(error) };
    }
  }
}
