/**
 * PopupWithAuth Component
 *
 * Wrapper for popup that adds authentication UI
 * Shows AuthView or UserProfileView based on auth state
 * Phase 1: JWT Authentication
 */

import React, { useEffect, useState } from 'react';
import { StorageAdapter } from '@/lib/storage/storage-adapter';
import { AuthView } from './AuthView';
import { UserProfileView } from './UserProfileView';
import PopupApp from '../popup-modern';

/**
 * Auth-aware popup wrapper
 * Manages auth state and renders appropriate UI
 */
export const PopupWithAuth: React.FC = () => {
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showAuthSection, setShowAuthSection] = useState(false);

  useEffect(() => {
    checkAuthStatus();

    // Listen for auth state changes
    const handleMessage = (message: any) => {
      if (message.type === 'TOKEN_EXPIRED') {
        setIsAuthenticated(false);
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);

    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, []);

  const checkAuthStatus = async () => {
    try {
      const authenticated = await StorageAdapter.isAuthenticated();
      setIsAuthenticated(authenticated);
    } catch (error) {
      console.error('[PopupWithAuth] Failed to check auth status:', error);
      setIsAuthenticated(false);
    } finally {
      setAuthChecked(true);
    }
  };

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
    // Keep auth section open to show profile
  };

  const handleLogoutSuccess = () => {
    setIsAuthenticated(false);
    // Keep auth section open to show login form
  };

  const toggleAuthSection = () => {
    setShowAuthSection(!showAuthSection);
  };

  // Loading state while checking auth
  if (!authChecked) {
    return (
      <div style={{ width: '360px', padding: '40px', textAlign: 'center' }}>
        <div
          style={{
            width: '32px',
            height: '32px',
            margin: '0 auto',
            border: '3px solid #f3f4f6',
            borderTop: '3px solid #6366f1',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }}
        />
        <p style={{ marginTop: '16px', color: '#666', fontSize: '14px' }}>Loading...</p>
      </div>
    );
  }

  // If showing auth section (login or profile)
  if (showAuthSection) {
    return (
      <div style={{ width: '360px' }}>
        {/* Header with back button */}
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <button
            onClick={toggleAuthSection}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 style={{ fontSize: '16px', fontWeight: '600', flex: 1 }}>
            {isAuthenticated ? 'Your Account' : 'Sign In'}
          </h2>
        </div>

        {/* Auth content */}
        {isAuthenticated ? (
          <UserProfileView onLogoutSuccess={handleLogoutSuccess} />
        ) : (
          <AuthView onLoginSuccess={handleLoginSuccess} />
        )}
      </div>
    );
  }

  // Main popup UI with auth button
  return (
    <div style={{ width: '360px' }}>
      {/* Main popup content */}
      <PopupApp />

      {/* Auth Section Toggle */}
      <div
        style={{
          borderTop: '1px solid #e5e7eb',
          padding: '16px',
          backgroundColor: '#f9fafb',
        }}
      >
        {isAuthenticated ? (
          <button
            onClick={toggleAuthSection}
            data-testid="my-account-button"
            style={{
              width: '100%',
              padding: '12px',
              fontSize: '14px',
              fontWeight: '600',
              color: '#374151',
              backgroundColor: '#fff',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'background-color 0.2s',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
            <span>My Account</span>
          </button>
        ) : (
          <div>
            <p
              style={{
                fontSize: '13px',
                color: '#6b7280',
                marginBottom: '12px',
                textAlign: 'center',
              }}
            >
              Sign in to upload GIFs and join the community
            </p>
            <button
              onClick={toggleAuthSection}
              data-testid="sign-in-button"
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '14px',
                fontWeight: '600',
                color: '#fff',
                backgroundColor: '#6366f1',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'background-color 0.2s',
              }}
            >
              Sign In
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
