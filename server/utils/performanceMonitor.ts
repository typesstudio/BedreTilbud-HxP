import { logger } from "./logging";

interface PerformanceMetrics {
  apiRequests: Map<string, { count: number; totalDuration: number; maxDuration: number; minDuration: number }>;
  cacheHits: number;
  cacheMisses: number;
  databaseQueries: Map<string, { count: number; totalDuration: number }>;
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics = {
    apiRequests: new Map(),
    cacheHits: 0,
    cacheMisses: 0,
    databaseQueries: new Map(),
  };

  private startTime: number = Date.now();

  trackApiRequest(path: string, duration: number): void {
    const existing = this.metrics.apiRequests.get(path);
    
    if (existing) {
      existing.count++;
      existing.totalDuration += duration;
      existing.maxDuration = Math.max(existing.maxDuration, duration);
      existing.minDuration = Math.min(existing.minDuration, duration);
    } else {
      this.metrics.apiRequests.set(path, {
        count: 1,
        totalDuration: duration,
        maxDuration: duration,
        minDuration: duration,
      });
    }

    if (duration > 1000) {
      logger.warn('Slow API request detected', { path, duration });
    }
  }

  trackCacheHit(): void {
    this.metrics.cacheHits++;
  }

  trackCacheMiss(): void {
    this.metrics.cacheMisses++;
  }

  trackDatabaseQuery(operation: string, duration: number): void {
    const existing = this.metrics.databaseQueries.get(operation);
    
    if (existing) {
      existing.count++;
      existing.totalDuration += duration;
    } else {
      this.metrics.databaseQueries.set(operation, {
        count: 1,
        totalDuration: duration,
      });
    }

    if (duration > 500) {
      logger.warn('Slow database query detected', { operation, duration });
    }
  }

  getMetrics() {
    const uptime = Date.now() - this.startTime;
    const cacheTotal = this.metrics.cacheHits + this.metrics.cacheMisses;
    const cacheHitRate = cacheTotal > 0 ? (this.metrics.cacheHits / cacheTotal) * 100 : 0;

    const apiSummary = Array.from(this.metrics.apiRequests.entries()).map(([path, stats]) => ({
      path,
      count: stats.count,
      avgDuration: Math.round(stats.totalDuration / stats.count),
      maxDuration: stats.maxDuration,
      minDuration: stats.minDuration,
    }));

    const dbSummary = Array.from(this.metrics.databaseQueries.entries()).map(([operation, stats]) => ({
      operation,
      count: stats.count,
      avgDuration: Math.round(stats.totalDuration / stats.count),
    }));

    return {
      uptime: Math.round(uptime / 1000),
      cache: {
        hits: this.metrics.cacheHits,
        misses: this.metrics.cacheMisses,
        hitRate: Math.round(cacheHitRate * 100) / 100,
      },
      api: apiSummary.sort((a, b) => b.avgDuration - a.avgDuration),
      database: dbSummary.sort((a, b) => b.avgDuration - a.avgDuration),
    };
  }

  logMetricsSummary(): void {
    const metrics = this.getMetrics();
    logger.info('Performance metrics summary', metrics);
  }

  reset(): void {
    this.metrics = {
      apiRequests: new Map(),
      cacheHits: 0,
      cacheMisses: 0,
      databaseQueries: new Map(),
    };
    this.startTime = Date.now();
  }
}

export const performanceMonitor = new PerformanceMonitor();

setInterval(() => {
  performanceMonitor.logMetricsSummary();
}, 5 * 60 * 1000);
