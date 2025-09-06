import React from 'react';
import { Button } from '@/components/ui/button';
import { gifStorage, type GifData } from '@/lib/storage';
import { chromeGifStorage } from '@/lib/chrome-gif-storage';

interface GifCardProps {
  gif: GifData;
  onDelete: (id: string) => void;
  onDownload: (gif: GifData) => void;
  onShare: (gif: GifData) => void;
}

const GifCard: React.FC<GifCardProps> = ({ gif, onDelete, onDownload, onShare }) => {
  const [imageUrl, setImageUrl] = React.useState<string>('');
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const loadThumbnail = async () => {
      if (gif.thumbnailBlob) {
        const url = URL.createObjectURL(gif.thumbnailBlob);
        setImageUrl(url);
        setIsLoading(false);
        
        return () => URL.revokeObjectURL(url);
      } else if (gif.gifBlob) {
        // Use GIF as thumbnail if no separate thumbnail
        const url = URL.createObjectURL(gif.gifBlob);
        setImageUrl(url);
        setIsLoading(false);
        
        return () => URL.revokeObjectURL(url);
      }
      setIsLoading(false);
    };

    loadThumbnail();
  }, [gif]);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDuration = (seconds: number): string => {
    return `${seconds.toFixed(1)}s`;
  };

  return (
    <div className="flex gap-2 p-2 bg-white rounded border border-gray-200 hover:bg-gray-50 transition-colors">
      {/* Compact Thumbnail */}
      <div className="w-20 h-14 bg-gray-100 rounded overflow-hidden flex-shrink-0 relative">
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
          </div>
        ) : imageUrl ? (
          <img
            src={imageUrl}
            alt={gif.metadata.title || 'GIF'}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-gray-400">
            <div className="text-xs">🎬</div>
          </div>
        )}
        {/* Duration badge */}
        <div className="absolute bottom-0 right-0 bg-black bg-opacity-70 text-white text-xs px-1 rounded-tl">
          {formatDuration(gif.metadata.duration)}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 flex flex-col justify-between">
        <div>
          <h3 className="font-medium text-xs text-gray-900 line-clamp-1" title={gif.metadata.title || 'Untitled GIF'}>
            {gif.metadata.title || 'Untitled GIF'}
          </h3>
          <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
            <span>{gif.metadata.width}×{gif.metadata.height}</span>
            <span>•</span>
            <span>{formatFileSize(gif.metadata.fileSize)}</span>
          </div>
        </div>
      </div>

      {/* Compact Actions */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => onDownload(gif)}
          className="p-1 text-gray-600 hover:text-blue-600 transition-colors"
          title="Download"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        </button>
        <button
          onClick={() => onShare(gif)}
          className="p-1 text-gray-600 hover:text-blue-600 transition-colors"
          title="Share"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m9.032 4.026a3 3 0 10-4.732-2.684m4.732 2.684a3 3 0 01-4.732-2.684M6 12a3 3 0 110-6 3 3 0 010 6z" />
          </svg>
        </button>
        <button
          onClick={() => onDelete(gif.id)}
          className="p-1 text-gray-600 hover:text-red-600 transition-colors"
          title="Delete"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  );
};

const LibraryView: React.FC = () => {
  const [gifs, setGifs] = React.useState<GifData[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [sortBy, setSortBy] = React.useState<'date' | 'title' | 'size'>('date');
  const [currentPage, setCurrentPage] = React.useState(0);
  const ITEMS_PER_PAGE = 4;

  // Load GIFs from storage
  React.useEffect(() => {
    const loadGifs = async () => {
      console.log('[LibraryView] Starting to load GIFs...');
      try {
        setIsLoading(true);
        // Check chrome.storage availability
        console.log('[LibraryView] Chrome storage check:', {
          hasChrome: typeof chrome !== 'undefined',
          hasStorage: typeof chrome !== 'undefined' && !!chrome.storage,
          hasLocal: typeof chrome !== 'undefined' && !!chrome.storage?.local
        });
        
        // Use chrome storage helper
        const storedGifs = await chromeGifStorage.getAllGifs();
        console.log('[LibraryView] Retrieved stored GIFs:', {
          count: storedGifs.length,
          firstGif: storedGifs[0]
        });
        
        // Convert to display format
        const displayGifs = await Promise.all(
          storedGifs.map(gif => chromeGifStorage.convertToDisplayFormat(gif))
        );
        console.log('[LibraryView] Converted to display format:', {
          count: displayGifs.length
        });
        
        setGifs(displayGifs);
      } catch (error) {
        console.error('[LibraryView] Failed to load GIFs:', error);
        // Fallback to IndexedDB if chrome.storage fails
        try {
          const allGifs = await gifStorage.getAllGifs();
          setGifs(allGifs);
        } catch (dbError) {
          console.error('Failed to load from IndexedDB too:', dbError);
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadGifs();
  }, []);

  // Filter and sort GIFs
  const filteredAndSortedGifs = React.useMemo(() => {
    let filtered = gifs;

    // Filter by search term
    if (searchTerm) {
      filtered = gifs.filter(gif => 
        (gif.metadata.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (gif.metadata.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (gif.metadata.youtubeUrl || '').toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'title':
          return (a.metadata.title || '').localeCompare(b.metadata.title || '');
        case 'size':
          return b.metadata.fileSize - a.metadata.fileSize;
        case 'date':
        default:
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 
                       a.metadata?.createdAt ? new Date(a.metadata.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() :
                       b.metadata?.createdAt ? new Date(b.metadata.createdAt).getTime() : 0;
          return dateB - dateA;
      }
    });

    return filtered;
  }, [gifs, searchTerm, sortBy]);

  // Calculate pagination
  const totalPages = Math.ceil(filteredAndSortedGifs.length / ITEMS_PER_PAGE);
  const paginatedGifs = filteredAndSortedGifs.slice(
    currentPage * ITEMS_PER_PAGE,
    (currentPage + 1) * ITEMS_PER_PAGE
  );

  // Reset page when search changes
  React.useEffect(() => {
    setCurrentPage(0);
  }, [searchTerm, sortBy]);

  const handleDeleteGif = async (id: string) => {
    if (!confirm('Are you sure you want to delete this GIF?')) return;
    
    try {
      await chromeGifStorage.deleteGif(id);
      setGifs(prev => prev.filter(gif => gif.id !== id));
    } catch (error) {
      console.error('Failed to delete GIF:', error);
      alert('Failed to delete GIF. Please try again.');
    }
  };

  const handleDownloadGif = async (gif: GifData) => {
    try {
      const url = URL.createObjectURL(gif.gifBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${gif.metadata.title || 'gif'}.gif`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download GIF:', error);
      alert('Failed to download GIF. Please try again.');
    }
  };

  const handleShareGif = async (gif: GifData) => {
    try {
      const file = new File([gif.gifBlob], `${gif.metadata.title || 'gif'}.gif`, {
        type: 'image/gif'
      });

      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: gif.metadata.title || 'GIF from YouTube',
          text: gif.metadata.description || 'Check out this GIF!',
          files: [file]
        });
      } else {
        // Fallback: copy to clipboard using our clipboard manager
        const { clipboardManager } = await import('@/utils/clipboard-manager');
        await clipboardManager.initialize();
        
        const result = await clipboardManager.copyGif(gif.gifBlob, {
          title: gif.metadata.title,
          filename: gif.metadata.title || 'gif',
          fallbackToDownload: true
        });
        
        if (result.success) {
          alert(result.message || 'GIF copied to clipboard!');
        } else {
          alert(result.message || 'Failed to copy GIF to clipboard');
        }
      }
    } catch (error) {
      console.error('Failed to share GIF:', error);
      alert('Failed to share GIF. Please try again.');
    }
  };

  const clearAllGifs = async () => {
    if (!confirm('Are you sure you want to delete ALL GIFs? This action cannot be undone.')) return;
    
    try {
      const { chromeGifStorage } = await import('@/lib/chrome-gif-storage');
      await chromeGifStorage.clearAllGifs();
      setGifs([]);
    } catch (error) {
      console.error('Failed to clear all GIFs:', error);
      alert('Failed to clear GIFs. Please try again.');
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-sm text-gray-600">Loading your GIFs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-2 h-full flex flex-col">
      {gifs.length === 0 ? (
        /* Empty state */
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-3xl mb-2">📽️</div>
            <h3 className="text-sm font-medium text-gray-900 mb-1">No GIFs yet</h3>
            <p className="text-xs text-gray-600 mb-3">
              Create your first GIF from a YouTube video
            </p>
            <Button variant="youtube" size="sm" onClick={() => window.close()}>
              Create GIF
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col h-full">
          {/* Compact Search and controls */}
          <div className="space-y-2 mb-2">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="text-xs border border-gray-300 rounded px-1 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="date">Date</option>
                <option value="title">Title</option>
                <option value="size">Size</option>
              </select>
            </div>
            
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>{filteredAndSortedGifs.length} GIFs total</span>
              {gifs.length > 0 && (
                <button
                  onClick={clearAllGifs}
                  className="text-red-600 hover:text-red-700"
                >
                  Clear All
                </button>
              )}
            </div>
          </div>

          {/* GIF list */}
          {filteredAndSortedGifs.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="text-2xl mb-1">🔍</div>
                <p className="text-xs text-gray-600">No matches found</p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex-1 space-y-1 overflow-hidden">
                {paginatedGifs.map((gif) => (
                  <GifCard
                    key={gif.id}
                    gif={gif}
                    onDelete={handleDeleteGif}
                    onDownload={handleDownloadGif}
                    onShare={handleShareGif}
                  />
                ))}
              </div>
              
              {/* Pagination controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-2 mt-2 border-t">
                  <button
                    onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                    disabled={currentPage === 0}
                    className="p-1 text-gray-600 disabled:text-gray-300"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <span className="text-xs text-gray-600">
                    {currentPage + 1} / {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
                    disabled={currentPage === totalPages - 1}
                    className="p-1 text-gray-600 disabled:text-gray-300"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default LibraryView;