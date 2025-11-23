/**
 * UserProfileView Component
 *
 * Displays user profile for authenticated users
 * Phase 1: JWT Authentication
 * Phase 3: Added My GIFs tab
 */

import React, { useEffect, useState } from 'react';
import { StorageAdapter } from '@/lib/storage/storage-adapter';
import { apiClient } from '@/lib/api/api-client';
import type { UserProfile, UploadedGif, GifListResponse, LikeResponse } from '@/types/auth';
import { GifCard } from './GifCard';

interface UserProfileViewProps {
  onLogoutSuccess: () => void;
}

type Tab = 'profile' | 'myGifs';

export const UserProfileView: React.FC<UserProfileViewProps> = ({ onLogoutSuccess }) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  // Tab state
  const [activeTab, setActiveTab] = useState<Tab>('profile');

  // My GIFs state
  const [myGifs, setMyGifs] = useState<UploadedGif[]>([]);
  const [gifsLoading, setGifsLoading] = useState(false);
  const [gifsError, setGifsError] = useState<string | null>(null);
  const [hasMoreGifs, setHasMoreGifs] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

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

  const loadMyGifs = async (page: number = 1) => {
    try {
      setGifsLoading(true);
      setGifsError(null);

      const response: GifListResponse = await apiClient.getMyGifs(page, 10);

      if (page === 1) {
        setMyGifs(response.gifs);
      } else {
        setMyGifs((prev) => [...prev, ...response.gifs]);
      }

      setCurrentPage(page);
      setHasMoreGifs(response.gifs.length === 10); // If we got less than requested, no more to load

      console.log('[UserProfileView] Loaded', response.gifs.length, 'GIFs');
    } catch (err) {
      console.error('[UserProfileView] Failed to load GIFs:', err);
      setGifsError('Failed to load your GIFs');
    } finally {
      setGifsLoading(false);
    }
  };

  const handleLoadMore = () => {
    if (!gifsLoading && hasMoreGifs) {
      loadMyGifs(currentPage + 1);
    }
  };

  const handleLikeUpdate = (gifId: string, likeResponse: LikeResponse) => {
    // Update the like count in the local state
    setMyGifs((prev) =>
      prev.map((gif) =>
        gif.id === gifId ? { ...gif, like_count: likeResponse.like_count } : gif
      )
    );
  };

  // Load GIFs when switching to My GIFs tab
  useEffect(() => {
    if (activeTab === 'myGifs' && myGifs.length === 0 && !gifsLoading) {
      loadMyGifs();
    }
  }, [activeTab]);

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
      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          borderBottom: '2px solid #e5e7eb',
          marginBottom: '20px',
          gap: '8px',
        }}
      >
        <button
          onClick={() => setActiveTab('profile')}
          style={{
            flex: 1,
            padding: '12px',
            fontSize: '14px',
            fontWeight: '600',
            color: activeTab === 'profile' ? '#6366f1' : '#6b7280',
            backgroundColor: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'profile' ? '2px solid #6366f1' : '2px solid transparent',
            marginBottom: '-2px',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          Profile
        </button>
        <button
          onClick={() => setActiveTab('myGifs')}
          style={{
            flex: 1,
            padding: '12px',
            fontSize: '14px',
            fontWeight: '600',
            color: activeTab === 'myGifs' ? '#6366f1' : '#6b7280',
            backgroundColor: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'myGifs' ? '2px solid #6366f1' : '2px solid transparent',
            marginBottom: '-2px',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          My GIFs ({profile?.gifs_count || 0})
        </button>
      </div>

      {/* Profile Tab Content */}
      {activeTab === 'profile' && (
        <>
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
        </>
      )}

      {/* My GIFs Tab Content */}
      {activeTab === 'myGifs' && (
        <div>
          {/* Loading State */}
          {gifsLoading && myGifs.length === 0 && (
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
              <p style={{ marginTop: '16px', color: '#666', fontSize: '14px' }}>Loading your GIFs...</p>
            </div>
          )}

          {/* Error State */}
          {gifsError && !gifsLoading && myGifs.length === 0 && (
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
                {gifsError}
              </div>
              <button
                onClick={() => loadMyGifs()}
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
          )}

          {/* Empty State */}
          {!gifsLoading && !gifsError && myGifs.length === 0 && (
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
              <svg
                width="64"
                height="64"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#d1d5db"
                strokeWidth="2"
                style={{ margin: '0 auto 16px' }}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"
                />
              </svg>
              <p style={{ fontSize: '16px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                No GIFs yet
              </p>
              <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '20px' }}>
                Create your first GIF from a YouTube video to see it here!
              </p>
              <button
                onClick={handleOpenWebApp}
                style={{
                  padding: '10px 20px',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#fff',
                  backgroundColor: '#6366f1',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                Browse Community
              </button>
            </div>
          )}

          {/* GIF Grid */}
          {myGifs.length > 0 && (
            <>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr',
                  gap: '12px',
                  marginBottom: '16px',
                }}
              >
                {myGifs.map((gif) => (
                  <GifCard key={gif.id} gif={gif} onLikeUpdate={handleLikeUpdate} />
                ))}
              </div>

              {/* Load More Button */}
              {hasMoreGifs && (
                <button
                  onClick={handleLoadMore}
                  disabled={gifsLoading}
                  style={{
                    width: '100%',
                    padding: '12px',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#6366f1',
                    backgroundColor: '#fff',
                    border: '1px solid #6366f1',
                    borderRadius: '6px',
                    cursor: gifsLoading ? 'not-allowed' : 'pointer',
                    transition: 'background-color 0.2s',
                  }}
                >
                  {gifsLoading ? 'Loading...' : 'Load More'}
                </button>
              )}

              {/* No More GIFs Message */}
              {!hasMoreGifs && myGifs.length > 0 && (
                <div
                  style={{
                    padding: '12px',
                    textAlign: 'center',
                    fontSize: '13px',
                    color: '#9ca3af',
                  }}
                >
                  No more GIFs to load
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
