/**
 * Unit Tests for Auth UI Components
 * Tests AuthView, UserProfileView, and PopupWithAuth
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { AuthView } from '@/popup/components/AuthView';
import { UserProfileView } from '@/popup/components/UserProfileView';
import { PopupWithAuth } from '@/popup/components/PopupWithAuth';
import { apiClient, APIError, AuthError } from '@/lib/api/api-client';
import { StorageAdapter } from '@/lib/storage/storage-adapter';
import type { UserProfile } from '@/types/auth';

// Mock dependencies - preserve actual error classes
jest.mock('@/lib/api/api-client', () => {
  const actual = jest.requireActual<typeof import('@/lib/api/api-client')>(
    '@/lib/api/api-client'
  );
  return {
    ...actual,
    apiClient: {
      login: jest.fn(),
      logout: jest.fn(),
      getCurrentUser: jest.fn(),
      refreshToken: jest.fn(),
    },
  };
});
jest.mock('@/lib/storage/storage-adapter');
jest.mock('@/popup/popup-modern', () => ({
  __esModule: true,
  default: () => <div data-testid="popup-app">Popup Content</div>,
}));

// Mock Chrome APIs
const mockChrome = {
  tabs: {
    create: jest.fn(),
  },
  runtime: {
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
  },
};

(global as any).chrome = mockChrome;
(global as any).confirm = jest.fn();

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

describe('Auth UI Components', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    (global.confirm as jest.Mock).mockReturnValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('AuthView', () => {
    const mockOnLoginSuccess = jest.fn();

    beforeEach(() => {
      mockOnLoginSuccess.mockClear();
    });

    it('should render login form', () => {
      render(<AuthView onLoginSuccess={mockOnLoginSuccess} />);

      expect(screen.getByTestId('auth-view')).toBeTruthy();
      expect(screen.getByTestId('login-form')).toBeTruthy();
      expect(screen.getByTestId('email-input')).toBeTruthy();
      expect(screen.getByTestId('password-input')).toBeTruthy();
      expect(screen.getByTestId('login-submit-btn')).toBeTruthy();
    });

    it('should update email and password fields', () => {
      render(<AuthView onLoginSuccess={mockOnLoginSuccess} />);

      const emailInput = screen.getByTestId('email-input') as HTMLInputElement;
      const passwordInput = screen.getByTestId('password-input') as HTMLInputElement;

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });

      expect(emailInput.value).toBe('test@example.com');
      expect(passwordInput.value).toBe('password123');
    });

    it('should call apiClient.login on form submit', async () => {
      jest.mocked(apiClient.login).mockResolvedValue({
        message: 'Login successful',
        token: 'test-token',
        user: mockUserProfile,
      });

      render(<AuthView onLoginSuccess={mockOnLoginSuccess} />);

      const emailInput = screen.getByTestId('email-input');
      const passwordInput = screen.getByTestId('password-input');
      const submitBtn = screen.getByTestId('login-submit-btn');

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(apiClient.login).toHaveBeenCalledWith('test@example.com', 'password123');
        expect(mockOnLoginSuccess).toHaveBeenCalled();
      });
    });

    it('should show loading state during login', async () => {
      jest.mocked(apiClient.login).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      render(<AuthView onLoginSuccess={mockOnLoginSuccess} />);

      const emailInput = screen.getByTestId('email-input');
      const passwordInput = screen.getByTestId('password-input');
      const submitBtn = screen.getByTestId('login-submit-btn');

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.click(submitBtn);

      expect(screen.getByText('Signing in...')).toBeTruthy();
      expect((submitBtn as HTMLButtonElement).disabled).toBe(true);
    });

    it('should display APIError message', async () => {
      jest.mocked(apiClient.login).mockRejectedValue(
        new APIError('Invalid credentials', 401)
      );

      render(<AuthView onLoginSuccess={mockOnLoginSuccess} />);

      const emailInput = screen.getByTestId('email-input');
      const passwordInput = screen.getByTestId('password-input');
      const submitBtn = screen.getByTestId('login-submit-btn');

      fireEvent.change(emailInput, { target: { value: 'wrong@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'wrongpass' } });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toBeTruthy();
        expect(screen.getByText('Invalid credentials')).toBeTruthy();
      });

      expect(mockOnLoginSuccess).not.toHaveBeenCalled();
    });

    it('should display AuthError message', async () => {
      jest.mocked(apiClient.login).mockRejectedValue(new AuthError('Not authorized'));

      render(<AuthView onLoginSuccess={mockOnLoginSuccess} />);

      const emailInput = screen.getByTestId('email-input');
      const passwordInput = screen.getByTestId('password-input');
      const submitBtn = screen.getByTestId('login-submit-btn');

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText('Not authorized')).toBeTruthy();
      });
    });

    it('should display generic error message for unknown errors', async () => {
      jest.mocked(apiClient.login).mockRejectedValue(new Error('Network error'));

      render(<AuthView onLoginSuccess={mockOnLoginSuccess} />);

      const emailInput = screen.getByTestId('email-input');
      const passwordInput = screen.getByTestId('password-input');
      const submitBtn = screen.getByTestId('login-submit-btn');

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeTruthy();
      });
    });

    it('should open signup page on Create Account click', () => {
      render(<AuthView onLoginSuccess={mockOnLoginSuccess} />);

      const createAccountBtn = screen.getByTestId('create-account-btn');
      fireEvent.click(createAccountBtn);

      expect(mockChrome.tabs.create).toHaveBeenCalledWith({
        url: 'http://localhost:3000/signup?source=extension',
      });
    });

    it('should open forgot password page', () => {
      render(<AuthView onLoginSuccess={mockOnLoginSuccess} />);

      const forgotPasswordLink = screen.getByTestId('forgot-password-link');
      fireEvent.click(forgotPasswordLink);

      expect(mockChrome.tabs.create).toHaveBeenCalledWith({
        url: 'http://localhost:3000/password/new',
      });
    });

    it('should disable inputs and buttons during loading', async () => {
      jest.mocked(apiClient.login).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      render(<AuthView onLoginSuccess={mockOnLoginSuccess} />);

      const emailInput = screen.getByTestId('email-input') as HTMLInputElement;
      const passwordInput = screen.getByTestId('password-input') as HTMLInputElement;
      const submitBtn = screen.getByTestId('login-submit-btn') as HTMLButtonElement;
      const createAccountBtn = screen.getByTestId('create-account-btn') as HTMLButtonElement;
      const forgotPasswordLink = screen.getByTestId(
        'forgot-password-link'
      ) as HTMLButtonElement;

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.click(submitBtn);

      expect(emailInput.disabled).toBe(true);
      expect(passwordInput.disabled).toBe(true);
      expect(submitBtn.disabled).toBe(true);
      expect(createAccountBtn.disabled).toBe(true);
      expect(forgotPasswordLink.disabled).toBe(true);
    });
  });

  describe('UserProfileView', () => {
    const mockOnLogoutSuccess = jest.fn();

    beforeEach(() => {
      mockOnLogoutSuccess.mockClear();
    });

    it('should show loading state initially', () => {
      jest.mocked(StorageAdapter.getUserProfile).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      render(<UserProfileView onLogoutSuccess={mockOnLogoutSuccess} />);

      expect(screen.getByText('Loading profile...')).toBeTruthy();
    });

    it('should load and display cached profile', async () => {
      jest.mocked(StorageAdapter.getUserProfile).mockResolvedValue(mockUserProfile);

      render(<UserProfileView onLogoutSuccess={mockOnLogoutSuccess} />);

      await waitFor(() => {
        expect(screen.getByTestId('user-profile')).toBeTruthy();
        expect(screen.getByTestId('username')).toBeTruthy();
        expect(screen.getByText('testuser')).toBeTruthy();
        expect(screen.getByTestId('email')).toBeTruthy();
        expect(screen.getByText('test@example.com')).toBeTruthy();
        expect(screen.getByTestId('gifs-count')).toBeTruthy();
        expect(screen.getByText('10')).toBeTruthy();
      });

      expect(apiClient.getCurrentUser).not.toHaveBeenCalled();
    });

    it('should fetch from API if no cached profile', async () => {
      jest.mocked(StorageAdapter.getUserProfile).mockResolvedValue(null);
      jest.mocked(apiClient.getCurrentUser).mockResolvedValue(mockUserProfile);

      render(<UserProfileView onLogoutSuccess={mockOnLogoutSuccess} />);

      await waitFor(() => {
        expect(apiClient.getCurrentUser).toHaveBeenCalled();
        expect(screen.getByText('testuser')).toBeTruthy();
      });
    });

    it('should display bio if present', async () => {
      jest.mocked(StorageAdapter.getUserProfile).mockResolvedValue(mockUserProfile);

      render(<UserProfileView onLogoutSuccess={mockOnLogoutSuccess} />);

      await waitFor(() => {
        expect(screen.getByText('Test bio')).toBeTruthy();
      });
    });

    it('should display verified badge for verified users', async () => {
      const verifiedProfile = { ...mockUserProfile, is_verified: true };
      jest.mocked(StorageAdapter.getUserProfile).mockResolvedValue(verifiedProfile);

      render(<UserProfileView onLogoutSuccess={mockOnLogoutSuccess} />);

      await waitFor(() => {
        expect(screen.getByText('Verified')).toBeTruthy();
      });
    });

    it('should display fallback avatar if no avatar_url', async () => {
      const noAvatarProfile = { ...mockUserProfile, avatar_url: null };
      jest.mocked(StorageAdapter.getUserProfile).mockResolvedValue(noAvatarProfile);

      render(<UserProfileView onLogoutSuccess={mockOnLogoutSuccess} />);

      await waitFor(() => {
        expect(screen.getByText('T')).toBeTruthy(); // First letter of username
      });
    });

    it('should handle logout successfully', async () => {
      jest.mocked(StorageAdapter.getUserProfile).mockResolvedValue(mockUserProfile);
      jest.mocked(apiClient.logout).mockResolvedValue(undefined);

      render(<UserProfileView onLogoutSuccess={mockOnLogoutSuccess} />);

      await waitFor(() => {
        expect(screen.getByTestId('logout-btn')).toBeTruthy();
      });

      const logoutBtn = screen.getByTestId('logout-btn');
      fireEvent.click(logoutBtn);

      await waitFor(() => {
        expect(apiClient.logout).toHaveBeenCalled();
        expect(mockOnLogoutSuccess).toHaveBeenCalled();
      });
    });

    it('should not logout if user cancels confirmation', async () => {
      (global.confirm as jest.Mock).mockReturnValue(false);
      jest.mocked(StorageAdapter.getUserProfile).mockResolvedValue(mockUserProfile);

      render(<UserProfileView onLogoutSuccess={mockOnLogoutSuccess} />);

      await waitFor(() => {
        expect(screen.getByTestId('logout-btn')).toBeTruthy();
      });

      const logoutBtn = screen.getByTestId('logout-btn');
      fireEvent.click(logoutBtn);

      expect(apiClient.logout).not.toHaveBeenCalled();
      expect(mockOnLogoutSuccess).not.toHaveBeenCalled();
    });

    it('should display error message on logout failure', async () => {
      jest.mocked(StorageAdapter.getUserProfile).mockResolvedValue(mockUserProfile);
      jest.mocked(apiClient.logout).mockRejectedValue(new Error('Logout failed'));

      render(<UserProfileView onLogoutSuccess={mockOnLogoutSuccess} />);

      await waitFor(() => {
        expect(screen.getByTestId('logout-btn')).toBeTruthy();
      });

      const logoutBtn = screen.getByTestId('logout-btn');
      fireEvent.click(logoutBtn);

      await waitFor(() => {
        expect(screen.getByText('Logout failed. Please try again.')).toBeTruthy();
      });

      expect(mockOnLogoutSuccess).not.toHaveBeenCalled();
    });

    it('should open web profile page', async () => {
      jest.mocked(StorageAdapter.getUserProfile).mockResolvedValue(mockUserProfile);

      render(<UserProfileView onLogoutSuccess={mockOnLogoutSuccess} />);

      await waitFor(() => {
        expect(screen.getByText('View Profile on Web')).toBeTruthy();
      });

      const viewProfileBtn = screen.getByText('View Profile on Web');
      fireEvent.click(viewProfileBtn);

      expect(mockChrome.tabs.create).toHaveBeenCalledWith({
        url: 'http://localhost:3000/@testuser',
      });
    });

    it('should open community browse page', async () => {
      jest.mocked(StorageAdapter.getUserProfile).mockResolvedValue(mockUserProfile);

      render(<UserProfileView onLogoutSuccess={mockOnLogoutSuccess} />);

      await waitFor(() => {
        expect(screen.getByText('Browse Community')).toBeTruthy();
      });

      const browseBtn = screen.getByText('Browse Community');
      fireEvent.click(browseBtn);

      expect(mockChrome.tabs.create).toHaveBeenCalledWith({
        url: 'http://localhost:3000',
      });
    });

    it('should display error and retry button on load failure', async () => {
      jest.mocked(StorageAdapter.getUserProfile).mockResolvedValue(null);
      jest.mocked(apiClient.getCurrentUser).mockRejectedValue(
        new Error('Failed to load')
      );

      render(<UserProfileView onLogoutSuccess={mockOnLogoutSuccess} />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load profile')).toBeTruthy();
        expect(screen.getByText('Retry')).toBeTruthy();
      });
    });

    it('should handle TOKEN_EXPIRED message', async () => {
      jest.useFakeTimers();
      jest.mocked(StorageAdapter.getUserProfile).mockResolvedValue(mockUserProfile);

      render(<UserProfileView onLogoutSuccess={mockOnLogoutSuccess} />);

      await waitFor(() => {
        expect(screen.getByTestId('user-profile')).toBeTruthy();
      });

      // Get the message handler that was registered
      const addListenerCall = jest.mocked(mockChrome.runtime.onMessage.addListener).mock
        .calls[0];
      const messageHandler = addListenerCall[0] as (message: any) => void;

      // Simulate TOKEN_EXPIRED message
      messageHandler({ type: 'TOKEN_EXPIRED' });

      await waitFor(() => {
        expect(screen.getByText('Session expired. Please login again.')).toBeTruthy();
      });

      // Fast-forward 2 seconds
      jest.advanceTimersByTime(2000);

      await waitFor(() => {
        expect(mockOnLogoutSuccess).toHaveBeenCalled();
      });

      jest.useRealTimers();
    });
  });

  describe('PopupWithAuth', () => {
    it('should show loading state while checking auth', () => {
      jest.mocked(StorageAdapter.isAuthenticated).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      render(<PopupWithAuth />);

      expect(screen.getByText('Loading...')).toBeTruthy();
    });

    it('should show main popup with Sign In button when not authenticated', async () => {
      jest.mocked(StorageAdapter.isAuthenticated).mockResolvedValue(false);

      render(<PopupWithAuth />);

      await waitFor(() => {
        expect(screen.getByTestId('popup-app')).toBeTruthy();
        expect(screen.getByTestId('sign-in-button')).toBeTruthy();
        expect(
          screen.getByText('Sign in to upload GIFs and join the community')
        ).toBeTruthy();
      });
    });

    it('should show main popup with My Account button when authenticated', async () => {
      jest.mocked(StorageAdapter.isAuthenticated).mockResolvedValue(true);

      render(<PopupWithAuth />);

      await waitFor(() => {
        expect(screen.getByTestId('popup-app')).toBeTruthy();
        expect(screen.getByTestId('my-account-button')).toBeTruthy();
        expect(screen.getByText('My Account')).toBeTruthy();
      });
    });

    it('should toggle to AuthView when Sign In clicked', async () => {
      jest.mocked(StorageAdapter.isAuthenticated).mockResolvedValue(false);

      render(<PopupWithAuth />);

      await waitFor(() => {
        expect(screen.getByTestId('sign-in-button')).toBeTruthy();
      });

      const signInBtn = screen.getByTestId('sign-in-button');
      fireEvent.click(signInBtn);

      await waitFor(() => {
        expect(screen.getByTestId('auth-view')).toBeTruthy();
        expect(screen.queryByTestId('popup-app')).toBeFalsy();
      });
    });

    it('should toggle to UserProfileView when My Account clicked', async () => {
      jest.mocked(StorageAdapter.isAuthenticated).mockResolvedValue(true);
      jest.mocked(StorageAdapter.getUserProfile).mockResolvedValue(mockUserProfile);

      render(<PopupWithAuth />);

      await waitFor(() => {
        expect(screen.getByTestId('my-account-button')).toBeTruthy();
      });

      const myAccountBtn = screen.getByTestId('my-account-button');
      fireEvent.click(myAccountBtn);

      await waitFor(() => {
        expect(screen.getByTestId('user-profile')).toBeTruthy();
        expect(screen.queryByTestId('popup-app')).toBeFalsy();
      });
    });

    it('should return to main popup when back button clicked from auth', async () => {
      jest.mocked(StorageAdapter.isAuthenticated).mockResolvedValue(false);

      render(<PopupWithAuth />);

      await waitFor(() => {
        expect(screen.getByTestId('sign-in-button')).toBeTruthy();
      });

      // Open auth section
      const signInBtn = screen.getByTestId('sign-in-button');
      fireEvent.click(signInBtn);

      await waitFor(() => {
        expect(screen.getByTestId('auth-view')).toBeTruthy();
      });

      // Find and click back button (SVG arrow button)
      const backButton = screen.getByRole('button', { name: '' }); // Button with only SVG, no text
      fireEvent.click(backButton);

      await waitFor(() => {
        expect(screen.getByTestId('popup-app')).toBeTruthy();
        expect(screen.queryByTestId('auth-view')).toBeFalsy();
      });
    });

    it('should update auth state after successful login', async () => {
      jest.mocked(StorageAdapter.isAuthenticated).mockResolvedValue(false);
      jest.mocked(apiClient.login).mockResolvedValue({
        message: 'Login successful',
        token: 'test-token',
        user: mockUserProfile,
      });
      jest.mocked(StorageAdapter.getUserProfile).mockResolvedValue(mockUserProfile);

      render(<PopupWithAuth />);

      await waitFor(() => {
        expect(screen.getByTestId('sign-in-button')).toBeTruthy();
      });

      // Open auth section
      const signInBtn = screen.getByTestId('sign-in-button');
      fireEvent.click(signInBtn);

      await waitFor(() => {
        expect(screen.getByTestId('auth-view')).toBeTruthy();
      });

      // Perform login
      const emailInput = screen.getByTestId('email-input');
      const passwordInput = screen.getByTestId('password-input');
      const submitBtn = screen.getByTestId('login-submit-btn');

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(apiClient.login).toHaveBeenCalled();
      });

      // Click back to main popup
      const backButton = screen.getByRole('button', { name: '' });
      fireEvent.click(backButton);

      // Should now show My Account button
      await waitFor(() => {
        expect(screen.getByTestId('my-account-button')).toBeTruthy();
      });
    });

    it('should handle TOKEN_EXPIRED message', async () => {
      jest.mocked(StorageAdapter.isAuthenticated).mockResolvedValue(true);

      render(<PopupWithAuth />);

      await waitFor(() => {
        expect(screen.getByTestId('my-account-button')).toBeTruthy();
      });

      // Get the message handler that was registered
      const addListenerCall = jest.mocked(mockChrome.runtime.onMessage.addListener).mock
        .calls[0];
      const messageHandler = addListenerCall[0] as (message: any) => void;

      // Simulate TOKEN_EXPIRED message
      messageHandler({ type: 'TOKEN_EXPIRED' });

      // Should now show Sign In button
      await waitFor(() => {
        expect(screen.getByTestId('sign-in-button')).toBeTruthy();
      });
    });
  });
});
