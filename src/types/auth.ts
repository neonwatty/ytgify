/**
 * Authentication Types for ytgify Extension
 *
 * Phase 1: JWT Authentication with ytgify-share backend
 */

/**
 * User profile data from backend API
 * Matches ytgify-share User model
 */
export interface UserProfile {
  id: string; // UUID
  email: string;
  username: string;
  bio: string | null;
  avatar_url: string | null;
  is_verified: boolean;
  gifs_count: number;
  follower_count: number;
  following_count: number;
  created_at: string; // ISO 8601
  updated_at: string; // ISO 8601
}

/**
 * JWT payload structure (decoded from token)
 * Backend generates this via devise-jwt
 */
export interface JWTPayload {
  sub: string; // User ID (UUID)
  jti: string; // JWT ID (for revocation)
  exp: number; // Expiration timestamp (Unix seconds)
}

/**
 * Complete auth state stored in extension
 */
export interface AuthState {
  token: string; // JWT access token
  expiresAt: number; // Expiration timestamp (milliseconds)
  userId: string; // User UUID
  userProfile: UserProfile | null; // Cached user profile
}

/**
 * Login API response
 */
export interface LoginResponse {
  message: string;
  token: string;
  user: UserProfile;
}

/**
 * Register API response
 */
export interface RegisterResponse {
  message: string;
  token: string;
  user: UserProfile;
}

/**
 * Token refresh API response
 */
export interface TokenRefreshResponse {
  message: string;
  token: string;
}

/**
 * User profile API response (/api/v1/auth/me)
 */
export interface CurrentUserResponse {
  user: UserProfile;
}

/**
 * API Error response structure
 */
export interface APIErrorResponse {
  error: string;
  message?: string;
  details?: string[];
}

/**
 * Extended user preferences with auth settings
 * Extends existing UserPreferences from storage.ts
 */
export interface AuthPreferences {
  // Upload behavior
  autoUpload: boolean;
  uploadOnWifiOnly: boolean;
  defaultPrivacy: 'public_access' | 'unlisted' | 'private_access';

  // Notification settings
  notificationPolling: boolean;
  pollIntervalMinutes: number;
}

/**
 * Auth message types for extension messaging
 */
export interface CheckAuthMessage {
  type: 'CHECK_AUTH';
}

export interface CheckAuthResponse {
  type: 'CHECK_AUTH_RESPONSE';
  authenticated: boolean;
  userProfile?: UserProfile;
}

export interface RefreshTokenMessage {
  type: 'REFRESH_TOKEN';
}

export interface RefreshTokenResponse {
  type: 'REFRESH_TOKEN_RESPONSE';
  success: boolean;
  error?: string;
}

export interface TokenExpiredMessage {
  type: 'TOKEN_EXPIRED';
}

export interface RateLimitedMessage {
  type: 'RATE_LIMITED';
  retryAfter: number; // seconds
}

/**
 * Union type of all auth messages
 */
export type AuthMessage =
  | CheckAuthMessage
  | CheckAuthResponse
  | RefreshTokenMessage
  | RefreshTokenResponse
  | TokenExpiredMessage
  | RateLimitedMessage;

// ========================================
// Phase 2: GIF Upload Types
// ========================================

/**
 * Parameters for uploading a GIF to backend
 * Matches ytgify-share POST /api/v1/gifs endpoint
 */
export interface UploadGifParams {
  // Required
  file: Blob;
  title: string;
  youtubeUrl: string;
  timestampStart: number; // seconds
  timestampEnd: number; // seconds

  // Optional metadata
  description?: string;
  privacy?: 'public_access' | 'unlisted' | 'private_access';
  youtubeVideoTitle?: string;
  youtubeChannelName?: string;

  // Text overlay
  hasTextOverlay?: boolean;
  textOverlayData?: string; // JSON string

  // Social features (Phase 3)
  parentGifId?: string; // For remixes
  hashtagNames?: string[]; // Array of hashtag strings
}

/**
 * Uploaded GIF response from backend
 * Subset of full Gif model
 */
export interface UploadedGif {
  id: string;
  title: string;
  description: string | null;
  file_url: string;
  thumbnail_url: string | null;
  privacy: string;
  duration: number;
  fps: number;
  resolution_width: number;
  resolution_height: number;
  file_size: number;
  has_text_overlay: boolean;
  is_remix: boolean;
  remix_count: number;
  view_count: number;
  like_count: number;
  comment_count: number;
  share_count: number;
  created_at: string;
  updated_at: string;
  hashtag_names: string[];
  user: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
    is_verified: boolean;
  };
}

/**
 * GIF upload API response
 */
export interface UploadGifResponse {
  message: string;
  gif: UploadedGif;
}

/**
 * GIF metadata extracted during encoding
 * Used for display and validation, not authoritative
 * Backend re-extracts via GifProcessingJob
 */
export interface GifMetadata {
  fps: number;
  duration: number; // seconds
  width: number;
  height: number;
  frameCount: number;
  fileSize: number; // bytes
}

// ========================================
// Phase 3: Social Features Types
// ========================================

/**
 * Pagination metadata for list responses
 */
export interface Pagination {
  page: number;
  per_page: number;
  total: number;
}

/**
 * GIF list API response (for /api/v1/gifs, /api/v1/feed/*, etc.)
 */
export interface GifListResponse {
  gifs: UploadedGif[];
  pagination: Pagination;
}

/**
 * Like/unlike API response
 */
export interface LikeResponse {
  message: string;
  liked: boolean;
  like_count: number;
}
