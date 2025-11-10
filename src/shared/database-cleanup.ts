import { logger } from '@/lib/logger';

/**
 * Utility to safely delete the YouTubeGifStore IndexedDB database
 * Used during extension update to clean up stored GIF data
 */
export const databaseCleanup = {
  /**
   * Delete YouTubeGifStore database completely
   * Returns true if successful, false if database doesn't exist or error occurs
   */
  async deleteDatabase(): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        // Check if indexedDB is available
        if (typeof indexedDB === 'undefined') {
          logger.info('[DatabaseCleanup] IndexedDB not available, skipping cleanup');
          resolve(true);
          return;
        }

        const deleteRequest = indexedDB.deleteDatabase('YouTubeGifStore');

        deleteRequest.onsuccess = () => {
          logger.info('[DatabaseCleanup] YouTubeGifStore database deleted successfully');
          resolve(true);
        };

        deleteRequest.onerror = () => {
          logger.warn('[DatabaseCleanup] Failed to delete database', {
            error: deleteRequest.error?.message,
          });
          resolve(false);
        };

        deleteRequest.onblocked = () => {
          logger.warn('[DatabaseCleanup] Database deletion blocked - connections still open');
          // Note: Block event doesn't prevent deletion, just warns us
          // We'll resolve true as deletion is still in progress
          resolve(true);
        };
      } catch (error) {
        logger.error('[DatabaseCleanup] Exception during database deletion', {
          error: error instanceof Error ? error.message : String(error),
        });
        resolve(false);
      }
    });
  },

  /**
   * Check if YouTubeGifStore database exists
   */
  async databaseExists(): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        if (typeof indexedDB === 'undefined') {
          resolve(false);
          return;
        }

        const request = indexedDB.open('YouTubeGifStore');

        request.onsuccess = () => {
          const db = request.result;
          const dbExists = db.objectStoreNames.contains('gifs');
          db.close();
          resolve(dbExists);
        };

        request.onerror = () => {
          resolve(false);
        };
      } catch (error) {
        resolve(false);
      }
    });
  },
};
