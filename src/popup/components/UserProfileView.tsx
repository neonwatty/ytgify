/**
 * UserProfileView Component
 *
 * Displays user profile for authenticated users
 * Phase 1: JWT Authentication
 */

import React, { useEffect, useState } from 'react';
import { StorageAdapter } from '@/lib/storage/storage-adapter';
import { apiClient } from '@/lib/api/api-client';
import type { UserProfile } from '@/types/auth';

interface UserProfileViewProps {
  onLogoutSuccess: () => void;
}

export const UserProfileView: React.FC<UserProfileViewProps> = ({ onLogoutSuccess }) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    loadProfile();

    // Listen for token expiration
    const handleMessage = (message: any) => {
      if (message.type === 'TOKEN_EXPIRED') {
        setError('Session expired. Please login again.');
        setTimeout(() => {
          onLogoutSuccess();
        }, 2000);
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);

    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, [onLogoutSuccess]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      setError(null);

      // Try to get cached profile first
      let userProfile = await StorageAdapter.getUserProfile();

      if (!userProfile) {
        // Fetch from API if not cached
        userProfile = await apiClient.getCurrentUser();
      }

      setProfile(userProfile);
    } catch (err) {
      console.error('[UserProfileView] Failed to load profile:', err);
      setError('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    if (!confirm('Are you sure you want to sign out?')) return;

    setLoggingOut(true);

    try {
      await apiClient.logout();

      // Logout successful, notify parent
      onLogoutSuccess();
    } catch (err) {
      console.error('[UserProfileView] Logout failed:', err);
      setError('Logout failed. Please try again.');
      setLoggingOut(false);
    }
  };

  const handleOpenWebApp = () => {
    const baseUrl =
      process.env.API_BASE_URL?.replace('/api/v1', '') || 'http://localhost:3000';
    chrome.tabs.create({
      url: baseUrl,
    });
  };

  const handleViewProfile = () => {
    const baseUrl =
      process.env.API_BASE_URL?.replace('/api/v1', '') || 'http://localhost:3000';
    chrome.tabs.create({
      url: `${baseUrl}/@${profile?.username}`,
    });
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
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
        <p style={{ marginTop: '16px', color: '#666', fontSize: '14px' }}>Loading profile...</p>
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <div
          style={{
            padding: '12px',
            backgroundColor: '#fee',
            border: '1px solid #fcc',
            borderRadius: '6px',
            color: '#c33',
            fontSize: '14px',
            marginBottom: '16px',
          }}
        >
          {error}
        </div>
        <button
          onClick={loadProfile}
          style={{
            padding: '10px 20px',
            fontSize: '14px',
            fontWeight: '600',
            color: '#6366f1',
            backgroundColor: '#fff',
            border: '1px solid #6366f1',
            borderRadius: '6px',
            cursor: 'pointer',
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  return (
    <div className="user-profile-view" data-testid="user-profile" style={{ padding: '20px' }}>
      {/* Profile Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          marginBottom: '20px',
          paddingBottom: '20px',
          borderBottom: '1px solid #e5e7eb',
        }}
      >
        {/* Avatar */}
        {profile.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt={profile.username}
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              objectFit: 'cover',
            }}
          />
        ) : (
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: '#6366f1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
              fontWeight: '600',
              color: '#fff',
            }}
          >
            {profile.username[0].toUpperCase()}
          </div>
        )}

        {/* Profile Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3
            data-testid="username"
            style={{
              fontSize: '16px',
              fontWeight: '600',
              marginBottom: '4px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {profile.username}
          </h3>
          <p
            data-testid="email"
            style={{
              fontSize: '13px',
              color: '#6b7280',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {profile.email}
          </p>
          {profile.is_verified && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                marginTop: '4px',
                padding: '2px 8px',
                backgroundColor: '#dbeafe',
                borderRadius: '12px',
                fontSize: '12px',
                color: '#1e40af',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Verified
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '12px',
          marginBottom: '20px',
        }}
      >
        <div style={{ textAlign: 'center', padding: '12px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
          <div data-testid="gifs-count" style={{ fontSize: '20px', fontWeight: '600', color: '#111827' }}>
            {profile.gifs_count}
          </div>
          <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>GIFs</div>
        </div>
        <div style={{ textAlign: 'center', padding: '12px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
          <div style={{ fontSize: '20px', fontWeight: '600', color: '#111827' }}>
            {profile.follower_count}
          </div>
          <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>Followers</div>
        </div>
        <div style={{ textAlign: 'center', padding: '12px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
          <div style={{ fontSize: '20px', fontWeight: '600', color: '#111827' }}>
            {profile.following_count}
          </div>
          <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>Following</div>
        </div>
      </div>

      {/* Bio */}
      {profile.bio && (
        <div style={{ marginBottom: '20px', padding: '12px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
          <p style={{ fontSize: '14px', color: '#374151', lineHeight: '1.5' }}>{profile.bio}</p>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <button
          onClick={handleViewProfile}
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
          View Profile on Web
        </button>

        <button
          onClick={handleOpenWebApp}
          style={{
            width: '100%',
            padding: '12px',
            fontSize: '14px',
            fontWeight: '600',
            color: '#6366f1',
            backgroundColor: '#fff',
            border: '1px solid #6366f1',
            borderRadius: '6px',
            cursor: 'pointer',
            transition: 'background-color 0.2s',
          }}
        >
          Browse Community
        </button>

        <button
          onClick={handleLogout}
          data-testid="logout-btn"
          disabled={loggingOut}
          style={{
            width: '100%',
            padding: '12px',
            fontSize: '14px',
            fontWeight: '600',
            color: '#dc2626',
            backgroundColor: '#fff',
            border: '1px solid #fecaca',
            borderRadius: '6px',
            cursor: loggingOut ? 'not-allowed' : 'pointer',
            transition: 'background-color 0.2s',
          }}
        >
          {loggingOut ? 'Signing out...' : 'Sign Out'}
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div
          style={{
            marginTop: '16px',
            padding: '12px',
            backgroundColor: '#fee',
            border: '1px solid #fcc',
            borderRadius: '6px',
            color: '#c33',
            fontSize: '14px',
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
};
