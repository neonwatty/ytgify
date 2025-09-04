import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { GifCard } from './gif-card';
import { gifStore } from '@/storage/gif-store';
import type { GifData, GifMetadata } from '@/types/storage';

interface GridViewProps {
  onGifSelect?: (gif: GifData) => void;
  onGifDelete?: (id: string) => void;
  onGifDownload?: (gif: GifData) => void;
  onGifShare?: (gif: GifData) => void;
  enableVirtualScrolling?: boolean;
}

// Grid column configuration for different screen sizes
// const GRID_COLUMNS = {
//   sm: 1,
//   md: 2,
//   lg: 3,
//   xl: 4,
// } as const;

const ITEMS_PER_PAGE = 20;
const VIRTUAL_ITEM_HEIGHT = 320; // Approximate height of a gif card

export const GridView: React.FC<GridViewProps> = ({
  onGifSelect,
  onGifDelete,
  onGifDownload,
  onGifShare,
  enableVirtualScrolling = true,
}) => {
  const [gifs, setGifs] = useState<GifMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'title' | 'size'>('date');
  const [gridSize, setGridSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: ITEMS_PER_PAGE });
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  // const [scrollTop, setScrollTop] = useState(0);

  // Load GIFs from storage
  useEffect(() => {
    const loadGifs = async () => {
      try {
        setIsLoading(true);
        await gifStore.initialize();
        const allGifs = await gifStore.getAllMetadata();
        setGifs(allGifs);
      } catch (error) {
        console.error('Failed to load GIFs:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadGifs();

    // Set up storage event listener
    const handleStorageChange = (event: CustomEvent) => {
      if (event.detail.type === 'gif-added' || event.detail.type === 'gif-deleted') {
        loadGifs();
      }
    };

    window.addEventListener('storage-change', handleStorageChange as EventListener);
    return () => {
      window.removeEventListener('storage-change', handleStorageChange as EventListener);
    };
  }, []);

  // Filter and sort GIFs
  const filteredAndSortedGifs = useMemo(() => {
    let filtered = [...gifs];

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(gif => 
        (gif.title || '').toLowerCase().includes(term) ||
        (gif.description || '').toLowerCase().includes(term) ||
        gif.tags.some(tag => tag.toLowerCase().includes(term)) ||
        (gif.youtubeUrl || '').toLowerCase().includes(term)
      );
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'title':
          return (a.title || '').localeCompare(b.title || '');
        case 'size':
          return b.fileSize - a.fileSize;
        case 'date':
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

    return filtered;
  }, [gifs, searchTerm, sortBy]);

  // Virtual scrolling logic
  const visibleGifs = useMemo(() => {
    if (!enableVirtualScrolling) {
      return filteredAndSortedGifs;
    }
    return filteredAndSortedGifs.slice(visibleRange.start, visibleRange.end);
  }, [filteredAndSortedGifs, visibleRange, enableVirtualScrolling]);

  // Handle virtual scrolling
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (!enableVirtualScrolling) return;

    const container = e.currentTarget;
    const scrollTop = container.scrollTop;
    const containerHeight = container.clientHeight;

    // Calculate visible range based on scroll position
    const itemsPerRow = getColumnsForSize(gridSize);
    const rowHeight = VIRTUAL_ITEM_HEIGHT;
    // const totalRows = Math.ceil(filteredAndSortedGifs.length / itemsPerRow);
    // const scrollableHeight = totalRows * rowHeight;

    const firstVisibleRow = Math.floor(scrollTop / rowHeight);
    const lastVisibleRow = Math.ceil((scrollTop + containerHeight) / rowHeight);
    
    const start = Math.max(0, firstVisibleRow * itemsPerRow - itemsPerRow); // Buffer one row above
    const end = Math.min(filteredAndSortedGifs.length, lastVisibleRow * itemsPerRow + itemsPerRow); // Buffer one row below

    setVisibleRange({ start, end });
    // setScrollTop(scrollTop);
  }, [filteredAndSortedGifs.length, gridSize, enableVirtualScrolling]);

  const getColumnsForSize = (size: 'small' | 'medium' | 'large') => {
    switch (size) {
      case 'small': return 4;
      case 'medium': return 3;
      case 'large': return 2;
      default: return 3;
    }
  };

  const getGridClassName = () => {
    const columns = getColumnsForSize(gridSize);
    return `grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-${columns} xl:grid-cols-${columns + 1}`;
  };

  const handleDeleteGif = async (id: string) => {
    if (!confirm('Are you sure you want to delete this GIF?')) return;
    
    try {
      await gifStore.deleteGif(id);
      setGifs(prev => prev.filter(gif => gif.id !== id));
      onGifDelete?.(id);
    } catch (error) {
      console.error('Failed to delete GIF:', error);
      alert('Failed to delete GIF. Please try again.');
    }
  };

  const handleDownloadGif = async (metadata: GifMetadata) => {
    try {
      const fullGif = await gifStore.getGif(metadata.id);
      if (!fullGif) {
        throw new Error('GIF not found');
      }
      
      const url = URL.createObjectURL(fullGif.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${metadata.title || 'gif'}.gif`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      onGifDownload?.(fullGif);
    } catch (error) {
      console.error('Failed to download GIF:', error);
      alert('Failed to download GIF. Please try again.');
    }
  };

  const handleShareGif = async (metadata: GifMetadata) => {
    try {
      const fullGif = await gifStore.getGif(metadata.id);
      if (!fullGif) {
        throw new Error('GIF not found');
      }
      
      const file = new File([fullGif.blob], `${metadata.title || 'gif'}.gif`, {
        type: 'image/gif'
      });

      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: metadata.title || 'GIF from YouTube',
          text: metadata.description || 'Check out this GIF!',
          files: [file]
        });
      } else {
        // Fallback: copy to clipboard using our clipboard manager
        const { clipboardManager } = await import('@/utils/clipboard-manager');
        await clipboardManager.initialize();
        
        const result = await clipboardManager.copyGif(fullGif.blob, {
          title: metadata.title,
          filename: metadata.title || 'gif',
          fallbackToDownload: true
        });
        
        if (result.success) {
          alert(result.message || 'GIF copied to clipboard!');
        } else {
          alert(result.message || 'Failed to copy GIF to clipboard');
        }
      }
      
      onGifShare?.(fullGif);
    } catch (error) {
      console.error('Failed to share GIF:', error);
      alert('Failed to share GIF. Please try again.');
    }
  };

  const handleSelectGif = async (metadata: GifMetadata) => {
    if (!onGifSelect) return;
    
    try {
      const fullGif = await gifStore.getGif(metadata.id);
      if (fullGif) {
        onGifSelect(fullGif);
      }
    } catch (error) {
      console.error('Failed to load GIF:', error);
    }
  };

  const clearAllGifs = async () => {
    if (!confirm('Are you sure you want to delete ALL GIFs? This action cannot be undone.')) return;
    
    try {
      for (const gif of gifs) {
        await gifStore.deleteGif(gif.id);
      }
      setGifs([]);
    } catch (error) {
      console.error('Failed to clear all GIFs:', error);
      alert('Failed to clear GIFs. Please try again.');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-sm text-muted-foreground">Loading your GIF library...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">GIF Library</h2>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{filteredAndSortedGifs.length} {filteredAndSortedGifs.length === 1 ? 'GIF' : 'GIFs'}</span>
          {enableVirtualScrolling && visibleGifs.length < filteredAndSortedGifs.length && (
            <span className="text-xs">
              (showing {visibleRange.start + 1}-{Math.min(visibleRange.end, filteredAndSortedGifs.length)})
            </span>
          )}
        </div>
      </div>

      {gifs.length === 0 ? (
        /* Empty state */
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-6xl mb-4">📽️</div>
            <h3 className="text-xl font-semibold mb-2">No GIFs in your library</h3>
            <p className="text-muted-foreground mb-4">
              Create your first GIF from a YouTube video to see it here.
            </p>
            <Button onClick={() => window.close()}>
              Go to YouTube
            </Button>
          </div>
        </div>
      ) : (
        <>
          {/* Search and controls */}
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="Search GIFs by title, description, or tags..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1"
              />
              
              <Select value={sortBy} onValueChange={(value: typeof sortBy) => setSortBy(value)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date">Sort by Date</SelectItem>
                  <SelectItem value="title">Sort by Title</SelectItem>
                  <SelectItem value="size">Sort by Size</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={gridSize} onValueChange={(value: typeof gridSize) => setGridSize(value)}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="small">Small Grid</SelectItem>
                  <SelectItem value="medium">Medium Grid</SelectItem>
                  <SelectItem value="large">Large Grid</SelectItem>
                </SelectContent>
              </Select>
              
              {gifs.length > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={clearAllGifs}
                >
                  Clear All
                </Button>
              )}
            </div>
          </div>

          {/* GIF grid */}
          {filteredAndSortedGifs.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="text-4xl mb-2">🔍</div>
                <p className="text-muted-foreground">No GIFs match your search.</p>
              </div>
            </div>
          ) : (
            <ScrollArea 
              className="flex-1 pr-4" 
              onScroll={handleScroll}
              ref={scrollAreaRef}
            >
              {enableVirtualScrolling && visibleRange.start > 0 && (
                <div style={{ height: `${(visibleRange.start / getColumnsForSize(gridSize)) * VIRTUAL_ITEM_HEIGHT}px` }} />
              )}
              
              <div className={getGridClassName()}>
                {visibleGifs.map((gif) => (
                  <GifCard
                    key={gif.id}
                    gif={gif}
                    onSelect={() => handleSelectGif(gif)}
                    onDelete={() => handleDeleteGif(gif.id)}
                    onDownload={() => handleDownloadGif(gif)}
                    onShare={() => handleShareGif(gif)}
                    size={gridSize}
                  />
                ))}
              </div>
              
              {enableVirtualScrolling && visibleRange.end < filteredAndSortedGifs.length && (
                <div style={{ height: `${((filteredAndSortedGifs.length - visibleRange.end) / getColumnsForSize(gridSize)) * VIRTUAL_ITEM_HEIGHT}px` }} />
              )}
            </ScrollArea>
          )}
        </>
      )}
    </div>
  );
};

export default GridView;