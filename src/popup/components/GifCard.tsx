/**
 * GifCard Component
 *
 * Displays a GIF card with thumbnail, stats, and interaction buttons
 * Used in My GIFs and Trending tabs
 * Phase 3: Social Features
 */

import React, { useState } from 'react';
import type { UploadedGif, LikeResponse } from '@/types/auth';
import { apiClient } from '@/lib/api/api-client';

interface GifCardProps {
  gif: UploadedGif;
  onLikeUpdate?: (gifId: string, likeResponse: LikeResponse) => void;
}

export const GifCard: React.FC<GifCardProps> = ({ gif, onLikeUpdate }) => {
  const [isLiking, setIsLiking] = useState(false);
  const [likeCount, setLikeCount] = useState(gif.like_count);
  const [isLiked, setIsLiked] = useState(false); // TODO: Track liked state from API

  const baseUrl = process.env.API_BASE_URL?.replace('/api/v1', '') || 'http://localhost:3000';

  const handleLike = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isLiking) return;

    setIsLiking(true);

    try {
      const response = await apiClient.toggleLike(gif.id);

      setLikeCount(response.like_count);
      setIsLiked(response.liked);

      if (onLikeUpdate) {
        onLikeUpdate(gif.id, response);
      }

      console.log('[GifCard] Like toggled:', response);
    } catch (error) {
      console.error('[GifCard] Failed to toggle like:', error);
    } finally {
      setIsLiking(false);
    }
  };

  const handleViewGif = () => {
    chrome.tabs.create({
      url: `${baseUrl}/gifs/${gif.id}`,
    });
  };

  const formatTimeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    if (seconds < 2592000) return `${Math.floor(seconds / 604800)}w ago`;
    return `${Math.floor(seconds / 2592000)}mo ago`;
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div
      style={{
        backgroundColor: '#fff',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        overflow: 'hidden',
        transition: 'box-shadow 0.2s',
        cursor: 'pointer',
      }}
      onClick={handleViewGif}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
      }}
    >
      {/* GIF Thumbnail */}
      <div
        style={{
          position: 'relative',
          aspectRatio: '16 / 9',
          backgroundColor: '#111827',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {gif.file_url || gif.thumbnail_url ? (
          <img
            src={gif.thumbnail_url || gif.file_url}
            alt={gif.title}
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
            }}
          />
        ) : (
          <div style={{ color: '#9ca3af' }}>
            <svg width="48" height="48" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"
              />
            </svg>
          </div>
        )}

        {/* Duration Badge */}
        {gif.duration > 0 && (
          <div
            style={{
              position: 'absolute',
              bottom: '8px',
              right: '8px',
              padding: '4px 8px',
              backgroundColor: 'rgba(0, 0, 0, 0.75)',
              color: '#fff',
              fontSize: '11px',
              fontWeight: '500',
              borderRadius: '4px',
            }}
          >
            {formatDuration(gif.duration)}
          </div>
        )}

        {/* Privacy Badge */}
        {gif.privacy !== 'public_access' && (
          <div
            style={{
              position: 'absolute',
              top: '8px',
              left: '8px',
              padding: '4px 8px',
              backgroundColor: 'rgba(0, 0, 0, 0.75)',
              color: '#fff',
              fontSize: '11px',
              fontWeight: '500',
              borderRadius: '4px',
              textTransform: 'capitalize',
            }}
          >
            {gif.privacy === 'private_access' ? 'Private' : 'Unlisted'}
          </div>
        )}
      </div>

      {/* Card Content */}
      <div style={{ padding: '12px' }}>
        {/* Title and User Info */}
        <div style={{ marginBottom: '8px' }}>
          <h3
            style={{
              fontSize: '14px',
              fontWeight: '600',
              color: '#111827',
              marginBottom: '4px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              lineHeight: '1.4',
            }}
          >
            {gif.title}
          </h3>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              fontSize: '12px',
              color: '#6b7280',
              gap: '4px',
            }}
          >
            <span style={{ fontWeight: '500' }}>{gif.user.username}</span>
            {gif.user.is_verified && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="#3b82f6">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            <span>•</span>
            <span>{formatTimeAgo(gif.created_at)}</span>
          </div>
        </div>

        {/* Hashtags */}
        {gif.hashtag_names && gif.hashtag_names.length > 0 && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '4px',
              marginBottom: '8px',
            }}
          >
            {gif.hashtag_names.slice(0, 3).map((tag) => (
              <span
                key={tag}
                style={{
                  fontSize: '11px',
                  color: '#6366f1',
                  fontWeight: '500',
                }}
              >
                #{tag}
              </span>
            ))}
            {gif.hashtag_names.length > 3 && (
              <span
                style={{
                  fontSize: '11px',
                  color: '#9ca3af',
                }}
              >
                +{gif.hashtag_names.length - 3} more
              </span>
            )}
          </div>
        )}

        {/* Actions Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: '8px',
            borderTop: '1px solid #f3f4f6',
          }}
        >
          {/* Like Button */}
          <button
            onClick={handleLike}
            disabled={isLiking}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 8px',
              backgroundColor: 'transparent',
              border: 'none',
              borderRadius: '4px',
              cursor: isLiking ? 'not-allowed' : 'pointer',
              color: isLiked ? '#ef4444' : '#6b7280',
              fontSize: '13px',
              fontWeight: '500',
              transition: 'color 0.2s',
            }}
            onMouseEnter={(e) => {
              if (!isLiking) {
                e.currentTarget.style.color = '#ef4444';
              }
            }}
            onMouseLeave={(e) => {
              if (!isLiked && !isLiking) {
                e.currentTarget.style.color = '#6b7280';
              }
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill={isLiked ? 'currentColor' : 'none'}
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
              />
            </svg>
            <span>{likeCount}</span>
          </button>

          {/* Comments */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: '#6b7280',
              fontSize: '13px',
              fontWeight: '500',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
            <span>{gif.comment_count}</span>
          </div>

          {/* Views */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: '#6b7280',
              fontSize: '13px',
              fontWeight: '500',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
              />
            </svg>
            <span>{gif.view_count || 0}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
