interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class SimpleCache {
  private cache = new Map<string, CacheEntry<any>>();
  private performanceMonitor: any = null;

  constructor() {
    import("./performanceMonitor").then(({ performanceMonitor }) => {
      this.performanceMonitor = performanceMonitor;
    }).catch(() => {});
  }

  private trackHit(): void {
    try {
      if (this.performanceMonitor) {
        this.performanceMonitor.trackCacheHit();
      }
    } catch (e) {}
  }

  private trackMiss(): void {
    try {
      if (this.performanceMonitor) {
        this.performanceMonitor.trackCacheMiss();
      }
    } catch (e) {}
  }

  set<T>(key: string, data: T, ttlSeconds: number): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + (ttlSeconds * 1000),
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.trackMiss();
      return null;
    }
    
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.trackMiss();
      return null;
    }
    
    this.trackHit();
    return entry.data as T;
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }

  invalidatePattern(pattern: string): void {
    const regex = new RegExp(pattern);
    const keys = Array.from(this.cache.keys());
    for (const key of keys) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

export const apiCache = new SimpleCache();

export async function withCache<T>(
  key: string,
  ttlSeconds: number,
  fn: () => Promise<T>
): Promise<T> {
  const cached = apiCache.get<T>(key);
  
  if (cached !== null) {
    return cached;
  }
  
  const result = await fn();
  apiCache.set(key, result, ttlSeconds);
  
  return result;
}
