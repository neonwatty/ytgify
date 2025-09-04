import { gifStore } from '@/storage/gif-store';
import type { GifMetadata, GifData } from '@/types/storage';

export interface BulkOperationResult {
  success: number;
  failed: number;
  errors: Array<{ id: string; error: string }>;
}

export interface UndoOperation {
  id: string;
  type: 'delete' | 'edit' | 'tag' | 'bulk';
  timestamp: Date;
  data: unknown;
  execute: () => Promise<void>;
}

// Export data type with string blobs for JSON export
interface ExportGifData extends Omit<GifData, 'blob' | 'thumbnailBlob'> {
  blob: string;
  thumbnailBlob?: string;
}

export interface ExportOptions {
  includeBlobs?: boolean;
  format?: 'json' | 'zip';
  selectedIds?: string[];
}

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

class BulkOperations {
  private undoStack: UndoOperation[] = [];
  private readonly maxUndoStackSize = 20;

  /**
   * Delete multiple GIFs
   */
  async deleteMultiple(ids: string[]): Promise<BulkOperationResult> {
    const result: BulkOperationResult = {
      success: 0,
      failed: 0,
      errors: []
    };

    // Store deleted GIFs for undo
    const deletedGifs: GifData[] = [];

    for (const id of ids) {
      try {
        // Fetch GIF before deletion for undo
        const gif = await gifStore.getGif(id);
        if (gif) {
          deletedGifs.push(gif);
          await gifStore.deleteGif(id);
          result.success++;
        } else {
          result.failed++;
          result.errors.push({ id, error: 'GIF not found' });
        }
      } catch (error) {
        result.failed++;
        result.errors.push({
          id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Add to undo stack if any were deleted
    if (deletedGifs.length > 0) {
      this.addToUndoStack({
        id: `bulk-delete-${Date.now()}`,
        type: 'bulk',
        timestamp: new Date(),
        data: deletedGifs,
        execute: async () => {
          // Restore deleted GIFs
          for (const gif of deletedGifs) {
            await gifStore.saveGif(gif);
          }
        }
      });
    }

    return result;
  }

  /**
   * Add tags to multiple GIFs
   */
  async addTagsToMultiple(
    ids: string[],
    tags: string[]
  ): Promise<BulkOperationResult> {
    const result: BulkOperationResult = {
      success: 0,
      failed: 0,
      errors: []
    };

    const originalGifs: Array<{ id: string; tags: string[] }> = [];

    for (const id of ids) {
      try {
        const gif = await gifStore.getGif(id);
        if (gif) {
          // Store original tags for undo
          originalGifs.push({ id: gif.id, tags: [...gif.tags] });

          // Add new tags (avoid duplicates)
          const newTags = new Set([...gif.tags, ...tags]);
          gif.tags = Array.from(newTags);

          await gifStore.saveGif(gif);
          result.success++;
        } else {
          result.failed++;
          result.errors.push({ id, error: 'GIF not found' });
        }
      } catch (error) {
        result.failed++;
        result.errors.push({
          id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Add to undo stack
    if (originalGifs.length > 0) {
      this.addToUndoStack({
        id: `bulk-tag-${Date.now()}`,
        type: 'bulk',
        timestamp: new Date(),
        data: { originalGifs, addedTags: tags },
        execute: async () => {
          // Restore original tags
          for (const original of originalGifs) {
            const gif = await gifStore.getGif(original.id);
            if (gif) {
              gif.tags = original.tags;
              await gifStore.saveGif(gif);
            }
          }
        }
      });
    }

    return result;
  }

  /**
   * Remove tags from multiple GIFs
   */
  async removeTagsFromMultiple(
    ids: string[],
    tags: string[]
  ): Promise<BulkOperationResult> {
    const result: BulkOperationResult = {
      success: 0,
      failed: 0,
      errors: []
    };

    const originalGifs: Array<{ id: string; tags: string[] }> = [];

    for (const id of ids) {
      try {
        const gif = await gifStore.getGif(id);
        if (gif) {
          // Store original tags for undo
          originalGifs.push({ id: gif.id, tags: [...gif.tags] });

          // Remove specified tags
          gif.tags = gif.tags.filter(tag => !tags.includes(tag));

          await gifStore.saveGif(gif);
          result.success++;
        } else {
          result.failed++;
          result.errors.push({ id, error: 'GIF not found' });
        }
      } catch (error) {
        result.failed++;
        result.errors.push({
          id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Add to undo stack
    if (originalGifs.length > 0) {
      this.addToUndoStack({
        id: `bulk-untag-${Date.now()}`,
        type: 'bulk',
        timestamp: new Date(),
        data: { originalGifs, removedTags: tags },
        execute: async () => {
          // Restore original tags
          for (const original of originalGifs) {
            const gif = await gifStore.getGif(original.id);
            if (gif) {
              gif.tags = original.tags;
              await gifStore.saveGif(gif);
            }
          }
        }
      });
    }

    return result;
  }

  /**
   * Edit metadata for a single GIF
   */
  async editGifMetadata(
    id: string,
    updates: Partial<{
      title: string;
      description: string;
      tags: string[];
    }>
  ): Promise<void> {
    const gif = await gifStore.getGif(id);
    if (!gif) {
      throw new Error('GIF not found');
    }

    // Store original for undo
    const original = {
      title: gif.title,
      description: gif.description,
      tags: [...gif.tags]
    };

    // Apply updates
    if (updates.title !== undefined) gif.title = updates.title;
    if (updates.description !== undefined) gif.description = updates.description;
    if (updates.tags !== undefined) gif.tags = updates.tags;

    await gifStore.saveGif(gif);

    // Add to undo stack
    this.addToUndoStack({
      id: `edit-${id}-${Date.now()}`,
      type: 'edit',
      timestamp: new Date(),
      data: { id, original },
      execute: async () => {
        const currentGif = await gifStore.getGif(id);
        if (currentGif) {
          currentGif.title = original.title;
          currentGif.description = original.description;
          currentGif.tags = original.tags;
          await gifStore.saveGif(currentGif);
        }
      }
    });
  }

  /**
   * Export GIFs to JSON format
   */
  async exportToJSON(options: ExportOptions = {}): Promise<string> {
    const {
      includeBlobs = false,
      selectedIds = []
    } = options;

    const allMetadata = await gifStore.getAllMetadata();
    let gifsToExport: (GifMetadata | GifData | ExportGifData)[] = [];

    if (selectedIds.length > 0) {
      // Export only selected GIFs
      for (const id of selectedIds) {
        if (includeBlobs) {
          const gif = await gifStore.getGif(id);
          if (gif) {
            // Convert blobs to base64 for JSON export
            const exportData = {
              ...gif,
              blob: await this.blobToBase64(gif.blob),
              thumbnailBlob: gif.thumbnailBlob
                ? await this.blobToBase64(gif.thumbnailBlob)
                : undefined
            };
            gifsToExport.push(exportData as ExportGifData);
          }
        } else {
          const metadata = allMetadata.find(m => m.id === id);
          if (metadata) {
            gifsToExport.push(metadata);
          }
        }
      }
    } else {
      // Export all GIFs
      if (includeBlobs) {
        for (const metadata of allMetadata) {
          const gif = await gifStore.getGif(metadata.id);
          if (gif) {
            const exportData = {
              ...gif,
              blob: await this.blobToBase64(gif.blob),
              thumbnailBlob: gif.thumbnailBlob
                ? await this.blobToBase64(gif.thumbnailBlob)
                : undefined
            };
            gifsToExport.push(exportData as ExportGifData);
          }
        }
      } else {
        gifsToExport = allMetadata;
      }
    }

    const exportData = {
      version: '1.0.0',
      exportDate: new Date().toISOString(),
      gifCount: gifsToExport.length,
      includesBlobs: includeBlobs,
      gifs: gifsToExport
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Import GIFs from JSON
   */
  async importFromJSON(jsonData: string): Promise<ImportResult> {
    const result: ImportResult = {
      imported: 0,
      skipped: 0,
      errors: []
    };

    try {
      const data = JSON.parse(jsonData);
      
      if (!data.gifs || !Array.isArray(data.gifs)) {
        throw new Error('Invalid import data format');
      }

      const existingIds = new Set(
        (await gifStore.getAllMetadata()).map(g => g.id)
      );

      for (const gifData of data.gifs) {
        try {
          // Skip if GIF already exists
          if (existingIds.has(gifData.id)) {
            result.skipped++;
            continue;
          }

          // Convert base64 back to blobs if present
          if (gifData.blob && typeof gifData.blob === 'string') {
            gifData.blob = await this.base64ToBlob(gifData.blob);
          }
          if (gifData.thumbnailBlob && typeof gifData.thumbnailBlob === 'string') {
            gifData.thumbnailBlob = await this.base64ToBlob(gifData.thumbnailBlob);
          }

          // Ensure required fields
          if (!gifData.blob) {
            result.errors.push(`GIF ${gifData.id} missing blob data`);
            continue;
          }

          await gifStore.saveGif(gifData);
          result.imported++;
        } catch (error) {
          result.errors.push(
            `Failed to import GIF ${gifData.id}: ${
              error instanceof Error ? error.message : 'Unknown error'
            }`
          );
        }
      }
    } catch (error) {
      result.errors.push(
        `Failed to parse import data: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }

    return result;
  }

  /**
   * Export GIFs to ZIP file
   */
  async exportToZip(options: ExportOptions = {}): Promise<Blob> {
    // This would require a ZIP library like JSZip
    // For now, return a simple implementation
    const jsonData = await this.exportToJSON({ ...options, includeBlobs: true });
    return new Blob([jsonData], { type: 'application/json' });
  }

  /**
   * Duplicate a GIF
   */
  async duplicateGif(id: string): Promise<string> {
    const original = await gifStore.getGif(id);
    if (!original) {
      throw new Error('GIF not found');
    }

    const duplicate: GifData = {
      ...original,
      id: `${original.id}-copy-${Date.now()}`,
      title: `${original.title} (Copy)`,
      metadata: {
        ...original.metadata,
        createdAt: new Date()
      }
    };

    await gifStore.saveGif(duplicate);

    // Add to undo stack
    this.addToUndoStack({
      id: `duplicate-${duplicate.id}`,
      type: 'bulk',
      timestamp: new Date(),
      data: { duplicateId: duplicate.id },
      execute: async () => {
        await gifStore.deleteGif(duplicate.id);
      }
    });

    return duplicate.id;
  }

  /**
   * Undo last operation
   */
  async undo(): Promise<boolean> {
    const operation = this.undoStack.pop();
    if (!operation) {
      return false;
    }

    try {
      await operation.execute();
      return true;
    } catch (error) {
      console.error('Failed to undo operation:', error);
      return false;
    }
  }

  /**
   * Get undo history
   */
  getUndoHistory(): Array<{
    id: string;
    type: string;
    timestamp: Date;
    description: string;
  }> {
    return this.undoStack.map(op => ({
      id: op.id,
      type: op.type,
      timestamp: op.timestamp,
      description: this.getOperationDescription(op)
    }));
  }

  /**
   * Clear undo history
   */
  clearUndoHistory(): void {
    this.undoStack = [];
  }

  /**
   * Check if undo is available
   */
  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  /**
   * Get statistics about GIF library
   */
  async getLibraryStats(): Promise<{
    totalGifs: number;
    totalSize: number;
    averageSize: number;
    totalDuration: number;
    averageDuration: number;
    uniqueTags: number;
    mostUsedTags: Array<{ tag: string; count: number }>;
  }> {
    const allGifs = await gifStore.getAllMetadata();
    
    const totalSize = allGifs.reduce((sum, gif) => sum + gif.fileSize, 0);
    const totalDuration = allGifs.reduce((sum, gif) => sum + gif.duration, 0);
    
    // Count tag usage
    const tagCount = new Map<string, number>();
    allGifs.forEach(gif => {
      gif.tags.forEach(tag => {
        tagCount.set(tag, (tagCount.get(tag) || 0) + 1);
      });
    });

    // Get most used tags
    const sortedTags = Array.from(tagCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag, count]) => ({ tag, count }));

    return {
      totalGifs: allGifs.length,
      totalSize,
      averageSize: allGifs.length > 0 ? totalSize / allGifs.length : 0,
      totalDuration,
      averageDuration: allGifs.length > 0 ? totalDuration / allGifs.length : 0,
      uniqueTags: tagCount.size,
      mostUsedTags: sortedTags
    };
  }

  // Helper methods

  private addToUndoStack(operation: UndoOperation): void {
    this.undoStack.push(operation);
    
    // Limit stack size
    if (this.undoStack.length > this.maxUndoStackSize) {
      this.undoStack.shift();
    }
  }

  private getOperationDescription(operation: UndoOperation): string {
    switch (operation.type) {
      case 'delete':
        return `Delete GIF`;
      case 'edit':
        return `Edit GIF metadata`;
      case 'tag':
        return `Modify tags`;
      case 'bulk':
        if (operation.id.includes('delete')) {
          return `Bulk delete (${(operation.data as unknown[])?.length || 0} GIFs)`;
        } else if (operation.id.includes('tag')) {
          return `Bulk tag operation`;
        } else if (operation.id.includes('duplicate')) {
          return `Duplicate GIF`;
        }
        return 'Bulk operation';
      default:
        return 'Operation';
    }
  }

  private async blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Failed to convert blob to base64'));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  private async base64ToBlob(base64: string): Promise<Blob> {
    const response = await fetch(base64);
    return response.blob();
  }
}

// Singleton instance
export const bulkOperations = new BulkOperations();