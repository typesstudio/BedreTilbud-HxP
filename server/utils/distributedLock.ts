import { db } from "../db";
import { sql } from "drizzle-orm";

/**
 * Distributed lock implementation using PostgreSQL advisory locks
 * Prevents duplicate email polling across multiple server instances
 */

export class DistributedLock {
  private lockKey: number;
  private lockAcquired: boolean = false;

  constructor(lockName: string) {
    // Convert lock name to a consistent integer key for PostgreSQL advisory locks
    this.lockKey = this.hashStringToInt(lockName);
  }

  /**
   * Simple hash function to convert string to integer
   */
  private hashStringToInt(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Try to acquire the lock (non-blocking)
   * @returns true if lock acquired, false if already held by another process
   */
  async tryAcquire(): Promise<boolean> {
    try {
      const result = await db.execute(
        sql.raw(`SELECT pg_try_advisory_lock(${this.lockKey}) as acquired`)
      );

      this.lockAcquired = result.rows[0]?.acquired === true;
      return this.lockAcquired;
    } catch (error) {
      console.error('[DistributedLock] Error acquiring lock:', error);
      return false;
    }
  }

  /**
   * Release the lock
   */
  async release(): Promise<void> {
    if (!this.lockAcquired) {
      return;
    }

    try {
      await db.execute(
        sql.raw(`SELECT pg_advisory_unlock(${this.lockKey})`)
      );
      this.lockAcquired = false;
    } catch (error) {
      console.error('[DistributedLock] Error releasing lock:', error);
    }
  }

  /**
   * Execute a function with the lock held
   * Automatically releases lock after execution (even if error)
   * 
   * @param fn - Function to execute while holding the lock
   * @returns Result of the function, or null if lock couldn't be acquired
   */
  async executeWithLock<T>(fn: () => Promise<T>): Promise<T | null> {
    const acquired = await this.tryAcquire();
    
    if (!acquired) {
      console.log(`[DistributedLock] Could not acquire lock (key: ${this.lockKey})`);
      return null;
    }

    try {
      console.log(`[DistributedLock] Lock acquired (key: ${this.lockKey})`);
      return await fn();
    } finally {
      await this.release();
      console.log(`[DistributedLock] Lock released (key: ${this.lockKey})`);
    }
  }
}

/**
 * Create a distributed lock for email polling
 */
export function createEmailPollingLock(): DistributedLock {
  return new DistributedLock('email-polling');
}
