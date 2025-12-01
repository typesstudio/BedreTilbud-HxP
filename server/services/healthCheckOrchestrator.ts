import type { IStorage } from "../storage";
import type { OfferSnapshot, InsertHealthCheck } from "@shared/schema";
import { insuranceCheckService } from "./insuranceCheckService";

interface HealthCheckOptions {
  source: 'current_upload' | 'offer_upload' | 'email_offer' | 'onboarding';
  userId: string;
  forceRerun?: boolean;
}

/**
 * Guess policy type from coverage names (for validation)
 * Returns 'hus' | 'indbo' | 'ulykke' | 'unknown'
 */
function guessPolicyTypeFromCoverages(
  whatsIncluded: Array<{ coverage?: string }>
): 'hus' | 'indbo' | 'ulykke' | 'unknown' {
  const names = (whatsIncluded ?? [])
    .map(c => (c.coverage || '').toLowerCase());

  const has = (s: string) => names.some(n => n.includes(s));

  if (has('invaliditet') || has('dødsfald') || has('tandskade') || has('krisehjælp')) {
    return 'ulykke';
  }
  if (has('indbo') || has('cykel') || has('retshjælp') || has('ansvar')) {
    return 'indbo';
  }
  if (has('bygningsbrand') || has('bygningsbeskadigelse') || has('fritidshus') || has('storm og skybrud') || has('brand')) {
    return 'hus';
  }

  return 'unknown';
}

interface HealthCheckOrchestrationResult {
  success: boolean;
  documentId: string;
  healthChecksCreated: number;
  healthChecksFailed: number;
  skipped: boolean;
  skipReason?: string;
  errors: string[];
}

/**
 * HealthCheckOrchestrator
 * 
 * Document-agnostic service that creates health checks for uploaded insurance documents.
 * Works with OfferSnapshots to analyze insurance quality and potential savings.
 * 
 * Invoked after extraction pipeline completes for:
 * - Current insurance uploads (profile, onboarding)
 * - Offer documents (manual upload, email)
 * 
 * Ensures idempotency by checking if health checks already exist.
 */
export class HealthCheckOrchestrator {
  private storage: IStorage;

  constructor(storage: IStorage) {
    this.storage = storage;
  }

  /**
   * Run health checks for all OfferSnapshots in a document
   * 
   * @param documentId - Document ID to process
   * @param options - Source type, userId, and whether to force rerun
   * @returns Result object with success status and statistics
   */
  async runForDocument(
    documentId: string,
    options: HealthCheckOptions
  ): Promise<HealthCheckOrchestrationResult> {
    const { source, userId, forceRerun = false } = options;
    
    console.log(`[HealthCheckOrchestrator] Starting health checks for document ${documentId}`, {
      source,
      userId,
      forceRerun
    });

    try {
      // 1. Load document metadata
      const document = await this.storage.getDocument(documentId);
      if (!document) {
        throw new Error(`Document ${documentId} not found`);
      }

      // Step 1.3: Skip health check for unknown documents
      if (document.documentKind === 'unknown') {
        console.log(`[HealthCheckOrchestrator] Document ${documentId} is classified as UNKNOWN - skipping health check`);
        return {
          success: true,
          documentId,
          healthChecksCreated: 0,
          healthChecksFailed: 0,
          skipped: true,
          skipReason: 'Document classified as unknown (not an insurance policy)',
          errors: []
        };
      }
      
      // Step 1.4: Skip health check for failed documents (defective/password-protected/too-large PDFs)
      if (document.extractionStatus === 'failed') {
        console.log(`[HealthCheckOrchestrator] Document ${documentId} has FAILED extraction - skipping health check`, {
          errorReason: (document as any).errorReason
        });
        return {
          success: true,
          documentId,
          healthChecksCreated: 0,
          healthChecksFailed: 0,
          skipped: true,
          skipReason: `Document extraction failed: ${(document as any).errorReason || 'unknown error'}`,
          errors: []
        };
      }

      // 2. Check if already processed (idempotency)
      if (!forceRerun) {
        const existingHealthChecks = await this.storage.getHealthChecksByDocument(documentId);
        if (existingHealthChecks.length > 0) {
          console.log(`[HealthCheckOrchestrator] Document already has ${existingHealthChecks.length} health checks, skipping`);
          return {
            success: true,
            documentId,
            healthChecksCreated: 0,
            healthChecksFailed: 0,
            skipped: true,
            skipReason: `Already processed (${existingHealthChecks.length} health checks exist)`,
            errors: []
          };
        }
      }

      // 3. Load OfferSnapshots from document
      const snapshots = await this.storage.getOfferSnapshotsByDocument(documentId);
      
      if (snapshots.length === 0) {
        console.log(`[HealthCheckOrchestrator] No snapshots found for document ${documentId}`);
        return {
          success: true,
          documentId,
          healthChecksCreated: 0,
          healthChecksFailed: 0,
          skipped: true,
          skipReason: 'No snapshots found in document',
          errors: []
        };
      }

      console.log(`[HealthCheckOrchestrator] Found ${snapshots.length} snapshots, running health checks...`);

      // 4. Run health checks for each snapshot in parallel
      const results = await Promise.allSettled(
        snapshots.map(snapshot => this.createHealthCheckForSnapshot(
          snapshot,
          documentId,
          userId,
          source
        ))
      );

      // 5. Aggregate results
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      const errors = results
        .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
        .map(r => r.reason instanceof Error ? r.reason.message : String(r.reason));

      console.log(`[HealthCheckOrchestrator] Health checks completed for document ${documentId}`, {
        total: snapshots.length,
        successful,
        failed
      });

      return {
        success: failed === 0,
        documentId,
        healthChecksCreated: successful,
        healthChecksFailed: failed,
        skipped: false,
        errors
      };

    } catch (error) {
      console.error(`[HealthCheckOrchestrator] Failed to run health checks for document ${documentId}:`, error);
      return {
        success: false,
        documentId,
        healthChecksCreated: 0,
        healthChecksFailed: 0,
        skipped: false,
        errors: [error instanceof Error ? error.message : String(error)]
      };
    }
  }

  /**
   * Create a health check for a single OfferSnapshot
   * 
   * @param snapshot - OfferSnapshot to analyze
   * @param documentId - Document ID
   * @param userId - User ID
   * @param source - Source type for tracking
   */
  private async createHealthCheckForSnapshot(
    snapshot: OfferSnapshot,
    documentId: string,
    userId: string,
    source: string
  ): Promise<void> {
    try {
      console.log(`[HealthCheckOrchestrator] Analyzing snapshot ${snapshot.id} (${snapshot.policyType})`);

      // Run AI-powered health check analysis
      // insuranceCheckService.analyzeInsuranceHealth accepts both Policy and OfferSnapshot
      const healthCheckResult = await insuranceCheckService.analyzeInsuranceHealth(snapshot);

      // SOFT VALIDATION: Check if AI-extracted coverages match snapshot's policy_type
      // This is purely diagnostic - we NEVER block health check creation
      const guessedType = guessPolicyTypeFromCoverages(healthCheckResult.whatsIncluded ?? []);

      // Embed debug info in result if there's a mismatch
      if (guessedType !== 'unknown' && guessedType !== snapshot.policyType) {
        console.warn(
          `[HealthCheckValidator] Policy type mismatch for snapshot=${snapshot.id}: ` +
          `db=${snapshot.policyType}, detected=${guessedType}, ` +
          `firstCoverages=${(healthCheckResult.whatsIncluded ?? []).slice(0, 3).map(c => c.coverage).join(', ')}`
        );
        
        // Add debug metadata to health check result (for monitoring/debugging)
        healthCheckResult._debug = {
          ...(healthCheckResult._debug || {}),
          detectedPolicyType: guessedType,
          dbPolicyType: snapshot.policyType,
          typeMismatch: true,
        };
      }

      // Log validation status for monitoring
      if (guessedType === snapshot.policyType) {
        console.log(`[HealthCheckValidator] ✓ Policy type match: ${guessedType}`);
      } else if (guessedType === 'unknown') {
        console.log(`[HealthCheckValidator] ⚠️  Could not determine type from coverages (using snapshot.policyType=${snapshot.policyType})`);
      }
      // Mismatch case is already logged as warning above

      // Prepare health check record for database
      const healthCheckData: InsertHealthCheck = {
        documentId,
        userId,
        snapshotId: snapshot.id, // Phase 2: FK to offer_snapshots for ID-based matching
        policyType: snapshot.policyType, // CRITICAL: Copy from snapshot for data integrity
        dataSource: 'OfferSnapshot', // Indicates this came from extraction pipeline
        confidenceScore: snapshot.confidenceScore, // Use extraction confidence score
        result: healthCheckResult // Full AI analysis result
      };

      // Persist to database (health_checks table)
      const savedHealthCheck = await this.storage.createHealthCheck(healthCheckData);

      console.log(`[HealthCheckOrchestrator] ✅ Health check created`, {
        healthCheckId: savedHealthCheck.id,
        snapshotId: snapshot.id,
        policyType: snapshot.policyType,
        validationType: guessedType === snapshot.policyType ? 'MATCH' : 'UNKNOWN',
        potentialSavings: healthCheckResult.potentialSavings?.realistic || 0
      });

      // ALSO update policies table for backward compatibility with InsuranceCheckPage
      // The /forsikringstjek page reads healthCheckStatus/healthCheckPayload from policies table
      try {
        const policiesFromDocument = await this.storage.getPoliciesByDocument(documentId);
        
        // Match snapshot to policy by policyType and isOwnPolicy flag
        const isCurrentDoc = source === 'current_upload';
        const matchingPolicies = policiesFromDocument.filter(p => 
          p.policyType === snapshot.policyType && 
          p.isOwnPolicy === isCurrentDoc
        );

        for (const policy of matchingPolicies) {
          await this.storage.updatePolicyHealthCheck(policy.id, {
            status: "completed",
            payload: healthCheckResult,
            savingsAnnual: healthCheckResult.potentialSavings?.realistic || 0
          });
          
          console.log(`[HealthCheckOrchestrator] Updated policy ${policy.id} with health check data (savings: ${healthCheckResult.potentialSavings?.realistic || 0}kr)`);
        }
        
        if (matchingPolicies.length === 0) {
          console.warn(`[HealthCheckOrchestrator] No matching policy found for snapshot ${snapshot.id} (type: ${snapshot.policyType}, isOwn: ${isCurrentDoc})`);
        }
      } catch (policyUpdateError) {
        // Don't fail the entire operation if policy update fails
        console.warn(`[HealthCheckOrchestrator] Failed to update policies table:`, policyUpdateError);
      }

    } catch (error) {
      console.error(`[HealthCheckOrchestrator] ❌ Failed to create health check for snapshot ${snapshot.id}:`, error);
      throw error; // Re-throw to be caught by Promise.allSettled
    }
  }

  /**
   * Delete existing health checks for a document (useful for reprocessing)
   * 
   * @param documentId - Document ID
   */
  async deleteHealthChecksForDocument(documentId: string): Promise<number> {
    try {
      const existingHealthChecks = await this.storage.getHealthChecksByDocument(documentId);
      
      if (existingHealthChecks.length === 0) {
        console.log(`[HealthCheckOrchestrator] No health checks to delete for document ${documentId}`);
        return 0;
      }

      console.log(`[HealthCheckOrchestrator] Deleting ${existingHealthChecks.length} existing health checks for document ${documentId}`);
      
      // Delete each health check
      for (const healthCheck of existingHealthChecks) {
        await this.storage.deleteHealthCheck(healthCheck.id);
      }

      console.log(`[HealthCheckOrchestrator] ✅ Deleted ${existingHealthChecks.length} health checks`);
      return existingHealthChecks.length;

    } catch (error) {
      console.error(`[HealthCheckOrchestrator] Failed to delete health checks for document ${documentId}:`, error);
      throw error;
    }
  }
}
