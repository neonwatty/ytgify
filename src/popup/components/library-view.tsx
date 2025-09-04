import React from 'react';
import { Button } from '@/components/ui/button';
import { gifStorage, type GifData } from '@/lib/storage';

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
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
      {/* Thumbnail */}
      <div className="aspect-video bg-gray-100 relative group">
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : imageUrl ? (
          <img
            src={imageUrl}
            alt={gif.metadata.title || 'GIF'}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <div className="text-2xl mb-2">🎬</div>
              <div className="text-xs">No preview</div>
            </div>
          </div>
        )}
        
        {/* Overlay buttons */}
        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={(e) => {
                e.stopPropagation();
                onDownload(gif);
              }}
              className="bg-white text-gray-900 hover:bg-gray-100"
            >
              ⬇️
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={(e) => {
                e.stopPropagation();
                onShare(gif);
              }}
              className="bg-white text-gray-900 hover:bg-gray-100"
            >
              📤
            </Button>
          </div>
        </div>

        {/* Duration badge */}
        <div className="absolute top-2 right-2 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded">
          {formatDuration(gif.metadata.duration)}
        </div>
      </div>

      {/* Content */}
      <div className="p-3 space-y-2">
        <div>
          <h3 className="font-medium text-sm text-gray-900 line-clamp-2">
            {gif.metadata.title || 'Untitled GIF'}
          </h3>
          {gif.metadata.description && (
            <p className="text-xs text-gray-600 line-clamp-1 mt-1">
              {gif.metadata.description}
            </p>
          )}
        </div>

        {/* Metadata */}
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>{gif.metadata.width}×{gif.metadata.height}</span>
          <span>{formatFileSize(gif.metadata.fileSize)}</span>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2 border-t border-gray-100">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onDownload(gif)}
            className="flex-1 text-xs"
          >
            Download
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onDelete(gif.id)}
            className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
};

const LibraryView: React.FC = () => {
  const [gifs, setGifs] = React.useState<GifData[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [sortBy, setSortBy] = React.useState<'date' | 'title' | 'size'>('date');

  // Load GIFs from storage
  React.useEffect(() => {
    const loadGifs = async () => {
      try {
        setIsLoading(true);
        const allGifs = await gifStorage.getAllGifs();
        setGifs(allGifs);
      } catch (error) {
        console.error('Failed to load GIFs:', error);
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
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

    return filtered;
  }, [gifs, searchTerm, sortBy]);

  const handleDeleteGif = async (id: string) => {
    if (!confirm('Are you sure you want to delete this GIF?')) return;
    
    try {
      await gifStorage.deleteGif(id);
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
      await gifStorage.clearAllGifs();
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
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-lg text-gray-900">GIF Library</h2>
        <span className="text-sm text-gray-500">
          {filteredAndSortedGifs.length} {filteredAndSortedGifs.length === 1 ? 'GIF' : 'GIFs'}
        </span>
      </div>

      {gifs.length === 0 ? (
        /* Empty state */
        <div className="text-center py-12">
          <div className="text-4xl mb-4">📽️</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No GIFs yet</h3>
          <p className="text-sm text-gray-600 mb-4">
            Create your first GIF from a YouTube video to see it here.
          </p>
          <Button variant="youtube" onClick={() => window.close()}>
            Go Create a GIF
          </Button>
        </div>
      ) : (
        <>
          {/* Search and controls */}
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Search GIFs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            
            <div className="flex items-center justify-between">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="date">Sort by Date</option>
                <option value="title">Sort by Title</option>
                <option value="size">Sort by Size</option>
              </select>
              
              {gifs.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAllGifs}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  Clear All
                </Button>
              )}
            </div>
          </div>

          {/* GIF grid */}
          {filteredAndSortedGifs.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-2xl mb-2">🔍</div>
              <p className="text-sm text-gray-600">No GIFs match your search.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 max-h-80 overflow-y-auto">
              {filteredAndSortedGifs.map((gif) => (
                <GifCard
                  key={gif.id}
                  gif={gif}
                  onDelete={handleDeleteGif}
                  onDownload={handleDownloadGif}
                  onShare={handleShareGif}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default LibraryView;