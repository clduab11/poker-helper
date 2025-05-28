/**
 * Generic LRU (Least Recently Used) cache with TTL support.
 * Used for caching recommendations in the DecisionEngine.
 */

type HashFunction<K> = (key: K) => string;

interface LRUCacheOptions<K> {
  maxSize: number;
  ttlMs: number;
  hashFn: HashFunction<K>;
}

interface LRUCacheEntry<V> {
  value: V;
  expiresAt: number;
}

export class LRUCache<K, V> {
  private maxSize: number;
  private ttlMs: number;
  private hashFn: HashFunction<K>;
  private cache: Map<string, LRUCacheEntry<V>>;

  constructor(options: LRUCacheOptions<K>) {
    this.maxSize = options.maxSize;
    this.ttlMs = options.ttlMs;
    this.hashFn = options.hashFn;
    this.cache = new Map();
  }

  /**
   * Get a value from the cache. Returns undefined if not found or expired.
   */
  get(key: K): V | undefined {
    const hashed = this.hashFn(key);
    const entry = this.cache.get(hashed);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(hashed);
      return undefined;
    }
    // Move to end (most recently used)
    this.cache.delete(hashed);
    this.cache.set(hashed, entry);
    return entry.value;
  }

  /**
   * Set a value in the cache.
   */
  set(key: K, value: V): void {
    const hashed = this.hashFn(key);
    if (this.cache.has(hashed)) {
      this.cache.delete(hashed);
    }
    this.cache.set(hashed, {
      value,
      expiresAt: Date.now() + this.ttlMs,
    });
    // Evict least recently used if over size
    if (this.cache.size > this.maxSize) {
      const lruKey = this.cache.keys().next().value;
      if (lruKey !== undefined) {
        this.cache.delete(lruKey);
      }
    }
  }

  /**
   * Delete a value from the cache.
   */
  delete(key: K): void {
    const hashed = this.hashFn(key);
    this.cache.delete(hashed);
  }

  /**
   * Clear the entire cache.
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Utility: Hash function for GameState objects.
   * Serializes and hashes the object for use as a cache key.
   */
  static defaultObjectHash(obj: object): string {
    // Stable JSON stringify (order keys)
    const stableStringify = (o: any): string => {
      if (o === null) return 'null';
      if (typeof o !== 'object') return JSON.stringify(o);
      if (Array.isArray(o)) return `[${o.map(stableStringify).join(',')}]`;
      return `{${Object.keys(o).sort().map(k => `"${k}":${stableStringify(o[k])}`).join(',')}}`;
    };
    // Simple hash (FNV-1a)
    const str = stableStringify(obj);
    let hash = 2166136261;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return hash.toString(16);
  }
}