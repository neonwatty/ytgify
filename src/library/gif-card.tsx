import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { GifMetadata } from '@/types/storage';
import { gifStore } from '@/storage/gif-store';

interface GifCardProps {
  gif: GifMetadata;
  onSelect?: () => void;
  onDelete?: () => void;
  onDownload?: () => void;
  onShare?: () => void;
  onEdit?: () => void;
  size?: 'small' | 'medium' | 'large';
  showActions?: boolean;
  lazyLoad?: boolean;
}

export const GifCard: React.FC<GifCardProps> = ({
  gif,
  onSelect,
  onDelete,
  onDownload,
  onShare,
  onEdit,
  size = 'medium',
  showActions = true,
  lazyLoad = true,
}) => {
  const [thumbnailUrl, setThumbnailUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isInView, setIsInView] = useState(!lazyLoad);
  const cardRef = React.useRef<HTMLDivElement>(null);

  // Lazy loading with Intersection Observer
  useEffect(() => {
    if (!lazyLoad || isInView) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setIsInView(true);
        }
      },
      { threshold: 0.1, rootMargin: '100px' }
    );

    const element = cardRef.current;
    if (element) {
      observer.observe(element);
    }

    return () => {
      if (element) {
        observer.unobserve(element);
      }
    };
  }, [lazyLoad, isInView]);

  // Load thumbnail when in view
  useEffect(() => {
    if (!isInView) return;

    const loadThumbnail = async () => {
      try {
        setIsLoading(true);
        // Try to load the full GIF data to get the thumbnail
        const fullGif = await gifStore.getGif(gif.id);
        if (fullGif?.thumbnailBlob) {
          const url = URL.createObjectURL(fullGif.thumbnailBlob);
          setThumbnailUrl(url);
          return () => URL.revokeObjectURL(url);
        } else if (fullGif?.blob) {
          // Use GIF as thumbnail if no separate thumbnail
          const url = URL.createObjectURL(fullGif.blob);
          setThumbnailUrl(url);
          return () => URL.revokeObjectURL(url);
        }
      } catch (error) {
        console.error('Failed to load thumbnail:', error);
        setImageError(true);
      } finally {
        setIsLoading(false);
      }
    };

    const cleanup = loadThumbnail();
    return () => {
      cleanup?.then(fn => fn?.());
    };
  }, [gif.id, isInView]);

  const formatFileSize = useCallback((bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }, []);

  const formatDuration = useCallback((seconds: number): string => {
    if (seconds < 1) return `${Math.round(seconds * 1000)}ms`;
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toFixed(0).padStart(2, '0')}`;
  }, []);

  const formatDate = useCallback((date: Date): string => {
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - new Date(date).getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return new Date(date).toLocaleDateString();
  }, []);

  const getCardSize = () => {
    switch (size) {
      case 'small':
        return 'w-full max-w-xs';
      case 'large':
        return 'w-full max-w-lg';
      case 'medium':
      default:
        return 'w-full max-w-sm';
    }
  };

  const getImageHeight = () => {
    switch (size) {
      case 'small':
        return 'h-32';
      case 'large':
        return 'h-64';
      case 'medium':
      default:
        return 'h-48';
    }
  };

  const handleAction = (e: React.MouseEvent, action: () => void) => {
    e.stopPropagation();
    action();
  };

  return (
    <Card 
      ref={cardRef}
      className={`${getCardSize()} cursor-pointer transition-shadow hover:shadow-lg`}
      onClick={onSelect}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className={`relative ${getImageHeight()} overflow-hidden bg-muted`}>
        {isLoading && isInView ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : imageError ? (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <svg
                className="w-12 h-12 mx-auto mb-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              <div className="text-xs">No preview</div>
            </div>
          </div>
        ) : thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={gif.title || 'GIF'}
            className={`w-full h-full object-cover transition-transform duration-200 ${
              isHovered ? 'scale-105' : ''
            }`}
            onError={() => setImageError(true)}
          />
        ) : null}

        {/* Duration badge */}
        <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
          {formatDuration(gif.duration)}
        </div>

        {/* Resolution badge */}
        <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
          {gif.width}×{gif.height}
        </div>

        {/* Quick action buttons on hover */}
        {showActions && isHovered && (
          <div className="absolute bottom-2 right-2 flex gap-1 opacity-0 animate-in fade-in duration-200">
            <Button
              size="icon"
              variant="secondary"
              className="h-8 w-8"
              onClick={(e) => handleAction(e, onDownload!)}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
              </svg>
            </Button>
            <Button
              size="icon"
              variant="secondary"
              className="h-8 w-8"
              onClick={(e) => handleAction(e, onShare!)}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m9.032 4.026a3 3 0 10-4.056-4.056A9 9 0 105.316 13.342" />
              </svg>
            </Button>
          </div>
        )}
      </div>

      <CardHeader className={size === 'small' ? 'p-3' : 'p-4'}>
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <CardTitle className={`${size === 'small' ? 'text-sm' : 'text-base'} line-clamp-1`}>
              {gif.title || 'Untitled GIF'}
            </CardTitle>
            {gif.description && size !== 'small' && (
              <CardDescription className="line-clamp-2 mt-1">
                {gif.description}
              </CardDescription>
            )}
          </div>
          {showActions && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-8 w-8 ml-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                  </svg>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem onClick={() => onDownload?.()}>
                  Download
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onShare?.()}>
                  Share
                </DropdownMenuItem>
                {onEdit && (
                  <DropdownMenuItem onClick={() => onEdit()}>
                    Edit
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => onDelete?.()}
                  className="text-destructive focus:text-destructive"
                >
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardHeader>

      {size !== 'small' && (
        <CardContent className="pt-0 px-4 pb-2">
          <div className="flex flex-wrap gap-1">
            {gif.tags.slice(0, 3).map((tag, index) => (
              <span
                key={index}
                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary"
              >
                {tag}
              </span>
            ))}
            {gif.tags.length > 3 && (
              <span className="text-xs text-muted-foreground">
                +{gif.tags.length - 3} more
              </span>
            )}
          </div>
        </CardContent>
      )}

      <CardFooter className={`${size === 'small' ? 'p-3' : 'p-4'} pt-0`}>
        <div className="flex items-center justify-between w-full text-xs text-muted-foreground">
          <span>{formatFileSize(gif.fileSize)}</span>
          <span>{formatDate(gif.createdAt)}</span>
        </div>
      </CardFooter>
    </Card>
  );
};

export default GifCard;