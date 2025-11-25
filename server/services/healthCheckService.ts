import type { IStorage } from "../storage";
import type { HealthCheck } from "@shared/schema";
import { insuranceCheckService } from "./insuranceCheckService";
import type { InsertHealthCheck } from "@shared/schema";
import { logger } from "../utils/logging";

/**
 * Health Check Service
 * 
 * Provides reusable functions for ensuring health checks exist for snapshots.
 * This service is used by:
 * - API endpoints (on-demand generation)
 * - Backfill scripts (mass generation)
 * - Orchestrators (automatic generation during pipeline)
 */

/**
 * Ensures a health check exists for a given snapshot ID.
 * If one already exists, returns it. Otherwise, generates and persists a new one.
 * 
 * This function is idempotent - safe to call multiple times.
 * 
 * @param snapshotId - The policy snapshot ID to ensure has a health check
 * @param userId - The user ID for auth and ownership
 * @param storage - Storage interface for DB operations
 * @returns The existing or newly created health check
 * @throws Error if snapshot not found or generation fails
 */
export async function ensureHealthCheckForSnapshot(
  snapshotId: string,
  userId: string,
  storage: IStorage
): Promise<HealthCheck> {
  logger.info('[HealthCheckService] Ensuring health check exists', { snapshotId, userId });

  // 1) Check if health check already exists (idempotency)
  const existingHealthCheck = await storage.getHealthCheckBySnapshot(snapshotId);
  if (existingHealthCheck) {
    logger.info('[HealthCheckService] Health check already exists, returning existing', { snapshotId });
    return existingHealthCheck;
  }

  logger.info('[HealthCheckService] No existing health check found, generating new one', { snapshotId });

  // 2) Load the snapshot we're generating for
  // Use PolicySnapshotService to handle both offer_snapshots and policy_snapshots
  const { PolicySnapshotService } = await import("./policySnapshots/PolicySnapshotService");
  const snapshotService = new PolicySnapshotService();
  const snapshot = await snapshotService.getSnapshotById(snapshotId);

  if (!snapshot) {
    throw new Error(`Snapshot not found for id ${snapshotId}`);
  }

  // 3) Verify ownership - snapshot must belong to the requesting user
  const document = await storage.getDocument(snapshot.documentId);
  if (!document || document.userId !== userId) {
    throw new Error(`Unauthorized: Snapshot ${snapshotId} does not belong to user ${userId}`);
  }

  logger.info('[HealthCheckService] Loaded snapshot, starting AI analysis', {
    snapshotId,
    policyType: snapshot.policyType,
    companyName: snapshot.companyName,
    kind: snapshot.kind
  });

  // 4) Generate health check using existing AI service
  // This reuses the same logic as during upload (gpt-4o analysis)
  // The insuranceCheckService accepts both Policy and OfferSnapshot (and PolicySnapshot)
  // We cast to any because PolicySnapshot is compatible but has different optional fields
  const healthCheckResult = await insuranceCheckService.analyzeInsuranceHealth(snapshot as any);

  logger.info('[HealthCheckService] AI analysis complete', {
    snapshotId,
    overallScore: healthCheckResult.overallScore,
    savingsAmount: healthCheckResult.potentialSavings?.realistic || 0
  });

  // 5) Prepare health check record for database
  const healthCheckData: InsertHealthCheck = {
    documentId: snapshot.documentId,
    userId,
    snapshotId: snapshot.id,
    policyType: snapshot.policyType,
    dataSource: 'PolicySnapshot', // Indicates on-demand generation from policy_snapshots
    confidenceScore: (snapshot as any).confidenceScore || 0,
    result: healthCheckResult
  };

  // 6) Persist to database
  const createdHealthCheck = await storage.createHealthCheck(healthCheckData);

  logger.info('[HealthCheckService] ✅ Health check created successfully', {
    healthCheckId: createdHealthCheck.id,
    snapshotId,
    policyType: snapshot.policyType
  });

  return createdHealthCheck;
}

/**
 * Batch version: ensures health checks exist for multiple snapshots
 * Runs in parallel for efficiency.
 * 
 * @param snapshotIds - Array of snapshot IDs to process
 * @param userId - The user ID for auth and ownership
 * @param storage - Storage interface for DB operations
 * @returns Array of results with success/failure status
 */
export async function ensureHealthChecksForSnapshots(
  snapshotIds: string[],
  userId: string,
  storage: IStorage
): Promise<Array<{ snapshotId: string; success: boolean; error?: string }>> {
  logger.info('[HealthCheckService] Batch ensuring health checks', {
    count: snapshotIds.length,
    userId
  });

  const results = await Promise.allSettled(
    snapshotIds.map((snapshotId) =>
      ensureHealthCheckForSnapshot(snapshotId, userId, storage)
    )
  );

  return results.map((result, index) => {
    const snapshotId = snapshotIds[index];
    if (result.status === 'fulfilled') {
      return { snapshotId, success: true };
    } else {
      logger.error('[HealthCheckService] Failed to ensure health check', {
        snapshotId,
        error: result.reason
      });
      return {
        snapshotId,
        success: false,
        error: result.reason?.message || 'Unknown error'
      };
    }
  });
}
