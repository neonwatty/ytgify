/**
 * API Client for ytgify-share Backend
 *
 * Features:
 * - JWT authentication
 * - Automatic token refresh
 * - Rate limit handling (429 responses)
 * - Retry with exponential backoff
 * - CORS-compatible
 *
 * Phase 1: Authentication endpoints
 */

import { StorageAdapter } from '@/lib/storage/storage-adapter';
import type {
  LoginResponse,
  RegisterResponse,
  TokenRefreshResponse,
  UserProfile,
  CurrentUserResponse,
  JWTPayload,
  AuthState,
  APIErrorResponse,
  UploadGifParams,
  UploadGifResponse,
  UploadedGif,
} from '@/types/auth';

/**
 * API Client class
 */
export class YtgifyApiClient {
  private baseURL: string;

  constructor() {
    // Use environment-specific API base URL
    const apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
    this.baseURL = `${apiBaseUrl}/api/v1`;

    console.log(`[ApiClient] Initialized with base URL: ${this.baseURL}`);
  }

  // ========================================
  // Authentication Methods
  // ========================================

  /**
   * Login with email and password
   * Returns JWT token and user data
   */
  async login(email: string, password: string): Promise<LoginResponse> {
    try {
      const response = await fetch(`${this.baseURL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user: { email, password },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new APIError(
          errorData.message || errorData.error || 'Login failed',
          response.status
        );
      }

      const data: LoginResponse = await response.json();

      // Decode token to get expiration
      const decoded = this.decodeToken(data.token);

      // Save auth state
      const authState: AuthState = {
        token: data.token,
        expiresAt: decoded.exp * 1000, // Convert to milliseconds
        userId: decoded.sub,
        userProfile: data.user,
      };

      await StorageAdapter.saveAuthState(authState);
      await StorageAdapter.saveUserProfile(data.user);

      console.log('[ApiClient] ✅ Login successful');

      return data;
    } catch (error) {
      console.error('[ApiClient] ❌ Login failed:', error);
      throw error;
    }
  }

  /**
   * Register new user
   * Opens web app for full signup flow (simplified version)
   */
  async register(
    email: string,
    username: string,
    password: string
  ): Promise<RegisterResponse> {
    try {
      const response = await fetch(`${this.baseURL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user: {
            email,
            username,
            password,
            password_confirmation: password,
          },
        }),
      });

      if (!response.ok) {
        const errorData: APIErrorResponse = await response.json().catch(() => ({}));
        throw new APIError(
          errorData.details?.join(', ') || errorData.error || 'Registration failed',
          response.status
        );
      }

      const data: RegisterResponse = await response.json();

      // Decode token to get expiration
      const decoded = this.decodeToken(data.token);

      // Save auth state
      const authState: AuthState = {
        token: data.token,
        expiresAt: decoded.exp * 1000, // Convert to milliseconds
        userId: decoded.sub,
        userProfile: data.user,
      };

      await StorageAdapter.saveAuthState(authState);
      await StorageAdapter.saveUserProfile(data.user);

      console.log('[ApiClient] ✅ Registration successful');

      return data;
    } catch (error) {
      console.error('[ApiClient] ❌ Registration failed:', error);
      throw error;
    }
  }

  /**
   * Logout - revoke token on backend
   */
  async logout(): Promise<void> {
    try {
      // Try to revoke token on backend (best effort)
      await this.authenticatedRequest('/auth/logout', {
        method: 'DELETE',
      }).catch((error) => {
        console.warn('[ApiClient] Backend logout failed (non-critical):', error);
      });

      // Always clear local auth data
      await StorageAdapter.clearAllAuthData();

      console.log('[ApiClient] ✅ Logout successful');
    } catch (error) {
      console.error('[ApiClient] ❌ Logout failed:', error);

      // Still clear local data even if backend call fails
      await StorageAdapter.clearAllAuthData();

      throw error;
    }
  }

  /**
   * Refresh JWT token
   * Returns new token with extended expiration
   */
  async refreshToken(): Promise<string> {
    try {
      const response = await this.authenticatedRequest('/auth/refresh', {
        method: 'POST',
      });

      const data: TokenRefreshResponse = await response.json();

      // Decode new token
      const decoded = this.decodeToken(data.token);

      // Update auth state with new token
      const authState = await StorageAdapter.getAuthState();

      if (authState) {
        authState.token = data.token;
        authState.expiresAt = decoded.exp * 1000;
        await StorageAdapter.saveAuthState(authState);
      }

      console.log('[ApiClient] ✅ Token refreshed successfully');

      return data.token;
    } catch (error) {
      console.error('[ApiClient] ❌ Token refresh failed:', error);

      // If refresh fails, clear auth state
      await StorageAdapter.clearAllAuthData();

      throw error;
    }
  }

  /**
   * Get current user profile from backend
   */
  async getCurrentUser(): Promise<UserProfile> {
    try {
      const response = await this.authenticatedRequest('/auth/me');
      const data: CurrentUserResponse = await response.json();

      // Update cached profile
      await StorageAdapter.saveUserProfile(data.user);

      console.log('[ApiClient] ✅ User profile fetched');

      return data.user;
    } catch (error) {
      console.error('[ApiClient] ❌ Failed to fetch user profile:', error);
      throw error;
    }
  }

  // ========================================
  // GIF Upload Methods (Phase 2)
  // ========================================

  /**
   * Upload GIF to backend
   *
   * Sends GIF file + metadata to POST /api/v1/gifs
   * Backend extracts final metadata via GifProcessingJob
   *
   * @param params - Upload parameters (file, title, YouTube metadata)
   * @returns Uploaded GIF data from backend
   * @throws APIError on upload failure
   * @throws AuthError if not authenticated
   */
  async uploadGif(params: UploadGifParams): Promise<UploadedGif> {
    try {
      console.log('[ApiClient] 📤 Uploading GIF:', params.title);

      // Build FormData for multipart upload
      const formData = new FormData();

      // Required fields
      formData.append('gif[file]', params.file, 'ytgify.gif');
      formData.append('gif[title]', params.title);
      formData.append('gif[youtube_video_url]', params.youtubeUrl);
      formData.append('gif[youtube_timestamp_start]', params.timestampStart.toString());
      formData.append('gif[youtube_timestamp_end]', params.timestampEnd.toString());

      // Optional fields
      if (params.description) {
        formData.append('gif[description]', params.description);
      }

      if (params.privacy) {
        formData.append('gif[privacy]', params.privacy);
      } else {
        formData.append('gif[privacy]', 'public_access'); // Default
      }

      if (params.youtubeVideoTitle) {
        formData.append('gif[youtube_video_title]', params.youtubeVideoTitle);
      }

      if (params.youtubeChannelName) {
        formData.append('gif[youtube_channel_name]', params.youtubeChannelName);
      }

      // Text overlay
      if (params.hasTextOverlay) {
        formData.append('gif[has_text_overlay]', 'true');
        if (params.textOverlayData) {
          formData.append('gif[text_overlay_data]', params.textOverlayData);
        }
      }

      // Social features (Phase 3)
      if (params.parentGifId) {
        formData.append('gif[parent_gif_id]', params.parentGifId);
      }

      if (params.hashtagNames && params.hashtagNames.length > 0) {
        params.hashtagNames.forEach((tag) => {
          formData.append('gif[hashtag_names][]', tag);
        });
      }

      // Upload with retry (handles rate limiting)
      const response = await this.authenticatedRequestWithRetry('/gifs', {
        method: 'POST',
        body: formData,
        // Don't set Content-Type - browser sets with boundary for FormData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new APIError(
          errorData.error || errorData.message || 'GIF upload failed',
          response.status
        );
      }

      const data: UploadGifResponse = await response.json();

      // Convert relative paths to absolute URLs
      const baseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
      if (data.gif.file_url && !data.gif.file_url.startsWith('http')) {
        data.gif.file_url = `${baseUrl}${data.gif.file_url}`;
      }
      if (data.gif.thumbnail_url && !data.gif.thumbnail_url.startsWith('http')) {
        data.gif.thumbnail_url = `${baseUrl}${data.gif.thumbnail_url}`;
      }

      console.log('[ApiClient] ✅ GIF uploaded successfully:', data.gif.id);

      return data.gif;
    } catch (error) {
      console.error('[ApiClient] ❌ GIF upload failed:', error);
      throw error;
    }
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    const authState = await StorageAdapter.getAuthState();

    if (!authState) {
      return false;
    }

    // Check if token is expired
    const now = Date.now();
    if (now >= authState.expiresAt) {
      // Token expired, clear auth
      await StorageAdapter.clearAllAuthData();
      return false;
    }

    return true;
  }

  // ========================================
  // Authenticated Requests
  // ========================================

  /**
   * Make authenticated request with automatic error handling
   */
  async authenticatedRequest(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const authState = await StorageAdapter.getAuthState();

    if (!authState || !authState.token) {
      throw new AuthError('Not authenticated');
    }

    // Check if token is expired
    const now = Date.now();
    if (now >= authState.expiresAt) {
      // Token expired, try to refresh
      console.log('[ApiClient] Token expired, attempting refresh...');

      try {
        await this.refreshToken();
        // Retry with new token
        return this.authenticatedRequest(endpoint, options);
      } catch (error) {
        // Refresh failed, clear auth
        await StorageAdapter.clearAllAuthData();
        throw new AuthError('Session expired. Please login again.');
      }
    }

    // Build headers - don't set Content-Type for FormData (browser sets with boundary)
    const headers: HeadersInit = {
      ...options.headers,
      Authorization: `Bearer ${authState.token}`,
    };

    // Only set Content-Type for non-FormData requests
    if (!(options.body instanceof FormData)) {
      (headers as Record<string, string>)['Content-Type'] = 'application/json';
    }

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers,
    });

    // Handle 401 Unauthorized (token invalid or revoked)
    if (response.status === 401) {
      console.warn('[ApiClient] 401 Unauthorized - clearing auth state');
      await StorageAdapter.clearAllAuthData();
      throw new AuthError('Authentication failed. Please login again.');
    }

    return response;
  }

  /**
   * Make authenticated request WITH retry and rate limit handling
   */
  async authenticatedRequestWithRetry(
    endpoint: string,
    options: RequestInit = {},
    maxRetries: number = 3
  ): Promise<Response> {
    let attempts = 0;

    while (attempts < maxRetries) {
      try {
        const response = await this.authenticatedRequest(endpoint, options);

        // Handle 429 Rate Limited
        if (response.status === 429) {
          const retryAfter = this.getRetryAfter(response);

          console.warn(`[ApiClient] ⏱️ Rate limited. Retrying after ${retryAfter}s`);

          // Notify user via message
          chrome.runtime.sendMessage({
            type: 'RATE_LIMITED',
            retryAfter,
          });

          // Wait for retry period
          await this.sleep(retryAfter * 1000);

          attempts++;
          continue;
        }

        // Success or non-retryable error
        return response;
      } catch (error) {
        if (error instanceof AuthError) {
          // Don't retry auth errors
          throw error;
        }

        attempts++;

        if (attempts >= maxRetries) {
          throw error;
        }

        // Exponential backoff for network errors
        const backoff = Math.pow(2, attempts) * 1000;
        console.warn(`[ApiClient] ⏱️ Request failed. Retrying in ${backoff}ms...`);
        await this.sleep(backoff);
      }
    }

    throw new Error(`Max retries (${maxRetries}) exceeded`);
  }

  // ========================================
  // Helper Methods
  // ========================================

  /**
   * Get Retry-After header from 429 response
   */
  private getRetryAfter(response: Response): number {
    const retryAfter = response.headers.get('Retry-After');
    return retryAfter ? parseInt(retryAfter, 10) : 60; // Default 60 seconds
  }

  /**
   * Sleep helper for delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Decode JWT without verification (read payload only)
   * IMPORTANT: This does NOT verify the token signature!
   */
  decodeToken(token: string): JWTPayload {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid JWT format');
      }

      const payload = parts[1];
      const decoded = JSON.parse(atob(payload));

      return {
        sub: decoded.sub,
        jti: decoded.jti,
        exp: decoded.exp,
      };
    } catch (error) {
      console.error('[ApiClient] Failed to decode token:', error);
      throw new Error('Invalid JWT token');
    }
  }
}

// ========================================
// Error Classes
// ========================================

/**
 * Generic API error
 */
export class APIError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = 'APIError';
  }
}

/**
 * Authentication error (401, expired token, etc.)
 */
export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * Rate limit error (429)
 */
export class RateLimitError extends Error {
  constructor(
    message: string,
    public retryAfter: number
  ) {
    super(message);
    this.name = 'RateLimitError';
  }
}

// ========================================
// Singleton Instance
// ========================================

/**
 * Singleton API client instance
 * Import this in other modules
 */
export const apiClient = new YtgifyApiClient();
