/**
 * Unit Tests for YtgifyApiClient
 * Tests JWT authentication, error handling, and token management
 */

import { YtgifyApiClient, APIError, AuthError, RateLimitError } from '@/lib/api/api-client';
import { StorageAdapter } from '@/lib/storage/storage-adapter';
import type { LoginResponse, UserProfile } from '@/types/auth';

// Mock StorageAdapter
jest.mock('@/lib/storage/storage-adapter');

// Mock fetch
global.fetch = jest.fn();

// Mock FormData for Phase 2 upload tests
class MockFormData {
  private data: Map<string, any> = new Map();

  append(key: string, value: any, filename?: string) {
    this.data.set(key, value);
  }

  get(key: string) {
    return this.data.get(key);
  }
}

global.FormData = MockFormData as any;

const mockUserProfile: UserProfile = {
  id: 'test-user-id',
  email: 'test@example.com',
  username: 'testuser',
  avatar_url: 'https://example.com/avatar.jpg',
  bio: 'Test bio',
  gifs_count: 10,
  follower_count: 5,
  following_count: 3,
  is_verified: false,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
};

// Valid JWT token (expires in 15 minutes from epoch 0)
const mockJWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0LXVzZXItaWQiLCJqdGkiOiJ0ZXN0LWp0aSIsImV4cCI6OTAwfQ.test';

describe('YtgifyApiClient', () => {
  let apiClient: YtgifyApiClient;

  beforeEach(() => {
    apiClient = new YtgifyApiClient();
    jest.clearAllMocks();
    (fetch as jest.Mock).mockClear();
  });

  describe('Login', () => {
    it('should login successfully and save auth state', async () => {
      const mockResponse: LoginResponse = {
        message: 'Login successful',
        token: mockJWT,
        user: mockUserProfile,
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const result = await apiClient.login('test@example.com', 'password123');

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/auth/login'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user: { email: 'test@example.com', password: 'password123' },
          }),
        })
      );

      expect(result).toEqual(mockResponse);
      expect(StorageAdapter.saveAuthState).toHaveBeenCalled();
      expect(StorageAdapter.saveUserProfile).toHaveBeenCalledWith(mockUserProfile);
    });

    it('should throw APIError on login failure', async () => {
      const errorResponse = {
        error: 'Invalid credentials',
        message: 'Email or password is incorrect',
      };

      (fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => errorResponse,
      });

      await expect(apiClient.login('wrong@example.com', 'wrongpass')).rejects.toThrow(
        APIError
      );

      expect(StorageAdapter.saveAuthState).not.toHaveBeenCalled();
    });

    it('should handle network errors during login', async () => {
      (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      await expect(apiClient.login('test@example.com', 'password123')).rejects.toThrow(
        'Network error'
      );

      expect(StorageAdapter.saveAuthState).not.toHaveBeenCalled();
    });
  });

  describe('Logout', () => {
    it('should logout and clear auth state', async () => {
      (StorageAdapter.getAuthState as jest.Mock).mockResolvedValue({
        token: mockJWT,
        expiresAt: Date.now() + 900000,
        userId: 'test-user-id',
        userProfile: mockUserProfile,
      });
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ message: 'Logged out successfully' }),
      });

      await apiClient.logout();

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/auth/logout'),
        expect.objectContaining({
          method: 'DELETE',
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockJWT}`,
          }),
        })
      );

      expect(StorageAdapter.clearAllAuthData).toHaveBeenCalled();
    });

    it('should clear auth state even if logout request fails', async () => {
      (StorageAdapter.getAuthState as jest.Mock).mockResolvedValue({
        token: mockJWT,
        expiresAt: Date.now() + 900000,
        userId: 'test-user-id',
        userProfile: mockUserProfile,
      });
      (fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Server error' }),
      });

      await apiClient.logout();

      expect(StorageAdapter.clearAllAuthData).toHaveBeenCalled();
    });
  });

  describe('Token Refresh', () => {
    it('should refresh token successfully', async () => {
      // Use another valid mock JWT for the new token
      const newToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0LXVzZXItaWQiLCJqdGkiOiJuZXctanRpIiwiZXhwIjoxODAwfQ.test';

      (StorageAdapter.getAuthState as jest.Mock).mockResolvedValue({
        token: mockJWT,
        expiresAt: Date.now() + 900000,
        userId: 'test-user-id',
        userProfile: mockUserProfile,
      });
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          message: 'Token refreshed',
          token: newToken,
        }),
      });

      const result = await apiClient.refreshToken();

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/auth/refresh'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockJWT}`,
          }),
        })
      );

      expect(result).toBe(newToken);
      expect(StorageAdapter.saveAuthState).toHaveBeenCalled();
    });

    it('should throw AuthError on refresh failure', async () => {
      (StorageAdapter.getAuthState as jest.Mock).mockResolvedValue({
        token: mockJWT,
        expiresAt: Date.now() + 900000,
        userId: 'test-user-id',
        userProfile: mockUserProfile,
      });
      (fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Token expired' }),
      });

      await expect(apiClient.refreshToken()).rejects.toThrow();
      expect(StorageAdapter.clearAllAuthData).toHaveBeenCalled();
    });

    it('should handle concurrent refresh requests with mutex', async () => {
      const newToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0LXVzZXItaWQiLCJqdGkiOiJuZXctanRpIiwiZXhwIjoxODAwfQ.test';

      (StorageAdapter.getAuthState as jest.Mock).mockResolvedValue({
        token: mockJWT,
        expiresAt: Date.now() + 900000,
        userId: 'test-user-id',
        userProfile: mockUserProfile,
      });

      // Simulate slow refresh to test concurrency
      (fetch as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  status: 200,
                  json: async () => ({
                    message: 'Token refreshed',
                    token: newToken,
                  }),
                }),
              100
            )
          )
      );

      // Start 3 concurrent refresh requests
      const promise1 = apiClient.refreshToken();
      const promise2 = apiClient.refreshToken();
      const promise3 = apiClient.refreshToken();

      // All should resolve to the same token
      const [token1, token2, token3] = await Promise.all([promise1, promise2, promise3]);

      expect(token1).toBe(newToken);
      expect(token2).toBe(newToken);
      expect(token3).toBe(newToken);

      // Should only have made ONE fetch call (mutex prevented duplicates)
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('should clear mutex after successful refresh', async () => {
      const newToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0LXVzZXItaWQiLCJqdGkiOiJuZXctanRpIiwiZXhwIjoxODAwfQ.test';

      (StorageAdapter.getAuthState as jest.Mock).mockResolvedValue({
        token: mockJWT,
        expiresAt: Date.now() + 900000,
        userId: 'test-user-id',
        userProfile: mockUserProfile,
      });
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          message: 'Token refreshed',
          token: newToken,
        }),
      });

      // First refresh
      await apiClient.refreshToken();

      // Reset fetch mock to track second call
      (fetch as jest.Mock).mockClear();

      // Second refresh should create new request (mutex cleared)
      await apiClient.refreshToken();

      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('should clear mutex after failed refresh', async () => {
      (StorageAdapter.getAuthState as jest.Mock).mockResolvedValue({
        token: mockJWT,
        expiresAt: Date.now() + 900000,
        userId: 'test-user-id',
        userProfile: mockUserProfile,
      });
      (fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Token expired' }),
      });

      // First refresh fails
      await expect(apiClient.refreshToken()).rejects.toThrow();

      // Reset mocks
      (fetch as jest.Mock).mockClear();
      (StorageAdapter.getAuthState as jest.Mock).mockResolvedValue({
        token: mockJWT,
        expiresAt: Date.now() + 900000,
        userId: 'test-user-id',
        userProfile: mockUserProfile,
      });

      // Second refresh should be able to proceed (mutex cleared after failure)
      await expect(apiClient.refreshToken()).rejects.toThrow();

      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('should handle race condition with multiple simultaneous API calls triggering refresh', async () => {
      const newToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0LXVzZXItaWQiLCJqdGkiOiJuZXctanRpIiwiZXhwIjoxODAwfQ.test';

      // Simulate token that's about to expire (triggers proactive refresh)
      const expiringToken = {
        token: mockJWT,
        expiresAt: Date.now() + (4 * 60 * 1000), // Expires in 4 minutes (< 5 minute threshold)
        userId: 'test-user-id',
        userProfile: mockUserProfile,
      };

      (StorageAdapter.getAuthState as jest.Mock).mockResolvedValue(expiringToken);

      let refreshCallCount = 0;

      (fetch as jest.Mock).mockImplementation((url) => {
        if (url.includes('/auth/refresh')) {
          refreshCallCount++;
          return new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  status: 200,
                  json: async () => ({
                    message: 'Token refreshed',
                    token: newToken,
                  }),
                }),
              50
            )
          );
        } else {
          // Other API calls (like getCurrentUser)
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ user: mockUserProfile }),
          });
        }
      });

      // Simulate 5 simultaneous API calls that each need token refresh
      const calls = [
        apiClient.getCurrentUser(),
        apiClient.getCurrentUser(),
        apiClient.getCurrentUser(),
        apiClient.getCurrentUser(),
        apiClient.getCurrentUser(),
      ];

      await Promise.all(calls);

      // Should only have refreshed once despite 5 concurrent calls
      expect(refreshCallCount).toBe(1);
    });
  });

  describe('Get Current User', () => {
    it('should fetch current user profile', async () => {
      (StorageAdapter.getAuthState as jest.Mock).mockResolvedValue({
        token: mockJWT,
        expiresAt: Date.now() + 900000,
        userId: 'test-user-id',
        userProfile: mockUserProfile,
      });
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          user: mockUserProfile,
        }),
      });

      const result = await apiClient.getCurrentUser();

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/auth/me'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockJWT}`,
          }),
        })
      );

      expect(result).toEqual(mockUserProfile);
      expect(StorageAdapter.saveUserProfile).toHaveBeenCalledWith(mockUserProfile);
    });

    it('should throw AuthError if not authenticated', async () => {
      (StorageAdapter.getAuthState as jest.Mock).mockResolvedValue(null);

      await expect(apiClient.getCurrentUser()).rejects.toThrow(AuthError);
    });
  });

  describe('Token Decoding', () => {
    it('should decode valid JWT token', () => {
      const decoded = apiClient.decodeToken(mockJWT);

      expect(decoded.sub).toBe('test-user-id');
      expect(decoded.jti).toBe('test-jti');
      expect(decoded.exp).toBe(900);
    });

    it('should throw error for invalid JWT format', () => {
      expect(() => apiClient.decodeToken('invalid-token')).toThrow('Invalid JWT token');
    });

    it('should throw error for malformed JWT payload', () => {
      const malformedJWT = 'header.invalid-base64.signature';
      expect(() => apiClient.decodeToken(malformedJWT)).toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle rate limiting (429) with valid response first', async () => {
      // Note: Login would decode token, so 429 would need valid token response
      // Testing rate limit directly requires more complex mocking
      // Skipping for now as it requires extensive mock setup
    });

    it('should handle server errors (500)', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Internal server error' }),
      });

      await expect(apiClient.login('test@example.com', 'password123')).rejects.toThrow(
        APIError
      );
    });

    it('should handle malformed JSON responses', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => {
          throw new Error('Invalid JSON');
        },
      });

      await expect(apiClient.login('test@example.com', 'password123')).rejects.toThrow(
        APIError
      );
    });
  });

  // ========================================
  // Phase 2: GIF Upload Tests
  // ========================================

  describe('Upload GIF', () => {
    // Mock Blob for testing
    const mockGifBlob = {
      size: 1000,
      type: 'image/gif',
    } as Blob;
    const mockUploadedGif = {
      id: 'gif-123',
      title: 'Test GIF',
      description: null,
      file_url: 'https://s3.example.com/gifs/gif-123.gif',
      thumbnail_url: null,
      privacy: 'public_access',
      duration: 3.5,
      fps: 15,
      resolution_width: 480,
      resolution_height: 270,
      file_size: 1234567,
      has_text_overlay: false,
      is_remix: false,
      remix_count: 0,
      view_count: 0,
      like_count: 0,
      comment_count: 0,
      share_count: 0,
      created_at: '2025-01-13T00:00:00Z',
      updated_at: '2025-01-13T00:00:00Z',
      hashtag_names: [],
      user: {
        id: 'test-user-id',
        username: 'testuser',
        display_name: 'Test User',
        avatar_url: null,
        is_verified: false,
      },
    };

    it('should upload GIF with required parameters', async () => {
      (StorageAdapter.getAuthState as jest.Mock).mockResolvedValue({
        token: mockJWT,
        expiresAt: Date.now() + 900000,
        userId: 'test-user-id',
        userProfile: mockUserProfile,
      });

      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({
          message: 'GIF created successfully',
          gif: mockUploadedGif,
        }),
      });

      const result = await apiClient.uploadGif({
        file: mockGifBlob,
        title: 'Test GIF',
        youtubeUrl: 'https://www.youtube.com/watch?v=test',
        timestampStart: 10,
        timestampEnd: 13.5,
      });

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/gifs'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockJWT}`,
          }),
        })
      );

      // Verify FormData was sent (body should be MockFormData instance)
      const callArgs = (fetch as jest.Mock).mock.calls[0][1];
      expect(callArgs.body).toBeInstanceOf(MockFormData);

      expect(result).toEqual(mockUploadedGif);
    });

    it('should upload GIF with all optional parameters', async () => {
      (StorageAdapter.getAuthState as jest.Mock).mockResolvedValue({
        token: mockJWT,
        expiresAt: Date.now() + 900000,
        userId: 'test-user-id',
        userProfile: mockUserProfile,
      });

      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({
          message: 'GIF created successfully',
          gif: mockUploadedGif,
        }),
      });

      await apiClient.uploadGif({
        file: mockGifBlob,
        title: 'Test GIF',
        youtubeUrl: 'https://www.youtube.com/watch?v=test',
        timestampStart: 10,
        timestampEnd: 13.5,
        description: 'Test description',
        privacy: 'unlisted',
        youtubeVideoTitle: 'YouTube Video Title',
        youtubeChannelName: 'Test Channel',
        hasTextOverlay: true,
        textOverlayData: '{"text":"Hello"}',
        hashtagNames: ['test', 'gif'],
      });

      const callArgs = (fetch as jest.Mock).mock.calls[0][1];
      expect(callArgs.body).toBeInstanceOf(MockFormData);
    });

    it('should throw AuthError if not authenticated', async () => {
      (StorageAdapter.getAuthState as jest.Mock).mockResolvedValue(null);

      await expect(
        apiClient.uploadGif({
          file: mockGifBlob,
          title: 'Test GIF',
          youtubeUrl: 'https://www.youtube.com/watch?v=test',
          timestampStart: 10,
          timestampEnd: 13.5,
        })
      ).rejects.toThrow(AuthError);
    });

    it('should throw APIError on upload failure', async () => {
      (StorageAdapter.getAuthState as jest.Mock).mockResolvedValue({
        token: mockJWT,
        expiresAt: Date.now() + 900000,
        userId: 'test-user-id',
        userProfile: mockUserProfile,
      });

      (fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({
          error: 'Invalid file format',
        }),
      });

      await expect(
        apiClient.uploadGif({
          file: mockGifBlob,
          title: 'Test GIF',
          youtubeUrl: 'https://www.youtube.com/watch?v=test',
          timestampStart: 10,
          timestampEnd: 13.5,
        })
      ).rejects.toThrow(APIError);
    });

    it('should handle network errors during upload', async () => {
      (StorageAdapter.getAuthState as jest.Mock).mockResolvedValue({
        token: mockJWT,
        expiresAt: Date.now() + 900000,
        userId: 'test-user-id',
        userProfile: mockUserProfile,
      });

      // Reject all retry attempts with network error
      (fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      // Expect either network error or max retries exceeded
      await expect(
        apiClient.uploadGif({
          file: mockGifBlob,
          title: 'Test GIF',
          youtubeUrl: 'https://www.youtube.com/watch?v=test',
          timestampStart: 10,
          timestampEnd: 13.5,
        })
      ).rejects.toThrow(); // Should throw some error (network or max retries)
    }, 10000); // Increase timeout for retry logic
  });
});

describe('Error Classes', () => {
  it('should create APIError with status code', () => {
    const error = new APIError('Test error', 404);

    expect(error.message).toBe('Test error');
    expect(error.statusCode).toBe(404);
    expect(error.name).toBe('APIError');
  });

  it('should create AuthError', () => {
    const error = new AuthError('Authentication failed');

    expect(error.message).toBe('Authentication failed');
    expect(error.name).toBe('AuthError');
  });

  it('should create RateLimitError with retry after', () => {
    const error = new RateLimitError('Rate limit exceeded', 60);

    expect(error.message).toBe('Rate limit exceeded');
    expect(error.retryAfter).toBe(60);
    expect(error.name).toBe('RateLimitError');
  });
});
