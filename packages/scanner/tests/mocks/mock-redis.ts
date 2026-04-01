/**
 * Mock Redis service for cache testing
 * Implements ioredis-like interface for in-memory testing
 */

export class MockRedis {
  private data: Map<string, { value: string; expiry?: number }>;
  private timers: Map<string, NodeJS.Timeout>;

  constructor() {
    this.data = new Map();
    this.timers = new Map();
  }

  /**
   * Get value from Redis
   * @param key - Redis key
   * @returns Value or null if not found
   */
  async get(key: string): Promise<string | null> {
    const entry = this.data.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (entry.expiry && Date.now() > entry.expiry) {
      this.data.delete(key);
      return null;
    }

    return entry.value;
  }

  /**
   * Set value in Redis
   * @param key - Redis key
   * @param value - Value to store
   * @returns OK on success
   */
  async set(key: string, value: string): Promise<'OK'> {
    // Clear existing expiry timer
    const existingTimer = this.timers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
      this.timers.delete(key);
    }

    this.data.set(key, { value });
    return 'OK';
  }

  /**
   * Set value with expiration in seconds
   * @param key - Redis key
   * @param seconds - Time to live in seconds
   * @param value - Value to store
   * @returns OK on success
   */
  async setex(key: string, seconds: number, value: string): Promise<'OK'> {
    // Clear existing expiry timer
    const existingTimer = this.timers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const expiry = Date.now() + seconds * 1000;
    this.data.set(key, { value, expiry });

    // Set up auto-cleanup timer
    const timer = setTimeout(() => {
      this.data.delete(key);
      this.timers.delete(key);
    }, seconds * 1000);
    this.timers.set(key, timer);

    return 'OK';
  }

  /**
   * Delete key from Redis
   * @param keys - One or more keys to delete
   * @returns Number of keys deleted
   */
  async del(...keys: string[]): Promise<number> {
    let deleted = 0;
    for (const key of keys) {
      if (this.data.has(key)) {
        this.data.delete(key);
        deleted++;

        // Clear expiry timer if exists
        const timer = this.timers.get(key);
        if (timer) {
          clearTimeout(timer);
          this.timers.delete(key);
        }
      }
    }
    return deleted;
  }

  /**
   * Check if key exists
   * @param key - Redis key
   * @returns 1 if exists, 0 if not
   */
  async exists(key: string): Promise<number> {
    const entry = this.data.get(key);

    if (!entry) {
      return 0;
    }

    // Check if expired
    if (entry.expiry && Date.now() > entry.expiry) {
      this.data.delete(key);
      return 0;
    }

    return 1;
  }

  /**
   * Increment value by 1
   * @param key - Redis key
   * @returns New value
   */
  async incr(key: string): Promise<number> {
    const currentValue = await this.get(key);
    const numValue = currentValue ? parseInt(currentValue, 10) : 0;
    const newValue = numValue + 1;
    await this.set(key, newValue.toString());
    return newValue;
  }

  /**
   * Decrement value by 1
   * @param key - Redis key
   * @returns New value
   */
  async decr(key: string): Promise<number> {
    const currentValue = await this.get(key);
    const numValue = currentValue ? parseInt(currentValue, 10) : 0;
    const newValue = numValue - 1;
    await this.set(key, newValue.toString());
    return newValue;
  }

  /**
   * Get multiple keys
   * @param keys - Array of keys
   * @returns Array of values
   */
  async mget(...keys: string[]): Promise<(string | null)[]> {
    return Promise.all(keys.map((key) => this.get(key)));
  }

  /**
   * Set multiple key-value pairs
   * @param keyValuePairs - Array of [key, value] pairs
   * @returns OK on success
   */
  async mset(...keyValuePairs: string[]): Promise<'OK'> {
    for (let i = 0; i < keyValuePairs.length; i += 2) {
      await this.set(keyValuePairs[i], keyValuePairs[i + 1]);
    }
    return 'OK';
  }

  /**
   * Clear all data from Redis
   * @returns OK on success
   */
  async flushdb(): Promise<'OK'> {
    // Clear all expiry timers
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();

    // Clear all data
    this.data.clear();
    return 'OK';
  }

  /**
   * Get all keys matching pattern
   * @param pattern - Glob pattern (only * supported)
   * @returns Array of matching keys
   */
  async keys(pattern: string): Promise<string[]> {
    if (pattern === '*') {
      return Array.from(this.data.keys());
    }

    // Simple pattern matching (convert glob to regex)
    const regexPattern = pattern
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    const regex = new RegExp(`^${regexPattern}$`);

    return Array.from(this.data.keys()).filter((key) => regex.test(key));
  }

  /**
   * Get time to live for key
   * @param key - Redis key
   * @returns TTL in seconds, -2 if not found, -1 if no expiry
   */
  async ttl(key: string): Promise<number> {
    const entry = this.data.get(key);

    if (!entry) {
      return -2;
    }

    if (!entry.expiry) {
      return -1;
    }

    const remaining = Math.ceil((entry.expiry - Date.now()) / 1000);
    return remaining > 0 ? remaining : -2;
  }

  /**
   * Reset mock state (for test isolation)
   */
  reset(): void {
    this.flushdb();
  }
}

// Export as default for convenience
export default MockRedis;
