import { stat } from 'fs/promises';

/**
 * StatCache - LRU cache for file modification times
 * 
 * Used by FreshnessAnnotator to avoid repeated stat() calls.
 * Short TTL (5s) ensures freshness while reducing I/O overhead.
 */
class StatCache {
  constructor({ ttlMs = 5000, maxEntries = 1000 } = {}) {
    this.ttlMs = ttlMs;
    this.maxEntries = maxEntries;
    this.cache = new Map();
  }

  /**
   * Get file modification time in milliseconds
   * @param {string} absPath - Absolute file path
   * @returns {Promise<number|null>} - mtime in ms, or null if file doesn't exist
   */
  async mtime(absPath) {
    // Check cache first
    const cached = this.cache.get(absPath);
    if (cached && Date.now() - cached.timestamp < this.ttlMs) {
      return cached.mtime;
    }

    // Stat the file
    try {
      const stats = await stat(absPath);
      const mtimeMs = stats.mtimeMs;
      
      // Update cache
      this._set(absPath, mtimeMs);
      return mtimeMs;
    } catch (err) {
      // File doesn't exist or can't be accessed
      this._set(absPath, null);
      return null;
    }
  }

  /**
   * Get full stat result (not just mtime)
   * @param {string} absPath - Absolute file path
   * @returns {Promise<Object|null>} - stat result or null
   */
  async getStat(absPath) {
    try {
      return await stat(absPath);
    } catch {
      return null;
    }
  }

  /**
   * Invalidate cache entry for a file
   * @param {string} absPath - Absolute file path
   */
  invalidate(absPath) {
    this.cache.delete(absPath);
  }

  /**
   * Clear all cached entries
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Get cache stats
   */
  getStats() {
    return {
      size: this.cache.size,
      maxEntries: this.maxEntries,
      ttlMs: this.ttlMs
    };
  }

  /**
   * Internal: set cache entry with LRU eviction
   */
  _set(absPath, mtime) {
    // Evict oldest if at capacity
    if (this.cache.size >= this.maxEntries) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    // Set new entry (Map maintains insertion order)
    this.cache.set(absPath, {
      mtime,
      timestamp: Date.now()
    });
  }
}

export default StatCache;
