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
  GifListResponse,
  LikeResponse,
} from '@/types/auth';

/**
 * API Client class
 */
export class YtgifyApiClient {
  private baseURL: string;

  // Mutex to prevent concurrent token refresh requests (race condition fix)
  private static refreshInProgress: Promise<string> | null = null;

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
    // Check if a refresh is already in progress (mutex pattern to prevent race conditions)
    if (YtgifyApiClient.refreshInProgress) {
      console.log('[ApiClient] Token refresh already in progress, waiting...');
      return YtgifyApiClient.refreshInProgress;
    }

    // Create new refresh promise and store it as mutex
    YtgifyApiClient.refreshInProgress = this._performTokenRefresh();

    try {
      const token = await YtgifyApiClient.refreshInProgress;
      return token;
    } finally {
      // Always clear the mutex, even if refresh failed
      YtgifyApiClient.refreshInProgress = null;
    }
  }

  /**
   * Internal method that performs the actual token refresh
   * Called by refreshToken() with mutex protection
   */
  private async _performTokenRefresh(): Promise<string> {
    // Capture auth state BEFORE making request to prevent race conditions
    const currentAuthState = await StorageAdapter.getAuthState();

    if (!currentAuthState || !currentAuthState.token) {
      throw new AuthError('No auth state to refresh');
    }

    try {
      const response = await this.authenticatedRequest('/auth/refresh', {
        method: 'POST',
      }, true); // Pass true to skip expiration check (avoid recursion)

      const data: TokenRefreshResponse = await response.json();

      // Decode new token
      const decoded = this.decodeToken(data.token);

      // Update auth state with new token
      // Re-fetch to ensure we have latest state, but create new if missing
      const authState = await StorageAdapter.getAuthState();

      if (!authState) {
        console.warn('[ApiClient] ⚠️ Auth state cleared during refresh, recreating...');
        // Recreate auth state with new token
        const newAuthState = {
          token: data.token,
          expiresAt: decoded.exp * 1000,
          userId: decoded.sub,
          userProfile: null,
        };
        await StorageAdapter.saveAuthState(newAuthState);
      } else {
        // Update existing auth state (create new object instead of mutating)
        const updatedAuthState = {
          ...authState,
          token: data.token,
          expiresAt: decoded.exp * 1000,
        };
        await StorageAdapter.saveAuthState(updatedAuthState);
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

      // Helper to build fresh FormData (needed for retries since FormData streams are consumed)
      const buildFormData = (): FormData => {
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

        return formData;
      };

      // Upload with retry (handles rate limiting)
      // Must recreate FormData on each attempt since body streams are consumed
      let attempts = 0;
      const maxRetries = 3;
      let lastError: Error | undefined;

      while (attempts < maxRetries) {
        try {
          const formData = buildFormData();
          const response = await this.authenticatedRequest('/gifs', {
            method: 'POST',
            body: formData,
            // Don't set Content-Type - browser sets with boundary for FormData
          });

          // Handle 429 Rate Limited
          if (response.status === 429) {
            const retryAfter = this.getRetryAfter(response);
            console.warn(`[ApiClient] ⏱️ Rate limited. Retrying after ${retryAfter}s`);

            // Notify user via message (best-effort)
            try {
              chrome.runtime.sendMessage({
                type: 'RATE_LIMITED',
                retryAfter,
              });
            } catch (err) {
              console.debug('[ApiClient] Could not send rate limit message:', err);
            }

            // Wait for retry period
            await this.sleep(retryAfter * 1000);
            attempts++;
            continue;
          }

          // Success or non-retryable error - process response
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
          if (error instanceof AuthError) {
            // Don't retry auth errors
            throw error;
          }

          lastError = error as Error;
          attempts++;

          if (attempts >= maxRetries) {
            break;
          }

          // Exponential backoff for network errors
          const backoff = Math.pow(2, attempts) * 1000;
          console.warn(`[ApiClient] ⏱️ Request failed. Retrying in ${backoff}ms...`);
          await this.sleep(backoff);
        }
      }

      // All retries exhausted
      throw lastError || new Error(`Max retries (${maxRetries}) exceeded`);
    } catch (error) {
      console.error('[ApiClient] ❌ GIF upload failed:', error);
      throw error;
    }
  }

  // ========================================
  // Phase 3: Social Features Methods
  // ========================================

  /**
   * Get user's GIFs
   * Fetches GIFs uploaded by the current user
   *
   * @param page - Page number (default: 1)
   * @param perPage - Results per page (default: 20)
   * @returns GIF list with pagination
   */
  async getMyGifs(page: number = 1, perPage: number = 20): Promise<GifListResponse> {
    try {
      const authState = await StorageAdapter.getAuthState();
      if (!authState || !authState.userId) {
        throw new AuthError('Not authenticated');
      }

      console.log('[ApiClient] 📋 Fetching my GIFs...');

      const params = new URLSearchParams({
        user_id: authState.userId,
        page: page.toString(),
        per_page: perPage.toString(),
      });

      const response = await this.authenticatedRequestWithRetry(
        `/gifs?${params.toString()}`,
        {
          method: 'GET',
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new APIError(
          errorData.error || 'Failed to fetch GIFs',
          response.status
        );
      }

      const data: GifListResponse = await response.json();

      console.log('[ApiClient] ✅ Fetched', data.gifs.length, 'GIFs');

      return data;
    } catch (error) {
      console.error('[ApiClient] ❌ Failed to fetch my GIFs:', error);
      throw error;
    }
  }

  /**
   * Get trending GIFs
   * Fetches popular GIFs from the feed
   *
   * @param page - Page number (default: 1)
   * @param perPage - Results per page (default: 20)
   * @returns GIF list with pagination
   */
  async getTrendingGifs(page: number = 1, perPage: number = 20): Promise<GifListResponse> {
    try {
      console.log('[ApiClient] 🔥 Fetching trending GIFs...');

      const params = new URLSearchParams({
        page: page.toString(),
        per_page: perPage.toString(),
      });

      const response = await this.authenticatedRequestWithRetry(
        `/feed/trending?${params.toString()}`,
        {
          method: 'GET',
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new APIError(
          errorData.error || 'Failed to fetch trending GIFs',
          response.status
        );
      }

      const data: GifListResponse = await response.json();

      console.log('[ApiClient] ✅ Fetched', data.gifs.length, 'trending GIFs');

      return data;
    } catch (error) {
      console.error('[ApiClient] ❌ Failed to fetch trending GIFs:', error);
      throw error;
    }
  }

  /**
   * Toggle like on a GIF
   * If GIF is already liked, unlikes it. If not liked, likes it.
   *
   * @param gifId - GIF UUID to like/unlike
   * @returns Like response with new like count
   */
  async toggleLike(gifId: string): Promise<LikeResponse> {
    try {
      console.log('[ApiClient] ❤️ Toggling like for GIF:', gifId);

      const response = await this.authenticatedRequestWithRetry(
        `/gifs/${gifId}/likes`,
        {
          method: 'POST',
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new APIError(
          errorData.error || 'Failed to toggle like',
          response.status
        );
      }

      const data: LikeResponse = await response.json();

      console.log(
        `[ApiClient] ✅ Like ${data.liked ? 'added' : 'removed'} - new count: ${data.like_count}`
      );

      return data;
    } catch (error) {
      console.error('[ApiClient] ❌ Failed to toggle like:', error);
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
   * @param skipExpirationCheck - Set to true to skip token refresh (used internally by refreshToken)
   */
  async authenticatedRequest(
    endpoint: string,
    options: RequestInit = {},
    skipExpirationCheck: boolean = false,
    attemptedRefreshOn401: boolean = false
  ): Promise<Response> {
    const authState = await StorageAdapter.getAuthState();

    if (!authState || !authState.token) {
      throw new AuthError('Not authenticated');
    }

    // Check if token is expired or expiring soon (unless skipping check)
    if (!skipExpirationCheck) {
      const now = Date.now();
      const REFRESH_THRESHOLD = 5 * 60 * 1000; // 5 minutes in milliseconds
      const timeUntilExpiry = authState.expiresAt - now;

      // Refresh if token is expired OR will expire within 5 minutes
      if (timeUntilExpiry < REFRESH_THRESHOLD) {
        const minutesRemaining = Math.max(0, Math.floor(timeUntilExpiry / 1000 / 60));

        if (timeUntilExpiry < 0) {
          console.log('[ApiClient] Token expired, attempting refresh...');
        } else {
          console.log(`[ApiClient] Token expires in ${minutesRemaining} minute(s), refreshing proactively...`);
        }

        try {
          await this.refreshToken();
          // Retry with new token - pass skipExpirationCheck to prevent infinite recursion
          return this.authenticatedRequest(endpoint, options, true, false);
        } catch (error) {
          // Refresh failed, clear auth
          await StorageAdapter.clearAllAuthData();
          throw new AuthError('Session expired. Please login again.');
        }
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

    // Handle 401 Unauthorized with refresh-and-retry logic
    // BUT: Don't attempt refresh if skipExpirationCheck is true (we're already IN a refresh call)
    if (response.status === 401) {
      // If skipExpirationCheck is true, we're IN the refresh flow - don't retry, just fail
      if (skipExpirationCheck) {
        console.warn('[ApiClient] 401 during refresh request - auth failed');
        await StorageAdapter.clearAllAuthData();
        throw new AuthError('Token refresh failed. Please login again.');
      }

      // Only attempt refresh ONCE to prevent infinite loops
      if (!attemptedRefreshOn401) {
        console.warn('[ApiClient] 401 Unauthorized - attempting token refresh...');

        try {
          // Refresh token
          await this.refreshToken();
          console.log('[ApiClient] Token refreshed successfully, retrying request...');

          // Retry original request with new token
          // Pass attemptedRefreshOn401=true to prevent infinite retry loop
          return this.authenticatedRequest(endpoint, options, true, true);
        } catch (refreshError) {
          // Refresh failed - now we clear auth state
          console.error('[ApiClient] Token refresh failed after 401:', refreshError);
          await StorageAdapter.clearAllAuthData();
          throw new AuthError('Session expired. Please login again.');
        }
      } else {
        // Already tried refresh, still getting 401 - clear auth
        console.warn('[ApiClient] 401 Unauthorized after refresh attempt - clearing auth state');
        await StorageAdapter.clearAllAuthData();
        throw new AuthError('Authentication failed. Please login again.');
      }
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

          // Notify user via message (best-effort, don't fail if unavailable)
          try {
            chrome.runtime.sendMessage({
              type: 'RATE_LIMITED',
              retryAfter,
            });
          } catch (err) {
            console.debug('[ApiClient] Could not send rate limit message:', err);
          }

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
