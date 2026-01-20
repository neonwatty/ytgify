/**
 * TrendingView Component
 *
 * Displays trending GIFs from the community
 * Phase 3: Social Features
 */

import React, { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api/api-client';
import type { UploadedGif, GifListResponse, LikeResponse } from '@/types/auth';
import { GifCard } from './GifCard';

export const TrendingView: React.FC = () => {
  const [gifs, setGifs] = useState<UploadedGif[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    loadTrendingGifs();
  }, []);

  const loadTrendingGifs = async (page: number = 1) => {
    try {
      setLoading(true);
      setError(null);

      const response: GifListResponse = await apiClient.getTrendingGifs(page, 10);

      if (page === 1) {
        setGifs(response.gifs);
      } else {
        setGifs((prev) => [...prev, ...response.gifs]);
      }

      setCurrentPage(page);
      setHasMore(response.gifs.length === 10);

      console.log('[TrendingView] Loaded', response.gifs.length, 'trending GIFs');
    } catch (err) {
      console.error('[TrendingView] Failed to load trending GIFs:', err);
      setError('Failed to load trending GIFs');
    } finally {
      setLoading(false);
    }
  };

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      loadTrendingGifs(currentPage + 1);
    }
  };

  const handleLikeUpdate = (gifId: string, likeResponse: LikeResponse) => {
    setGifs((prev) =>
      prev.map((gif) =>
        gif.id === gifId ? { ...gif, like_count: likeResponse.like_count } : gif
      )
    );
  };

  return (
    <div style={{ padding: '20px' }}>
      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <h2
          style={{
            fontSize: '20px',
            fontWeight: '700',
            color: '#111827',
            marginBottom: '8px',
          }}
        >
          Trending GIFs
        </h2>
        <p style={{ fontSize: '14px', color: '#6b7280' }}>
          Popular GIFs from the ytgify community
        </p>
      </div>

      {/* Loading State */}
      {loading && gifs.length === 0 && (
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
          <p style={{ marginTop: '16px', color: '#666', fontSize: '14px' }}>
            Loading trending GIFs...
          </p>
        </div>
      )}

      {/* Error State */}
      {error && !loading && gifs.length === 0 && (
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
            onClick={() => loadTrendingGifs()}
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
      {!loading && !error && gifs.length === 0 && (
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
            No trending GIFs
          </p>
          <p style={{ fontSize: '14px', color: '#6b7280' }}>
            Check back later for popular content
          </p>
        </div>
      )}

      {/* GIF Grid */}
      {gifs.length > 0 && (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr',
              gap: '12px',
              marginBottom: '16px',
            }}
          >
            {gifs.map((gif) => (
              <GifCard key={gif.id} gif={gif} onLikeUpdate={handleLikeUpdate} />
            ))}
          </div>

          {/* Load More Button */}
          {hasMore && (
            <button
              onClick={handleLoadMore}
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '14px',
                fontWeight: '600',
                color: '#6366f1',
                backgroundColor: '#fff',
                border: '1px solid #6366f1',
                borderRadius: '6px',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.2s',
              }}
            >
              {loading ? 'Loading...' : 'Load More'}
            </button>
          )}

          {/* No More GIFs Message */}
          {!hasMore && gifs.length > 0 && (
            <div
              style={{
                padding: '12px',
                textAlign: 'center',
                fontSize: '13px',
                color: '#9ca3af',
              }}
            >
              No more trending GIFs
            </div>
          )}
        </>
      )}
    </div>
  );
};
