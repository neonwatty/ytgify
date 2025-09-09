// Chrome storage implementation for GIFs
// Uses chrome.storage.local which is accessible from all extension contexts

export interface StoredGif {
  id: string;
  title: string;
  description?: string;
  metadata: {
    width: number;
    height: number;
    duration: number;
    frameRate: number;
    fileSize: number;
    createdAt: string; // ISO string
    youtubeUrl?: string;
    startTime?: number;
    endTime?: number;
  };
  tags: string[];
  // Store blob data as base64 for chrome.storage
  gifDataUrl?: string; // Data URL for the GIF
  thumbnailDataUrl?: string; // Data URL for thumbnail
}

export class ChromeGifStorage {
  private readonly STORAGE_KEY = 'stored_gifs';
  private readonly MAX_GIFS = 50; // Limit number of GIFs to avoid quota issues

  async saveGifFromDataUrl(gif: {
    id: string;
    title: string;
    description?: string;
    gifDataUrl: string;
    thumbnailDataUrl?: string;
    metadata: {
      width: number;
      height: number;
      duration: number;
      frameRate: number;
      fileSize: number;
      createdAt: Date;
      lastModified?: Date;
      youtubeUrl?: string;
      startTime?: number;
      endTime?: number;
      editorVersion?: number;
      originalGifId?: string;
    };
    tags?: string[];
  }): Promise<void> {

    // Validate chrome.storage is available
    if (!chrome?.storage?.local) {
      console.error('[ChromeGifStorage] chrome.storage.local is not available!');
      throw new Error('chrome.storage.local is not available');
    }
    
    const storedGif: StoredGif = {
      id: gif.id,
      title: gif.title,
      description: gif.description,
      metadata: {
        ...gif.metadata,
        createdAt: gif.metadata.createdAt instanceof Date 
          ? gif.metadata.createdAt.toISOString() 
          : gif.metadata.createdAt
      },
      tags: gif.tags || [],
      gifDataUrl: gif.gifDataUrl,
      thumbnailDataUrl: gif.thumbnailDataUrl
    };

    // Get existing GIFs
    const existing = await this.getAllGifs();
    
    // Add new GIF
    existing.unshift(storedGif);
    
    // Limit the number of stored GIFs
    if (existing.length > this.MAX_GIFS) {
      existing.splice(this.MAX_GIFS);
    }

    // Save to chrome.storage
    try {
      await chrome.storage.local.set({ [this.STORAGE_KEY]: existing });

      // Verify it was saved
      const verification = await chrome.storage.local.get(this.STORAGE_KEY);
      
    } catch (error) {
      console.error('[ChromeGifStorage] Failed to save to chrome.storage.local:', error);
      throw error;
    }
  }

  async saveGif(gif: {
    id: string;
    title: string;
    description?: string;
    blob: Blob;
    thumbnailBlob?: Blob;
    metadata: {
      width: number;
      height: number;
      duration: number;
      frameRate: number;
      fileSize: number;
      createdAt: Date;
      lastModified?: Date;
      youtubeUrl?: string;
      startTime?: number;
      endTime?: number;
      editorVersion?: number;
      originalGifId?: string;
    };
    tags?: string[];
  }): Promise<void> {

    // Convert blobs to data URLs for storage
    const gifDataUrl = await this.blobToDataUrl(gif.blob);
    const thumbnailDataUrl = gif.thumbnailBlob ? await this.blobToDataUrl(gif.thumbnailBlob) : undefined;

    const storedGif: StoredGif = {
      id: gif.id,
      title: gif.title,
      description: gif.description,
      metadata: {
        ...gif.metadata,
        createdAt: gif.metadata.createdAt instanceof Date 
          ? gif.metadata.createdAt.toISOString() 
          : gif.metadata.createdAt
      },
      tags: gif.tags || [],
      gifDataUrl,
      thumbnailDataUrl
    };

    // Get existing GIFs
    const existing = await this.getAllGifs();
    
    // Add new GIF
    existing.unshift(storedGif);
    
    // Limit the number of stored GIFs
    if (existing.length > this.MAX_GIFS) {
      existing.splice(this.MAX_GIFS);
    }

    // Save to chrome.storage
    await chrome.storage.local.set({ [this.STORAGE_KEY]: existing });
  }

  async getAllGifs(): Promise<StoredGif[]> {
    
    try {
      const result = await chrome.storage.local.get(this.STORAGE_KEY);
      const gifs = result[this.STORAGE_KEY] || [];
       => g.id)
      });
      return gifs;
    } catch (error) {
      console.error('[ChromeGifStorage] Failed to get GIFs:', error);
      return [];
    }
  }

  async getGif(id: string): Promise<StoredGif | null> {
    const gifs = await this.getAllGifs();
    return gifs.find(g => g.id === id) || null;
  }

  async deleteGif(id: string): Promise<void> {
    const gifs = await this.getAllGifs();
    const filtered = gifs.filter(g => g.id !== id);
    await chrome.storage.local.set({ [this.STORAGE_KEY]: filtered });
  }

  async clearAllGifs(): Promise<void> {
    await chrome.storage.local.set({ [this.STORAGE_KEY]: [] });
  }

  // Convert stored GIF back to the format expected by components
  async convertToDisplayFormat(gif: StoredGif): Promise<{
    id: string;
    title: string;
    description?: string;
    gifBlob: Blob;
    thumbnailBlob?: Blob;
    metadata: {
      width: number;
      height: number;
      duration: number;
      frameRate: number;
      fileSize: number;
      createdAt: Date;
      lastModified?: Date;
      youtubeUrl?: string;
      startTime?: number;
      endTime?: number;
      editorVersion?: number;
      originalGifId?: string;
    };
    tags?: string[];
  }> {
    return {
      id: gif.id,
      title: gif.title,
      description: gif.description,
      gifBlob: gif.gifDataUrl ? await this.dataUrlToBlob(gif.gifDataUrl) : new Blob(),
      thumbnailBlob: gif.thumbnailDataUrl ? await this.dataUrlToBlob(gif.thumbnailDataUrl) : undefined,
      metadata: {
        ...gif.metadata,
        createdAt: new Date(gif.metadata.createdAt)
      },
      tags: gif.tags
    };
  }

  private async blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      // Validate that we have a valid blob
      if (!blob || !(blob instanceof Blob)) {
        console.error('Invalid blob provided:', blob);
        reject(new Error('Invalid blob provided to blobToDataUrl'));
        return;
      }
      
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  private async dataUrlToBlob(dataUrl: string): Promise<Blob> {
    const response = await fetch(dataUrl);
    return response.blob();
  }
}

export const chromeGifStorage = new ChromeGifStorage();