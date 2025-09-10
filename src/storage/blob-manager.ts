interface CompressionResult {
  blob: Blob;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
}

interface ChunkedBlob {
  id: string;
  chunks: Blob[];
  metadata: {
    totalSize: number;
    chunkCount: number;
    mimeType: string;
    checksum?: string;
  };
}

export class BlobManager {
  private readonly chunkSize: number;
  private readonly compressionWorker: Worker | null = null;
  private readonly maxBlobSize = 50 * 1024 * 1024; // 50MB max blob size
  private readonly compressionThreshold = 1024 * 1024; // 1MB
  private quotaCache: { total: number; available: number } | null = null;
  private quotaCacheTimestamp = 0;
  private readonly quotaCacheDuration = 60000; // 1 minute cache

  constructor(chunkSize: number = 256 * 1024) {
    this.chunkSize = chunkSize;
    this.initializeCompressionWorker();
  }

  async initialize(): Promise<void> {
    // Pre-fetch quota information
    await this.updateQuotaCache();
  }

  private initializeCompressionWorker(): void {
    // In a real implementation, this would initialize a Web Worker for compression
    // For now, we'll use the main thread
  }

  async processBlob(blob: Blob): Promise<Blob> {
    // Validate blob
    if (!blob || blob.size === 0) {
      throw new Error('Invalid blob: empty or undefined');
    }

    if (blob.size > this.maxBlobSize) {
      throw new Error(`Blob size (${blob.size} bytes) exceeds maximum allowed (${this.maxBlobSize} bytes)`);
    }

    // Check available storage quota
    const hasSpace = await this.checkStorageQuota(blob.size);
    if (!hasSpace) {
      throw new Error('Insufficient storage quota');
    }

    // Compress if needed
    if (blob.size > this.compressionThreshold) {
      try {
        const compressed = await this.compressBlob(blob);
        if (compressed.compressionRatio < 0.9) {
          // Only use compressed version if it's at least 10% smaller
          return compressed.blob;
        }
      } catch (error) {
        console.warn('Compression failed, using original blob:', error);
      }
    }

    return blob;
  }

  private async compressBlob(blob: Blob): Promise<CompressionResult> {
    const originalSize = blob.size;

    // Check if blob is already compressed (GIF, JPEG, PNG)
    const mimeType = blob.type.toLowerCase();
    if (this.isCompressedFormat(mimeType)) {
      return {
        blob,
        originalSize,
        compressedSize: originalSize,
        compressionRatio: 1.0
      };
    }

    try {
      // Convert to compressed format if possible
      if (mimeType.startsWith('image/') && !mimeType.includes('gif')) {
        const compressedBlob = await this.compressImage(blob);
        return {
          blob: compressedBlob,
          originalSize,
          compressedSize: compressedBlob.size,
          compressionRatio: compressedBlob.size / originalSize
        };
      }

      // For GIFs and other formats, try generic compression
      const compressedBlob = await this.genericCompress(blob);
      return {
        blob: compressedBlob,
        originalSize,
        compressedSize: compressedBlob.size,
        compressionRatio: compressedBlob.size / originalSize
      };
    } catch (error) {
      console.error('Compression failed:', error);
      return {
        blob,
        originalSize,
        compressedSize: originalSize,
        compressionRatio: 1.0
      };
    }
  }

  private isCompressedFormat(mimeType: string): boolean {
    const compressedFormats = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'image/avif'
    ];
    return compressedFormats.includes(mimeType);
  }

  private async compressImage(blob: Blob): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      img.onload = () => {
        // Maintain aspect ratio
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        canvas.toBlob(
          (compressedBlob) => {
            if (compressedBlob) {
              resolve(compressedBlob);
            } else {
              reject(new Error('Failed to compress image'));
            }
          },
          'image/webp',
          0.85 // 85% quality
        );

        // Clean up
        URL.revokeObjectURL(img.src);
      };

      img.onerror = () => {
        URL.revokeObjectURL(img.src);
        reject(new Error('Failed to load image for compression'));
      };

      img.src = URL.createObjectURL(blob);
    });
  }

  private async genericCompress(blob: Blob): Promise<Blob> {
    // Use CompressionStream API if available
    if ('CompressionStream' in window) {
      try {
        const stream = blob.stream();
        const compressedStream = stream.pipeThrough(new (window as unknown as { CompressionStream: typeof CompressionStream }).CompressionStream('gzip'));
        const compressedBlob = await new Response(compressedStream).blob();
        
        // Add metadata to indicate compression
        return new Blob([compressedBlob], {
          type: blob.type || 'application/octet-stream'
        });
      } catch (error) {
        console.warn('CompressionStream failed:', error);
      }
    }

    // Fallback: return original blob
    return blob;
  }

  async chunkBlob(blob: Blob): Promise<ChunkedBlob> {
    const chunks: Blob[] = [];
    const chunkCount = Math.ceil(blob.size / this.chunkSize);
    
    for (let i = 0; i < chunkCount; i++) {
      const start = i * this.chunkSize;
      const end = Math.min(start + this.chunkSize, blob.size);
      chunks.push(blob.slice(start, end, blob.type));
    }

    return {
      id: this.generateChunkId(),
      chunks,
      metadata: {
        totalSize: blob.size,
        chunkCount,
        mimeType: blob.type,
        checksum: await this.calculateBlobChecksum(blob)
      }
    };
  }

  async reassembleChunks(chunkedBlob: ChunkedBlob): Promise<Blob> {
    const reassembled = new Blob(chunkedBlob.chunks, {
      type: chunkedBlob.metadata.mimeType
    });

    // Verify integrity
    if (reassembled.size !== chunkedBlob.metadata.totalSize) {
      throw new Error('Reassembled blob size mismatch');
    }

    if (chunkedBlob.metadata.checksum) {
      const checksum = await this.calculateBlobChecksum(reassembled);
      if (checksum !== chunkedBlob.metadata.checksum) {
        throw new Error('Reassembled blob checksum mismatch');
      }
    }

    return reassembled;
  }

  private async calculateBlobChecksum(blob: Blob): Promise<string> {
    try {
      const arrayBuffer = await blob.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (error) {
      console.warn('Failed to calculate checksum:', error);
      // Fallback to simple checksum
      return `${blob.size}-${blob.type}`;
    }
  }

  private generateChunkId(): string {
    return `chunk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async checkStorageQuota(requiredBytes: number): Promise<boolean> {
    const quota = await this.getStorageQuota();
    return quota.available >= requiredBytes;
  }

  private async getStorageQuota(): Promise<{ total: number; available: number }> {
    // Use cached value if still valid
    if (this.quotaCache && Date.now() - this.quotaCacheTimestamp < this.quotaCacheDuration) {
      return this.quotaCache;
    }

    await this.updateQuotaCache();
    return this.quotaCache!;
  }

  private async updateQuotaCache(): Promise<void> {
    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        const total = estimate.quota || 500 * 1024 * 1024; // 500MB fallback
        const used = estimate.usage || 0;
        
        this.quotaCache = {
          total,
          available: total - used
        };
        this.quotaCacheTimestamp = Date.now();
      } else {
        // Fallback for browsers without storage.estimate()
        this.quotaCache = {
          total: 500 * 1024 * 1024,
          available: 500 * 1024 * 1024
        };
        this.quotaCacheTimestamp = Date.now();
      }
    } catch (error) {
      console.error('Failed to get storage quota:', error);
      // Use conservative fallback
      this.quotaCache = {
        total: 100 * 1024 * 1024, // 100MB
        available: 50 * 1024 * 1024  // 50MB
      };
      this.quotaCacheTimestamp = Date.now();
    }
  }

  async cleanupOldBlobs(_olderThanMs: number): Promise<number> {
    // This would be implemented by the parent storage system
    // Returns number of bytes freed
    return 0;
  }

  async optimizeStorage(): Promise<void> {
    // Force quota cache update
    await this.updateQuotaCache();
    
    // Attempt to persist storage if available
    if ('storage' in navigator && 'persist' in navigator.storage) {
      try {
        const isPersisted = await navigator.storage.persist();
        if (isPersisted) {
          // Storage successfully persisted
        }
      } catch (error) {
        console.warn('Failed to persist storage:', error);
      }
    }
  }

  async exportBlob(blob: Blob, filename: string): Promise<void> {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    // Clean up
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }

  async importBlob(file: File): Promise<Blob> {
    // Validate file
    if (!file || file.size === 0) {
      throw new Error('Invalid file');
    }

    if (file.size > this.maxBlobSize) {
      throw new Error(`File too large (${file.size} bytes)`);
    }

    // Process and return as blob
    return await this.processBlob(file);
  }

  getBlobUrl(blob: Blob): string {
    return URL.createObjectURL(blob);
  }

  revokeBlobUrl(url: string): void {
    URL.revokeObjectURL(url);
  }

  async cloneBlob(blob: Blob): Promise<Blob> {
    return new Blob([await blob.arrayBuffer()], { type: blob.type });
  }

  async validateBlob(blob: Blob): Promise<boolean> {
    try {
      // Try to read the blob
      const arrayBuffer = await blob.slice(0, Math.min(1024, blob.size)).arrayBuffer();
      return arrayBuffer.byteLength > 0;
    } catch {
      return false;
    }
  }

  getMemoryUsage(): { heapUsed: number; heapTotal: number } | null {
    if ('memory' in performance) {
      interface PerformanceWithMemory extends Performance {
        memory?: {
          usedJSHeapSize: number;
          totalJSHeapSize: number;
        };
      }
      const memory = (performance as PerformanceWithMemory).memory;
      if (!memory) return null;
      return {
        heapUsed: memory.usedJSHeapSize,
        heapTotal: memory.totalJSHeapSize
      };
    }
    return null;
  }

  async estimateBlobMemoryUsage(blob: Blob): Promise<number> {
    // Estimate memory usage including overhead
    const overhead = 1.2; // 20% overhead estimate
    return Math.ceil(blob.size * overhead);
  }
}

export default BlobManager;