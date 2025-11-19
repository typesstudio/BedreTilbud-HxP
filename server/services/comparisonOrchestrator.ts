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
    const startTime = Date.now();

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

      // 6. Gather statusReason breakdown for failed comparisons
      const failureReasons: Record<string, number> = {};
      const allComparisons = await this.storage.getCompanyComparisonsByUser(userId);
      allComparisons
        .filter(c => c.status === 'failed' && c.statusReason)
        .forEach(c => {
          const reason = c.statusReason || 'UNKNOWN';
          failureReasons[reason] = (failureReasons[reason] || 0) + 1;
        });

      const elapsedMs = Date.now() - startTime;
      const successRate = companyPairs.length > 0 
        ? ((successful.length / companyPairs.length) * 100).toFixed(1)
        : '0.0';

      // Log comprehensive summary
      console.log(`[ComparisonOrchestrator] ✅ SUMMARY for user ${userId}:`, {
        totalPairs: companyPairs.length,
        successful: successful.length,
        failed: failed.length,
        successRate: `${successRate}%`,
        elapsedMs: `${elapsedMs}ms`,
        currentPoliciesLoaded: currentPoliciesData.length,
        offerPoliciesLoaded: offerPoliciesData.length,
        failureReasons: Object.keys(failureReasons).length > 0 ? failureReasons : 'none',
        comparisonIds: comparisonIds.length > 0 ? `${comparisonIds.length} created` : 'none'
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
   * Defensive fallback: Resolve company_id from structuredPolicy if null
   * This handles edge cases where extraction didn't set company_id
   */
  private async resolveCompanyFromPolicy(snapshot: any): Promise<string | null> {
    if (snapshot.companyId) {
      return snapshot.companyId;
    }
    
    // Try to extract company name from structuredPolicy
    try {
      const structuredPolicyData = typeof snapshot.structuredPolicy === 'string'
        ? JSON.parse(snapshot.structuredPolicy)
        : snapshot.structuredPolicy;
      
      const companyName = structuredPolicyData?.company || structuredPolicyData?.companyName;
      
      if (!companyName) {
        console.warn(`[ComparisonOrchestrator] Snapshot ${snapshot.id} has null company_id and no company in structuredPolicy`);
        return null;
      }
      
      // Attempt exact normalized match against companies table
      const companies = await this.storage.getActiveCompanies();
      
      // Normalize: lowercase, trim, remove punctuation for exact matching
      const normalize = (str: string) => 
        str.toLowerCase().trim().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ');
      
      const normalizedSearch = normalize(companyName);
      
      const match = companies.find((c: any) => 
        normalize(c.name) === normalizedSearch
      );
      
      if (match) {
        console.warn(`[ComparisonOrchestrator] Fallback: Resolved company_id for snapshot ${snapshot.id} via exact match: "${companyName}" → ${match.id}`);
        return match.id;
      }
      
      // Log available candidates for debugging
      const candidates = companies.map((c: any) => c.name).join(', ');
      console.warn(
        `[ComparisonOrchestrator] Fallback failed: No exact match for "${companyName}" (snapshot ${snapshot.id}). ` +
        `Available companies: ${candidates}. Leaving company_id as null.`
      );
      return null;
      
    } catch (error) {
      console.error(`[ComparisonOrchestrator] Error resolving company from structuredPolicy:`, error);
      return null;
    }
  }

  /**
   * Load current policies with health checks for a user
   * Phase 2: Use ID-based matching via snapshot_id FK
   */
  private async loadCurrentPolicies(userId: string): Promise<any[]> {
    // Get documents where documentType = "current"
    const documents = await this.storage.getUserDocuments(userId, 'current');
    
    const allPolicies: any[] = [];
    
    for (const doc of documents) {
      // Fetch snapshots and health checks once per document
      const snapshots = await this.storage.getOfferSnapshotsByDocument(doc.id);
      const healthChecks = await this.storage.getHealthChecksByDocument(doc.id);
      
      // Phase 2: Match snapshots to health checks by ID (via snapshot_id FK)
      for (const snapshot of snapshots) {
        // Find health check using snapshot_id FK (deterministic, not index-based)
        const healthCheck = healthChecks.find(hc => hc.snapshotId === snapshot.id);
        
        if (!healthCheck) {
          console.warn(`[ComparisonOrchestrator] No health check for snapshot ${snapshot.id}, skipping`);
          continue;
        }
        
        // Parse health check result (stored as JSON in 'result' field, not 'payload')
        const healthCheckData = typeof healthCheck.result === 'string' 
          ? JSON.parse(healthCheck.result)
          : healthCheck.result;
        
        // Defensive fallback: Resolve company_id if null
        const companyId = await this.resolveCompanyFromPolicy(snapshot);
        
        allPolicies.push({
          id: snapshot.id, // Required by deterministic matcher
          snapshotId: snapshot.id, // Keep for backward compatibility
          policyType: snapshot.policyType,
          companyId: companyId,
          premium: snapshot.premium,
          healthCheck: healthCheckData,
          structuredPolicy: snapshot.structuredPolicy,
          documentId: doc.id
        });
      }
    }
    
    return allPolicies;
  }

  /**
   * Load offer policies with health checks for a user
   * Phase 2: Use ID-based matching via snapshot_id FK
   */
  private async loadOfferPolicies(userId: string): Promise<any[]> {
    // Get documents where documentType = "offer"
    const documents = await this.storage.getUserDocuments(userId, 'offer');
    
    const allPolicies: any[] = [];
    
    for (const doc of documents) {
      // Fetch snapshots and health checks once per document
      const snapshots = await this.storage.getOfferSnapshotsByDocument(doc.id);
      const healthChecks = await this.storage.getHealthChecksByDocument(doc.id);
      
      // Phase 2: Match snapshots to health checks by ID (via snapshot_id FK)
      for (const snapshot of snapshots) {
        // Find health check using snapshot_id FK (deterministic, not index-based)
        const healthCheck = healthChecks.find(hc => hc.snapshotId === snapshot.id);
        
        if (!healthCheck) {
          console.warn(`[ComparisonOrchestrator] No health check for snapshot ${snapshot.id}, skipping`);
          continue;
        }
        
        // Parse health check result (stored as JSON in 'result' field, not 'payload')
        const healthCheckData = typeof healthCheck.result === 'string' 
          ? JSON.parse(healthCheck.result)
          : healthCheck.result;
        
        // Extract offer number from structuredPolicy if available
        const structuredPolicyData = typeof snapshot.structuredPolicy === 'string'
          ? JSON.parse(snapshot.structuredPolicy)
          : snapshot.structuredPolicy;
        const offerNumber = structuredPolicyData?.offerNumber || structuredPolicyData?.policyNumber;
        
        // Defensive fallback: Resolve company_id if null
        const companyId = await this.resolveCompanyFromPolicy(snapshot);
        
        allPolicies.push({
          id: snapshot.id, // Required by deterministic matcher
          snapshotId: snapshot.id, // Keep for backward compatibility
          policyType: snapshot.policyType,
          companyId: companyId,
          premium: snapshot.premium,
          healthCheck: healthCheckData,
          structuredPolicy: snapshot.structuredPolicy,
          documentId: doc.id,
          offerNumber
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
        
        // Allow same-company comparisons (renewal offers scenario)
        if (currentCompanyId === offerCompanyId) {
          console.log(`[ComparisonOrchestrator] Same-company renewal comparison allowed: ${currentCompanyId}`);
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
    for (const [pairKey, pair] of Array.from(pairs.entries())) {
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
        unmatchedOffer: matchingResult.unmatchedOffer.length,
        dataQualityError: matchingResult.dataQualityError || 'none'
      });

      // Check for data quality errors first
      if (matchingResult.dataQualityError) {
        console.error(`[ComparisonOrchestrator] Data quality error: ${matchingResult.dataQualityError}`);
        
        // Determine statusReason based on error message
        let statusReason = 'DATA_QUALITY_ERROR';
        if (matchingResult.dataQualityError.includes('current policies lack matching metadata')) {
          statusReason = 'MISSING_STRUCTURED_POLICY_CURRENT';
        } else if (matchingResult.dataQualityError.includes('offer policies lack matching metadata')) {
          statusReason = 'MISSING_STRUCTURED_POLICY_OFFER';
        }
        
        await this.storage.updateCompanyComparisonStatus(
          comparison.id,
          'failed',
          undefined,
          matchingResult.dataQualityError,
          statusReason
        );
        throw new Error(`Data quality error: ${matchingResult.dataQualityError}`);
      }

      if (matchingResult.pairs.length === 0) {
        console.warn(`[ComparisonOrchestrator] No matched pairs found, cannot generate comparison`);
        await this.storage.updateCompanyComparisonStatus(
          comparison.id,
          'failed',
          undefined,
          'No matched policy pairs found',
          'NO_MATCHED_PAIRS'
        );
        throw new Error('No matched policy pairs found');
      }

      // Phase 4: Build policyComparisons structure from matched pairs (CODE-DRIVEN)
      // This prevents AI from hallucinating policy types that don't exist
      const policyComparisons = matchingResult.pairs.map(pair => {
        const currentPolicy = currentPolicies.find(p => p.snapshotId === pair.currentPolicyId);
        const offerPolicy = offerPolicies.find(p => p.snapshotId === pair.offerPolicyId);
        
        if (!currentPolicy || !offerPolicy) {
          throw new Error(`Missing policy data for pair: ${pair.policyType}`);
        }
        
        const currentAnnualPremium = parseFloat(currentPolicy.premium || '0');
        const offerAnnualPremium = parseFloat(offerPolicy.premium || '0');
        const annualSavings = currentAnnualPremium - offerAnnualPremium;
        const annualSavingsPercent = currentAnnualPremium > 0 
          ? (annualSavings / currentAnnualPremium) * 100 
          : 0;
        
        return {
          policyType: pair.policyType,
          label: pair.label,
          currentCompany,
          offerCompany,
          costSummary: {
            currentAnnualPremium,
            offerAnnualPremium,
            annualSavings,
            annualSavingsPercent: Math.round(annualSavingsPercent * 10) / 10
          },
          // AI will fill these fields:
          highlights: [],
          coverageComparison: { rows: [] },
          missingInformation: [],
          recommendations: [],
          // Include health checks for AI to analyze
          _healthCheckData: {
            current: currentPolicy.healthCheck,
            offer: offerPolicy.healthCheck
          }
        };
      });

      console.log(`[ComparisonOrchestrator] Built ${policyComparisons.length} policy comparison skeletons (code-driven)`);

      // Phase 4: AI enriches the structure with narratives (AI cannot add/remove policies)
      const comparisonResult = await comparisonAgentService.generateComparison({
        context: {
          currentCompany,
          offerCompany,
          currency: 'DKK'
        },
        policyComparisons // Pass pre-built structure instead of raw pairs
      });

      // Update record with completed status and result (clear statusReason on success)
      await this.storage.updateCompanyComparisonStatus(
        comparison.id,
        'completed',
        comparisonResult,
        undefined,
        undefined
      );

      console.log(`[ComparisonOrchestrator] Comparison completed successfully (${comparison.id})`);

      return comparison.id;

    } catch (error) {
      console.error(`[ComparisonOrchestrator] Comparison failed for ${currentCompany} → ${offerCompany}:`, error);
      
      // Update record with failed status (preserve statusReason if already set by earlier logic)
      const errorMessage = error instanceof Error ? error.message : String(error);
      const statusReason = errorMessage.includes('Data quality error') ? undefined : 'COMPARISON_FAILED';
      
      await this.storage.updateCompanyComparisonStatus(
        comparison.id,
        'failed',
        undefined,
        errorMessage,
        statusReason
      );
      
      throw error;
    }
  }
}
