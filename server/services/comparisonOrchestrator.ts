import type { IStorage } from "../storage";
import type { InsertCompanyComparison, CompanyComparison } from "@shared/schema";
import { computeBestMatches } from "./deterministicMatcher";
import { comparisonAgentService } from "./comparisonAgentService";
import { matchCoverages } from "./coverageMatcher";
import { generateHighlights } from "./highlightsGenerator";

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
   * Extract annual premium from policy snapshot using PricingAgent
   * Returns null if no valid premium found (never defaults to 0)
   * 
   * NEW: Exclusively uses structuredPolicy.pricing (PricingAgent output)
   * Old brittle logic (snapshot.premium) is no longer used.
   * 
   * Telemetry: Logs detailed reasons when premium is rejected for observability.
   * 
   * @param policy - Policy object with structuredPolicy.pricing field
   * @returns number | null - Annual premium or null if not available
   */
  private getAnnualPremiumFromSnapshot(policy: any): number | null {
    const policyId = policy?.id?.substring(0, 8) || 'unknown';
    const policyType = policy?.policyType || 'unknown';

    if (!policy || !policy.structuredPolicy) {
      console.warn(`[ComparisonOrchestrator] No structuredPolicy for ${policyType} (${policyId})`);
      return null;
    }

    try {
      const structured = typeof policy.structuredPolicy === 'string'
        ? JSON.parse(policy.structuredPolicy)
        : policy.structuredPolicy;
      
      // NEW: Only use PricingAgent output (structuredPolicy.pricing)
      const pricing = structured?.pricing;
      
      if (!pricing) {
        console.warn(`[ComparisonOrchestrator] No pricing object for ${policyType} (${policyId}) - PricingAgent may have failed`);
        return null;
      }

      // Only accept pricing when status is "ok"
      if (pricing.pricingStatus !== 'ok') {
        console.warn(`[ComparisonOrchestrator] Pricing status="${pricing.pricingStatus}" for ${policyType} (${policyId}), rejecting premium. Notes: ${pricing.notes || 'N/A'}`);
        return null;
      }

      // Extract annualPremium
      const premium = pricing.annualPremium;
      
      if (typeof premium !== 'number') {
        console.warn(`[ComparisonOrchestrator] annualPremium is not a number for ${policyType} (${policyId}): ${typeof premium}`);
        return null;
      }

      // Treat 0 as "unknown" – we never want 0 DKK as a default
      if (premium <= 0) {
        console.warn(`[ComparisonOrchestrator] annualPremium=${premium} is invalid for ${policyType} (${policyId}), treating as null`);
        return null;
      }

      // Success path - emit telemetry
      console.log(`[ComparisonOrchestrator] ✅ Using PricingAgent premium for ${policyType} (${policyId}): ${premium} DKK (confidence=${pricing.pricingConfidence}%)`);
      return premium;
    } catch (e) {
      console.error(`[ComparisonOrchestrator] Failed to extract pricing for ${policyType} (${policyId}):`, e);
      return null;
    }
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
      // Step 1.4: Skip failed documents (defective/password-protected/too-large PDFs)
      if (doc.extractionStatus === 'failed') {
        console.log(`[ComparisonOrchestrator] Skipping failed document ${doc.id} (reason: ${(doc as any).errorReason || 'unknown'})`);
        continue;
      }
      
      // Fetch snapshots and health checks once per document
      const snapshots = await this.storage.getOfferSnapshotsByDocument(doc.id);
      const healthChecks = await this.storage.getHealthChecksByDocument(doc.id);
      
      // Phase 2: Match snapshots to health checks by ID (via snapshot_id FK)
      for (const snapshot of snapshots) {
        // Find health check using snapshot_id FK (deterministic, not index-based)
        const healthCheck = healthChecks.find(hc => hc.snapshotId === snapshot.id);
        
        if (!healthCheck) {
          console.warn(`[ComparisonOrchestrator] No health check for snapshot ${snapshot.id}, including anyway (coverage data will be limited)`);
          // Don't skip - allow policies without health checks for Phase 3 matching
          // Health checks are only needed for detailed coverage comparison UI
        }
        
        // Parse health check result (stored as JSON in 'result' field, not 'payload')
        // Handle null healthCheck gracefully
        const healthCheckData = healthCheck
          ? (typeof healthCheck.result === 'string' ? JSON.parse(healthCheck.result) : healthCheck.result)
          : null;
        
        // Defensive fallback: Resolve company_id if null
        const companyId = await this.resolveCompanyFromPolicy(snapshot);
        
        allPolicies.push({
          id: snapshot.id, // Required by deterministic matcher
          snapshotId: snapshot.id, // Keep for backward compatibility
          policyType: snapshot.policyType,
          companyId: companyId,
          premium: snapshot.premium,
          healthCheck: healthCheckData, // Can be null
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
      // Step 1.4: Skip failed documents (defective/password-protected/too-large PDFs)
      if (doc.extractionStatus === 'failed') {
        console.log(`[ComparisonOrchestrator] Skipping failed document ${doc.id} (reason: ${(doc as any).errorReason || 'unknown'})`);
        continue;
      }
      
      // Fetch snapshots and health checks once per document
      const snapshots = await this.storage.getOfferSnapshotsByDocument(doc.id);
      const healthChecks = await this.storage.getHealthChecksByDocument(doc.id);
      
      // Phase 2: Match snapshots to health checks by ID (via snapshot_id FK)
      for (const snapshot of snapshots) {
        // Find health check using snapshot_id FK (deterministic, not index-based)
        const healthCheck = healthChecks.find(hc => hc.snapshotId === snapshot.id);
        
        if (!healthCheck) {
          console.warn(`[ComparisonOrchestrator] No health check for snapshot ${snapshot.id}, including anyway (coverage data will be limited)`);
          // Don't skip - allow policies without health checks for Phase 3 matching
          // Health checks are only needed for detailed coverage comparison UI
        }
        
        // Parse health check result (stored as JSON in 'result' field, not 'payload')
        // Handle null healthCheck gracefully
        const healthCheckData = healthCheck
          ? (typeof healthCheck.result === 'string' ? JSON.parse(healthCheck.result) : healthCheck.result)
          : null;
        
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
   * Score an offer snapshot based on data quality/completeness
   * Prefers snapshots with:
   * 1. Pricing data (pricingStatus === 'ok') - highest priority
   * 2. Health check available
   * 3. Newest created_at
   * 
   * Returns a numeric score (higher = better)
   */
  private scoreOfferSnapshot(snapshot: any): number {
    let score = 0;

    // Extract pricing status
    const hasPricing = (() => {
      if (!snapshot.structuredPolicy) return false;
      try {
        const structured = typeof snapshot.structuredPolicy === 'string'
          ? JSON.parse(snapshot.structuredPolicy)
          : snapshot.structuredPolicy;
        return structured?.pricing?.pricingStatus === 'ok';
      } catch (e) {
        return false;
      }
    })();

    // Strong bonus for having pricing data
    if (hasPricing) score += 1000;

    // Bonus for having health check
    if (snapshot.healthCheck) score += 100;

    // Small tiebreaker based on created_at (newer = better)
    // Divide by 1 billion to keep it small relative to other bonuses
    const createdAt = snapshot.createdAt || snapshot.created_at;
    if (createdAt) {
      const timestamp = new Date(createdAt).getTime();
      if (!isNaN(timestamp)) {
        score += timestamp / 1_000_000_000;
      }
    }

    return score;
  }

  /**
   * Select the best offer snapshot for each policy type
   * When multiple snapshots exist for the same (companyId, policyType), 
   * prefer the one with:
   * 1. Pricing data (pricingStatus === 'ok')
   * 2. Health check
   * 3. Newest created_at
   */
  private selectBestOfferSnapshots(offerPolicies: any[]): any[] {
    // Group by policyType
    const byType = new Map<string, any[]>();
    for (const policy of offerPolicies) {
      const policyType = policy.policyType;
      if (!policyType) continue;
      
      if (!byType.has(policyType)) {
        byType.set(policyType, []);
      }
      byType.get(policyType)!.push(policy);
    }

    // For each type, select the best snapshot
    const bestSnapshots: any[] = [];
    for (const [policyType, snapshots] of Array.from(byType.entries())) {
      if (snapshots.length === 1) {
        bestSnapshots.push(snapshots[0]);
        continue;
      }

      // Multiple snapshots for this type - score and pick best
      const scored = snapshots.map((s: any) => ({
        snapshot: s,
        score: this.scoreOfferSnapshot(s)
      }));

      scored.sort((a: any, b: any) => b.score - a.score);
      const best = scored[0].snapshot;

      console.log(`[ComparisonOrchestrator] Selected best ${policyType} snapshot: ${best.id?.substring(0, 8)} (score=${scored[0].score.toFixed(2)}) from ${snapshots.length} candidates`, {
        candidates: scored.map((s: any) => ({
          id: s.snapshot.id?.substring(0, 8),
          score: s.score.toFixed(2),
          hasPricing: this.scoreOfferSnapshot(s.snapshot) >= 1000,
          hasHealthCheck: !!s.snapshot.healthCheck
        }))
      });

      bestSnapshots.push(best);
    }

    return bestSnapshots;
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
      
      // For offer policies, select the BEST snapshot per policy type
      const candidateOffers = offerPolicies.filter(p => (p.companyId || 'unknown') === pair.offerCompany);
      pair.offerPolicies = this.selectBestOfferSnapshots(candidateOffers);
      
      console.log(`[ComparisonOrchestrator] Company pair ${pair.currentCompany} → ${pair.offerCompany}: selected ${pair.offerPolicies.length} best offer snapshots from ${candidateOffers.length} candidates`);
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
        console.log(`[ComparisonOrchestrator] Comparison already exists (${existing.id}), generating debug report...`);
        
        // Always generate debug report (even for existing comparisons)
        try {
          const { generateComparisonDebugReport } = await import('./comparisonDebugReportService');
          const report = await generateComparisonDebugReport(existing.id, { 
            saveToDisk: true, 
            logToConsole: false 
          });
          if (report.filePath) {
            console.log(`[ComparisonOrchestrator] 📊 Debug report saved: ${report.filePath}`);
          }
        } catch (reportError) {
          console.warn('[ComparisonOrchestrator] Failed to generate debug report:', reportError);
        }
        
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

      // ========================================
      // ENRICHMENT PATTERN IMPLEMENTATION
      // ========================================
      // STEP 1: Build DETERMINISTIC data (facts, numbers, coverage rows)
      // STEP 2: Send ONLY health checks to AI for narrative generation
      // STEP 3: MERGE AI narratives with cached deterministic data
      // ========================================

      // STEP 1: Cache deterministic data (coverage rows, highlights, cost summaries)
      // Generate UNIQUE IDs for each policy to prevent duplicate policy type collisions
      const deterministicPolicyData = matchingResult.pairs.map((pair, index) => {
        const currentPolicy = currentPolicies.find(p => p.snapshotId === pair.currentPolicyId);
        const offerPolicy = offerPolicies.find(p => p.snapshotId === pair.offerPolicyId);
        
        if (!currentPolicy || !offerPolicy) {
          throw new Error(`Missing policy data for pair: ${pair.policyType}`);
        }
        
        // Generate SIMPLE policyKey for AI (easy to echo back)
        const policyKey = `policy-${index + 1}`;
        
        // Generate UNIQUE deterministicId (prevents duplicate policy type collisions) - KEPT SERVER-SIDE
        const deterministicId = `${pair.currentPolicyId}-${pair.offerPolicyId}`;
        
        // Extract premiums using null-safe helper (never defaults to 0)
        const currentAnnualPremium = this.getAnnualPremiumFromSnapshot(currentPolicy);
        const offerAnnualPremium = this.getAnnualPremiumFromSnapshot(offerPolicy);
        
        // Compute savings only when both premiums are available
        let annualSavings: number | null = null;
        let annualSavingsPercent: number | null = null;
        
        if (currentAnnualPremium != null && offerAnnualPremium != null) {
          annualSavings = currentAnnualPremium - offerAnnualPremium;
          annualSavingsPercent = currentAnnualPremium > 0 
            ? (annualSavings / currentAnnualPremium) * 100 
            : null;
        }
        
        // DETERMINISTIC COVERAGE MATCHING
        const currentCoverages = currentPolicy.healthCheck?.whatsIncluded || [];
        const offerCoverages = offerPolicy.healthCheck?.whatsIncluded || [];
        const coverageRows = matchCoverages(currentCoverages, offerCoverages);
        
        console.log(`[ComparisonOrchestrator] Built ${coverageRows.length} deterministic coverage rows for ${pair.policyType} (ID: ${deterministicId})`);
        
        // DETERMINISTIC HIGHLIGHTS GENERATION
        // Pass 0 as fallback for highlights calculation (highlights don't require exact pricing)
        const highlights = generateHighlights({
          coverageRows,
          currentAnnualPremium: currentAnnualPremium ?? 0,
          offerAnnualPremium: offerAnnualPremium ?? 0,
          policyType: pair.policyType
        });
        
        console.log(`[ComparisonOrchestrator] Built ${highlights.length} deterministic highlights for ${pair.policyType} (ID: ${deterministicId})`);
        
        return {
          policyKey, // Simple slot key for AI to echo back
          deterministicId, // UNIQUE ID (server-side only, rehydrated after AI call)
          policyType: pair.policyType,
          label: pair.label,
          currentCompany,
          offerCompany,
          currentPolicyId: pair.currentPolicyId, // Snapshot ID for current policy
          offerPolicyId: pair.offerPolicyId, // Snapshot ID for offer policy
          costSummary: {
            currentAnnualPremium,
            offerAnnualPremium,
            annualSavings,
            annualSavingsPercent: annualSavingsPercent != null ? Math.round(annualSavingsPercent * 10) / 10 : null
          },
          coverageComparison: { rows: coverageRows }, // CACHED - NOT sent to AI
          highlights, // CACHED - NOT sent to AI
          healthCheckData: {
            current: currentPolicy.healthCheck,
            offer: offerPolicy.healthCheck
          }
        };
      });

      console.log(`[ComparisonOrchestrator] ✅ Cached deterministic data for ${deterministicPolicyData.length} policies`);
      
      // BUILD policyKey → deterministicId mapping (for rehydration after AI call)
      const keyToIdMap = new Map(deterministicPolicyData.map(d => [d.policyKey, d.deterministicId]));
      console.log(`[ComparisonOrchestrator] Created policyKey mapping: ${Array.from(keyToIdMap.keys()).join(', ')}`);
      
      // STEP 2: Generate narratives (deterministic for single-policy, AI for multi-policy)
      let aiNarratives;
      
      if (deterministicPolicyData.length === 1) {
        // SINGLE-POLICY PATH: Use deterministic narrative builder (no AI, no hallucinations)
        const { buildSinglePolicyNarrative } = await import('./comparisonNarrativeBuilder');
        const policy = deterministicPolicyData[0];
        
        console.log(
          `[ComparisonOrchestrator] Using deterministic single-policy narrative builder for policyType=${policy.policyType}`
        );
        
        aiNarratives = buildSinglePolicyNarrative({
          policyKey: policy.policyKey,
          policyType: policy.policyType,
          currentCompany: policy.currentCompany,
          offerCompany: policy.offerCompany,
          costSummary: policy.costSummary,
          healthCheckData: policy.healthCheckData,
        });
        
        console.log(`[ComparisonOrchestrator] ✅ Deterministic narrative built for 1 policy`);
      } else {
        // MULTI-POLICY PATH: Use AI enrichment (existing flow)
        const aiInput = {
          context: {
            currentCompany,
            offerCompany,
            currency: 'DKK'
          },
          policies: deterministicPolicyData.map(p => ({
            policyKey: p.policyKey, // SIMPLE key for AI to echo back (e.g. "policy-1")
            policyType: p.policyType,
            label: p.label,
            currentCompany: p.currentCompany,
            offerCompany: p.offerCompany,
            healthCheckData: p.healthCheckData
          }))
        };

        console.log(`[ComparisonOrchestrator] Calling AI for narratives (NO coverage rows or highlights sent)...`);
        
        aiNarratives = await comparisonAgentService.generateNarrative(aiInput);
        
        console.log(`[ComparisonOrchestrator] ✅ AI returned narratives for ${aiNarratives.policyNarratives.length} policies`);
      }

      // STEP 3: VALIDATE policyKeys and REHYDRATE deterministicIds
      // Build dictionaries for O(1) lookup using simple policyKeys
      const deterministicByKey = new Map(deterministicPolicyData.map(d => [d.policyKey, d]));
      const narrativeByKey = new Map(aiNarratives.policyNarratives.map(n => [n.policyKey, n]));

      // Validate: All expected policyKeys must have matching narratives
      const expectedKeys = Array.from(deterministicByKey.keys());
      const returnedKeys = Array.from(narrativeByKey.keys());
      
      for (const key of expectedKeys) {
        if (!narrativeByKey.has(key)) {
          throw new Error(`AI did not return narrative for policyKey: ${key}. Expected: ${expectedKeys.join(', ')}, Got: ${returnedKeys.join(', ')}`);
        }
      }

      // Validate: AI must not return unexpected policyKeys
      for (const key of returnedKeys) {
        if (!deterministicByKey.has(key)) {
          throw new Error(`AI returned narrative for unexpected policyKey: ${key}. Expected: ${expectedKeys.join(', ')}, Got: ${returnedKeys.join(', ')}`);
        }
      }

      console.log(`[ComparisonOrchestrator] ✅ policyKey validation passed: All ${expectedKeys.length} keys matched`);

      // Perform merge: Deterministic data + AI narratives (rehydrate deterministicIds)
      const policyComparisons = deterministicPolicyData.map(deterministicData => {
        const narrative = narrativeByKey.get(deterministicData.policyKey)!;

        // Merge: Deterministic data + AI narratives
        const merged = {
          policyType: deterministicData.policyType,
          label: deterministicData.label,
          currentCompany: deterministicData.currentCompany,
          offerCompany: deterministicData.offerCompany,
          currentPolicyId: deterministicData.currentPolicyId, // Snapshot ID for navigation
          offerPolicyId: deterministicData.offerPolicyId, // Snapshot ID for navigation
          costSummary: deterministicData.costSummary, // DETERMINISTIC (immutable)
          highlights: deterministicData.highlights, // DETERMINISTIC (immutable)
          coverageComparison: deterministicData.coverageComparison, // DETERMINISTIC (immutable)
          missingInformation: narrative.missingInformation, // AI NARRATIVE
          recommendations: narrative.recommendations, // AI NARRATIVE
        };

        // INTEGRITY VALIDATION: Ensure deterministic data wasn't mutated
        // Deep equality check on coverage rows to catch any corruption
        if (JSON.stringify(merged.coverageComparison.rows) !== JSON.stringify(deterministicData.coverageComparison.rows)) {
          throw new Error(
            `INTEGRITY VIOLATION: Coverage rows were mutated for ${deterministicData.policyType} (ID: ${deterministicData.deterministicId}). ` +
            `Expected ${deterministicData.coverageComparison.rows.length} rows, got ${merged.coverageComparison.rows.length}.`
          );
        }

        if (JSON.stringify(merged.highlights) !== JSON.stringify(deterministicData.highlights)) {
          throw new Error(
            `INTEGRITY VIOLATION: Highlights were mutated for ${deterministicData.policyType} (ID: ${deterministicData.deterministicId}). ` +
            `Expected ${deterministicData.highlights.length} highlights, got ${merged.highlights.length}.`
          );
        }

        if (JSON.stringify(merged.costSummary) !== JSON.stringify(deterministicData.costSummary)) {
          throw new Error(
            `INTEGRITY VIOLATION: Cost summary was mutated for ${deterministicData.policyType} (ID: ${deterministicData.deterministicId}).`
          );
        }

        return merged;
      });

      // Build overall comparison (deterministic calculations + AI explanation)
      // Filter to only include policies where BOTH premiums are available
      const pricedPolicies = deterministicPolicyData.filter(p =>
        p.costSummary.currentAnnualPremium != null &&
        p.costSummary.offerAnnualPremium != null
      );

      let totalCurrentAnnualPremium: number | null = null;
      let totalOfferAnnualPremium: number | null = null;
      let annualSavings: number | null = null;
      let annualSavingsPercent: number | null = null;

      if (pricedPolicies.length > 0) {
        const sumCurrent = pricedPolicies.reduce(
          (sum, p) => sum + (p.costSummary.currentAnnualPremium as number),
          0
        );
        const sumOffer = pricedPolicies.reduce(
          (sum, p) => sum + (p.costSummary.offerAnnualPremium as number),
          0
        );

        totalCurrentAnnualPremium = sumCurrent;
        totalOfferAnnualPremium = sumOffer;
        annualSavings = sumCurrent - sumOffer;
        annualSavingsPercent = sumCurrent > 0 ? (annualSavings / sumCurrent) * 100 : null;
      }

      console.log(`[ComparisonOrchestrator] Overall pricing coverage: ${pricedPolicies.length}/${deterministicPolicyData.length} policies have both current and offer premiums`);

      // Calculate pricing status for metadata
      const policiesWithOfferPricing = deterministicPolicyData.filter(p => 
        p.costSummary.offerAnnualPremium != null
      );
      
      let pricingStatus: 'complete' | 'partial' | 'missing';
      if (policiesWithOfferPricing.length === 0) {
        pricingStatus = 'missing';
      } else if (policiesWithOfferPricing.length < deterministicPolicyData.length) {
        pricingStatus = 'partial';
      } else {
        pricingStatus = 'complete';
      }

      console.log(`[ComparisonOrchestrator] Pricing status: ${pricingStatus} (${policiesWithOfferPricing.length}/${deterministicPolicyData.length} policies have offer pricing)`);

      const comparisonResult = {
        meta: {
          pricingStatus,
          totalPolicies: deterministicPolicyData.length,
          policiesWithOfferPricing: policiesWithOfferPricing.length,
          currentCompany,
          offerCompany,
        },
        overall: {
          totalCurrentAnnualPremium,
          totalOfferAnnualPremium,
          annualSavings,
          annualSavingsPercent: annualSavingsPercent != null ? Math.round(annualSavingsPercent * 10) / 10 : null,
          explanation: aiNarratives.explanation, // AI NARRATIVE
          perPolicySummary: deterministicPolicyData.map(p => ({
            policyType: p.policyType,
            label: p.label,
            currentAnnualPremium: p.costSummary.currentAnnualPremium,
            offerAnnualPremium: p.costSummary.offerAnnualPremium,
            annualSavings: p.costSummary.annualSavings,
            annualSavingsPercent: p.costSummary.annualSavingsPercent,
          })),
          globalHighlights: [], // Could aggregate from policy highlights if needed
        },
        policyComparisons, // MERGED: Deterministic + AI narratives
        cumulativeSavings: annualSavings != null ? {
          totalOver10Years: annualSavings * 10,
          monthlyRange: {
            min: Math.floor(annualSavings / 12),
            max: Math.ceil(annualSavings / 12),
          },
          after12Months: annualSavings,
          after10Years: annualSavings * 10,
          chartData: Array.from({ length: 120 }, (_, i) => ({
            month: `Måned ${i + 1}`,
            savings: annualSavings * (i + 1) / 12,
          })),
        } : null,
      };

      console.log(`[ComparisonOrchestrator] ✅ MERGE COMPLETE: Built final comparison with ${policyComparisons.length} policies`);
      console.log(`[ComparisonOrchestrator] Coverage row counts (DETERMINISTIC, preserved):`, 
        policyComparisons.map(pc => ({ type: pc.policyType, rows: pc.coverageComparison.rows.length }))
      );

      // Update record with completed status and result
      await this.storage.updateCompanyComparisonStatus(
        comparison.id,
        'completed',
        comparisonResult,
        undefined,
        undefined
      );

      console.log(`[ComparisonOrchestrator] Comparison completed successfully (${comparison.id})`);

      // Generate debug report for this comparison
      try {
        const { generateComparisonDebugReport } = await import('./comparisonDebugReportService');
        const report = await generateComparisonDebugReport(comparison.id, { 
          saveToDisk: true, 
          logToConsole: false 
        });
        if (report.filePath) {
          console.log(`[ComparisonOrchestrator] 📊 Debug report saved: ${report.filePath}`);
        }
      } catch (reportError) {
        console.warn('[ComparisonOrchestrator] Failed to generate debug report:', reportError);
      }

      // Send email notification to user
      try {
        const { notificationService } = await import('./notificationService');
        const result = await notificationService.sendComparisonReady(comparison.id);
        if (result.sent) {
          console.log(`[ComparisonOrchestrator] 📧 Email notification sent for comparison ${comparison.id}`);
        } else {
          console.log(`[ComparisonOrchestrator] 📧 Email notification skipped: ${result.reason}`);
        }
      } catch (notificationError) {
        console.warn('[ComparisonOrchestrator] Failed to send email notification:', notificationError);
      }

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
      
      // Generate debug report for failed comparison
      try {
        const { generateComparisonDebugReport } = await import('./comparisonDebugReportService');
        const report = await generateComparisonDebugReport(comparison.id, { 
          saveToDisk: true, 
          logToConsole: false 
        });
        if (report.filePath) {
          console.log(`[ComparisonOrchestrator] 📊 Debug report saved (FAILED): ${report.filePath}`);
        }
      } catch (reportError) {
        console.warn('[ComparisonOrchestrator] Failed to generate debug report:', reportError);
      }
      
      throw error;
    }
  }
}
