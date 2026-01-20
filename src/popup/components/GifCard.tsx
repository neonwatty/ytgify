/**
 * GifCard Component
 *
 * Displays a single GIF with social features (like, view count, etc.)
 * Used in TrendingView and UserProfileView
 */

import React, { useState } from 'react';
import { apiClient } from '@/lib/api/api-client';
import type { UploadedGif, LikeResponse } from '@/types/auth';

interface GifCardProps {
  gif: UploadedGif;
  onLikeUpdate?: (gifId: string, likeResponse: LikeResponse) => void;
}

export const GifCard: React.FC<GifCardProps> = ({ gif, onLikeUpdate }) => {
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(gif.like_count);
  const [isLiking, setIsLiking] = useState(false);
  const [imageError, setImageError] = useState(false);

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (isLiking) return;

    try {
      setIsLiking(true);
      const response: LikeResponse = await apiClient.toggleLike(gif.id);

      setIsLiked(response.liked);
      setLikeCount(response.like_count);
      onLikeUpdate?.(gif.id, response);
    } catch (err) {
      console.error('[GifCard] Like/unlike failed:', err);
    } finally {
      setIsLiking(false);
    }
  };

  const formatCount = (count: number): string => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    }
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };

  const handleImageError = () => {
    setImageError(true);
  };

  return (
    <div className="gif-card">
      <div className="gif-card__media">
        {imageError ? (
          <div className="gif-card__placeholder">
            <span>Failed to load</span>
          </div>
        ) : (
          <img
            src={gif.thumbnail_url || gif.file_url}
            alt={gif.title}
            loading="lazy"
            onError={handleImageError}
          />
        )}

        {/* Overlay with stats */}
        <div className="gif-card__overlay">
          <div className="gif-card__stats">
            <span className="gif-card__stat">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
              </svg>
              {formatCount(gif.view_count)}
            </span>
            <span className="gif-card__stat">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M21.99 4c0-1.1-.89-2-1.99-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4-.01-18z" />
              </svg>
              {formatCount(gif.comment_count)}
            </span>
          </div>
        </div>
      </div>

      <div className="gif-card__content">
        <div className="gif-card__header">
          <div className="gif-card__user">
            {gif.user.avatar_url ? (
              <img
                src={gif.user.avatar_url}
                alt={gif.user.username}
                className="gif-card__avatar"
              />
            ) : (
              <div className="gif-card__avatar gif-card__avatar--placeholder">
                {gif.user.username.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="gif-card__username">
              {gif.user.display_name || gif.user.username}
              {gif.user.is_verified && (
                <svg
                  className="gif-card__verified"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="#1d9bf0"
                >
                  <path d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.71-3.998-3.818-3.998-.47 0-.92.084-1.336.25C14.818 2.415 13.51 1.5 12 1.5s-2.816.917-3.437 2.25c-.415-.165-.866-.25-1.336-.25-2.11 0-3.818 1.79-3.818 4 0 .494.083.964.237 1.4-1.272.65-2.147 2.018-2.147 3.6 0 1.495.782 2.798 1.942 3.486-.02.17-.032.34-.032.514 0 2.21 1.708 4 3.818 4 .47 0 .92-.086 1.335-.25.62 1.334 1.926 2.25 3.437 2.25 1.512 0 2.818-.916 3.437-2.25.415.163.865.248 1.336.248 2.11 0 3.818-1.79 3.818-4 0-.174-.012-.344-.033-.513 1.158-.687 1.943-1.99 1.943-3.484zm-6.616-3.334l-4.334 6.5c-.145.217-.382.334-.625.334-.143 0-.288-.04-.416-.126l-.115-.094-2.415-2.415c-.293-.293-.293-.768 0-1.06s.768-.294 1.06 0l1.77 1.767 3.825-5.74c.23-.345.696-.436 1.04-.207.346.23.44.696.21 1.04z" />
                </svg>
              )}
            </span>
          </div>

          <button
            className={`gif-card__like-btn ${isLiked ? 'gif-card__like-btn--liked' : ''}`}
            onClick={handleLike}
            disabled={isLiking}
            aria-label={isLiked ? 'Unlike' : 'Like'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill={isLiked ? '#ef4444' : 'none'} stroke="currentColor" strokeWidth="2">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            <span>{formatCount(likeCount)}</span>
          </button>
        </div>

        <h3 className="gif-card__title">{gif.title}</h3>

        {gif.hashtag_names.length > 0 && (
          <div className="gif-card__hashtags">
            {gif.hashtag_names.slice(0, 3).map((tag) => (
              <span key={tag} className="gif-card__hashtag">
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <style>{`
        .gif-card {
          background: #1a1a2e;
          border-radius: 12px;
          overflow: hidden;
          transition: transform 0.2s, box-shadow 0.2s;
        }

        .gif-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
        }

        .gif-card__media {
          position: relative;
          aspect-ratio: 16/9;
          background: #0f0f1a;
          overflow: hidden;
        }

        .gif-card__media img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .gif-card__placeholder {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #666;
          font-size: 12px;
        }

        .gif-card__overlay {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          padding: 8px;
          background: linear-gradient(transparent, rgba(0, 0, 0, 0.7));
          opacity: 0;
          transition: opacity 0.2s;
        }

        .gif-card:hover .gif-card__overlay {
          opacity: 1;
        }

        .gif-card__stats {
          display: flex;
          gap: 12px;
        }

        .gif-card__stat {
          display: flex;
          align-items: center;
          gap: 4px;
          color: white;
          font-size: 12px;
        }

        .gif-card__content {
          padding: 12px;
        }

        .gif-card__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 8px;
        }

        .gif-card__user {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .gif-card__avatar {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          object-fit: cover;
        }

        .gif-card__avatar--placeholder {
          background: #3b82f6;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 600;
        }

        .gif-card__username {
          display: flex;
          align-items: center;
          gap: 4px;
          color: #e2e8f0;
          font-size: 13px;
          font-weight: 500;
        }

        .gif-card__verified {
          flex-shrink: 0;
        }

        .gif-card__like-btn {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 4px 8px;
          background: transparent;
          border: 1px solid #374151;
          border-radius: 6px;
          color: #9ca3af;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .gif-card__like-btn:hover {
          border-color: #ef4444;
          color: #ef4444;
        }

        .gif-card__like-btn--liked {
          border-color: #ef4444;
          color: #ef4444;
        }

        .gif-card__like-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .gif-card__title {
          margin: 0;
          color: #f1f5f9;
          font-size: 14px;
          font-weight: 600;
          line-height: 1.3;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .gif-card__hashtags {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          margin-top: 8px;
        }

        .gif-card__hashtag {
          padding: 2px 6px;
          background: #1e3a5f;
          border-radius: 4px;
          color: #60a5fa;
          font-size: 11px;
        }
      `}</style>
    </div>
  );
};
