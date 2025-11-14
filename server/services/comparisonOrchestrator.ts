import type { IStorage } from "../storage";
import type { InsertCompanyComparison, CompanyComparison } from "@shared/schema";
import { computeBestMatches } from "./deterministicMatcher";
import { comparisonAgentService } from "./comparisonAgentService";

interface ComparisonOptions {
  userId: string;
  forceRerun?: boolean;
  currentCompany?: string;
  offerCompany?: string;
}

interface ComparisonOrchestrationResult {
  success: boolean;
  userId: string;
  comparisonsCreated: number;
  comparisonsFailed: number;
  skipped: boolean;
  skipReason?: string;
  errors: string[];
  comparisonIds: string[];
}

/**
 * ComparisonOrchestrator (Phase 3→4)
 * 
 * Orchestrates the comparison pipeline for a user:
 * 1. Loads current policies (with health checks)
 * 2. Loads offer policies (with health checks)
 * 3. Runs Phase 3: Deterministic matching (pair current ↔ offer)
 * 4. Runs Phase 4: ComparisonAgent (generates comparison JSON)
 * 5. Stores results in company_comparisons table
 * 
 * Invoked after health checks complete for both current and offer documents.
 * Ensures idempotency by checking if comparison already exists.
 */
export class ComparisonOrchestrator {
  private storage: IStorage;
  private enableComparison: boolean;

  constructor(storage: IStorage) {
    this.storage = storage;
    this.enableComparison = process.env.ENABLE_COMPARISON !== 'false';
    console.log(`[ComparisonOrchestrator] Feature enabled: ${this.enableComparison}`);
  }

  /**
   * Run comparison for a specific user
   * 
   * Groups policies by company pair (currentCompany, offerCompany) and runs
   * one comparison per company pair.
   * 
   * @param options - userId, optional company filters, forceRerun flag
   * @returns Result object with success status and statistics
   */
  async runForUser(options: ComparisonOptions): Promise<ComparisonOrchestrationResult> {
    const { userId, forceRerun = false, currentCompany, offerCompany } = options;

    if (!this.enableComparison) {
      console.log(`[ComparisonOrchestrator] Feature disabled, skipping for user ${userId}`);
      return {
        success: true,
        userId,
        comparisonsCreated: 0,
        comparisonsFailed: 0,
        skipped: true,
        skipReason: 'Feature disabled (ENABLE_COMPARISON=false)',
        errors: [],
        comparisonIds: []
      };
    }

    console.log(`[ComparisonOrchestrator] Starting comparison for user ${userId}`, {
      currentCompany,
      offerCompany,
      forceRerun
    });

    try {
      // 1. Load current policies with health checks
      const currentPoliciesData = await this.loadCurrentPolicies(userId);
      
      if (currentPoliciesData.length === 0) {
        console.log(`[ComparisonOrchestrator] No current policies found for user ${userId}`);
        return {
          success: true,
          userId,
          comparisonsCreated: 0,
          comparisonsFailed: 0,
          skipped: true,
          skipReason: 'No current policies found',
          errors: [],
          comparisonIds: []
        };
      }

      // 2. Load offer policies with health checks
      const offerPoliciesData = await this.loadOfferPolicies(userId);
      
      if (offerPoliciesData.length === 0) {
        console.log(`[ComparisonOrchestrator] No offer policies found for user ${userId}`);
        return {
          success: true,
          userId,
          comparisonsCreated: 0,
          comparisonsFailed: 0,
          skipped: true,
          skipReason: 'No offer policies found',
          errors: [],
          comparisonIds: []
        };
      }

      console.log(`[ComparisonOrchestrator] Loaded ${currentPoliciesData.length} current policies, ${offerPoliciesData.length} offer policies`);

      // 3. Group policies by company pair
      const companyPairs = this.groupByCompanyPair(currentPoliciesData, offerPoliciesData);
      
      console.log(`[ComparisonOrchestrator] Found ${companyPairs.length} company pairs to compare`);

      // 4. Run comparison for each company pair
      const results = await Promise.allSettled(
        companyPairs.map(pair => this.runComparisonForCompanyPair(
          userId,
          pair.currentCompany,
          pair.offerCompany,
          pair.currentPolicies,
          pair.offerPolicies,
          forceRerun
        ))
      );

      // 5. Aggregate results
      const successful = results.filter(r => r.status === 'fulfilled');
      const failed = results.filter(r => r.status === 'rejected');
      const errors = failed
        .map(r => r.status === 'rejected' ? (r.reason instanceof Error ? r.reason.message : String(r.reason)) : null)
        .filter((e): e is string => e !== null);
      
      const comparisonIds = successful
        .map(r => r.status === 'fulfilled' ? r.value : null)
        .filter((id): id is string => id !== null);

      console.log(`[ComparisonOrchestrator] Comparisons completed for user ${userId}`, {
        total: companyPairs.length,
        successful: successful.length,
        failed: failed.length
      });

      return {
        success: failed.length === 0,
        userId,
        comparisonsCreated: successful.length,
        comparisonsFailed: failed.length,
        skipped: false,
        errors,
        comparisonIds
      };

    } catch (error) {
      console.error(`[ComparisonOrchestrator] Fatal error for user ${userId}:`, error);
      return {
        success: false,
        userId,
        comparisonsCreated: 0,
        comparisonsFailed: 0,
        skipped: false,
        errors: [error instanceof Error ? error.message : String(error)],
        comparisonIds: []
      };
    }
  }

  /**
   * Load current policies with health checks for a user
   */
  private async loadCurrentPolicies(userId: string): Promise<any[]> {
    // Get documents where documentType = "current"
    const documents = await this.storage.getUserDocuments(userId, 'current');
    
    const allPolicies: any[] = [];
    
    for (const doc of documents) {
      const snapshots = await this.storage.getOfferSnapshotsByDocument(doc.id);
      
      for (const snapshot of snapshots) {
        // Get health check for this snapshot
        const healthChecks = await this.storage.getHealthChecksByDocument(doc.id);
        const healthCheck = healthChecks.find(hc => hc.offerSnapshotId === snapshot.id);
        
        if (!healthCheck) {
          console.warn(`[ComparisonOrchestrator] No health check for snapshot ${snapshot.id}, skipping`);
          continue;
        }
        
        // Parse health check payload
        const healthCheckData = typeof healthCheck.payload === 'string' 
          ? JSON.parse(healthCheck.payload)
          : healthCheck.payload;
        
        allPolicies.push({
          snapshotId: snapshot.id,
          policyType: snapshot.policyType,
          companyId: snapshot.companyId,
          premium: snapshot.premium,
          healthCheck: healthCheckData,
          documentId: doc.id
        });
      }
    }
    
    return allPolicies;
  }

  /**
   * Load offer policies with health checks for a user
   */
  private async loadOfferPolicies(userId: string): Promise<any[]> {
    // Get documents where documentType = "offer"
    const documents = await this.storage.getUserDocuments(userId, 'offer');
    
    const allPolicies: any[] = [];
    
    for (const doc of documents) {
      const snapshots = await this.storage.getOfferSnapshotsByDocument(doc.id);
      
      for (const snapshot of snapshots) {
        // Get health check for this snapshot
        const healthChecks = await this.storage.getHealthChecksByDocument(doc.id);
        const healthCheck = healthChecks.find(hc => hc.offerSnapshotId === snapshot.id);
        
        if (!healthCheck) {
          console.warn(`[ComparisonOrchestrator] No health check for snapshot ${snapshot.id}, skipping`);
          continue;
        }
        
        // Parse health check payload
        const healthCheckData = typeof healthCheck.payload === 'string' 
          ? JSON.parse(healthCheck.payload)
          : healthCheck.payload;
        
        allPolicies.push({
          snapshotId: snapshot.id,
          policyType: snapshot.policyType,
          companyId: snapshot.companyId,
          premium: snapshot.premium,
          healthCheck: healthCheckData,
          documentId: doc.id,
          offerNumber: snapshot.coverageDetails?.offerNumber
        });
      }
    }
    
    return allPolicies;
  }

  /**
   * Group policies by company pair (currentCompany, offerCompany)
   */
  private groupByCompanyPair(
    currentPolicies: any[],
    offerPolicies: any[]
  ): Array<{
    currentCompany: string;
    offerCompany: string;
    currentPolicies: any[];
    offerPolicies: any[];
  }> {
    const pairs = new Map<string, { currentCompany: string; offerCompany: string; currentPolicies: any[]; offerPolicies: any[] }>();
    
    // Get unique company combinations
    for (const current of currentPolicies) {
      for (const offer of offerPolicies) {
        const currentCompanyId = current.companyId || 'unknown';
        const offerCompanyId = offer.companyId || 'unknown';
        
        // Skip if same company (no point comparing company to itself)
        if (currentCompanyId === offerCompanyId) {
          continue;
        }
        
        const pairKey = `${currentCompanyId}|${offerCompanyId}`;
        
        if (!pairs.has(pairKey)) {
          pairs.set(pairKey, {
            currentCompany: currentCompanyId,
            offerCompany: offerCompanyId,
            currentPolicies: [],
            offerPolicies: []
          });
        }
      }
    }
    
    // Populate each pair with relevant policies
    for (const [pairKey, pair] of pairs.entries()) {
      pair.currentPolicies = currentPolicies.filter(p => (p.companyId || 'unknown') === pair.currentCompany);
      pair.offerPolicies = offerPolicies.filter(p => (p.companyId || 'unknown') === pair.offerCompany);
    }
    
    return Array.from(pairs.values());
  }

  /**
   * Run comparison for a single company pair
   */
  private async runComparisonForCompanyPair(
    userId: string,
    currentCompany: string,
    offerCompany: string,
    currentPolicies: any[],
    offerPolicies: any[],
    forceRerun: boolean
  ): Promise<string> {
    console.log(`[ComparisonOrchestrator] Comparing ${currentCompany} → ${offerCompany}`, {
      currentPolicies: currentPolicies.length,
      offerPolicies: offerPolicies.length
    });

    // Check if comparison already exists (idempotency)
    if (!forceRerun) {
      const existing = await this.storage.getCompanyComparisonByCompanies(
        userId,
        currentCompany,
        offerCompany
      );
      
      if (existing && existing.status === 'completed') {
        console.log(`[ComparisonOrchestrator] Comparison already exists (${existing.id}), skipping`);
        return existing.id;
      }
    }

    // Create comparison record with pending status
    const comparisonRecord: InsertCompanyComparison = {
      userId,
      currentCompany,
      offerCompany,
      status: 'pending',
      comparisonJSON: null,
      errorMessage: null
    };
    
    const comparison = await this.storage.createCompanyComparison(comparisonRecord);
    console.log(`[ComparisonOrchestrator] Created comparison record ${comparison.id}`);

    try {
      // Phase 3: Match policies using deterministic matcher
      const matchingResult = computeBestMatches(currentPolicies, offerPolicies);
      
      console.log(`[ComparisonOrchestrator] Phase 3 matching completed:`, {
        matched: matchingResult.pairs.length,
        unmatchedCurrent: matchingResult.unmatchedCurrent.length,
        unmatchedOffer: matchingResult.unmatchedOffer.length
      });

      if (matchingResult.pairs.length === 0) {
        console.warn(`[ComparisonOrchestrator] No matched pairs found, cannot generate comparison`);
        await this.storage.updateCompanyComparisonStatus(
          comparison.id,
          'failed',
          undefined,
          'No matched policy pairs found'
        );
        throw new Error('No matched policy pairs found');
      }

      // Phase 4: Generate comparison JSON using AI
      const comparisonResult = await comparisonAgentService.generateComparison(
        matchingResult.pairs,
        currentPolicies,
        offerPolicies
      );

      // Update record with completed status and result
      await this.storage.updateCompanyComparisonStatus(
        comparison.id,
        'completed',
        comparisonResult
      );

      console.log(`[ComparisonOrchestrator] Comparison completed successfully (${comparison.id})`);

      return comparison.id;

    } catch (error) {
      console.error(`[ComparisonOrchestrator] Comparison failed for ${currentCompany} → ${offerCompany}:`, error);
      
      // Update record with failed status
      await this.storage.updateCompanyComparisonStatus(
        comparison.id,
        'failed',
        undefined,
        error instanceof Error ? error.message : String(error)
      );
      
      throw error;
    }
  }
}
