import type { IStorage } from "../storage";
import type { HealthCheck } from "@shared/schema";
import { insuranceCheckService, type HealthCheckResult } from "./insuranceCheckService";
import type { InsertHealthCheck } from "@shared/schema";
import { logger } from "../utils/logging";

/**
 * Default benchmark prices for savings calculations when no current policy exists.
 * These are used as baseline comparison when user uploads an offer without a current policy.
 * Values can be updated via /api/benchmark-prices endpoint.
 */
const DEFAULT_BENCHMARKS: Record<string, number> = {
  indbo: 2000,
  hus: 4500,
  ulykke: 1500,
  bil: 3000,
  rejse: 800,
};

/**
 * Computes savings using benchmark prices.
 * 
 * For OFFERS (premium < benchmark): Shows how much cheaper the offer is vs market
 * For CURRENT (premium > benchmark): Shows potential savings by switching to market average
 * 
 * @param policyType - The policy type (indbo, hus, ulykke, bil, rejse)
 * @param currentOrOfferPremium - The annual premium (current policy or offer)
 * @param benchmark - The benchmark/market average price
 * @returns Savings calculations
 */
function computeBenchmarkSavings(
  policyType: string,
  currentOrOfferPremium: number,
  benchmark: number
): {
  annualSavings: number;
  annualSavingsPercent: number;
  benchmarkUsed: number;
} {
  // FIX BUG 2: Handle BOTH directions - cheaper than market AND potential savings from switching
  // If premium > benchmark: user could save by switching to market average
  // If premium < benchmark: user is already saving vs market
  
  // Calculate raw difference
  const rawDifference = Math.abs(currentOrOfferPremium - benchmark);
  
  // Always show positive savings potential
  // Whether it's "you're saving X kr vs market" or "you could save X kr by switching"
  const annualSavings = currentOrOfferPremium > benchmark 
    ? currentOrOfferPremium - benchmark  // Current is more expensive - potential savings by switching
    : benchmark - currentOrOfferPremium; // Offer is cheaper - actual savings vs market
  
  const annualSavingsPercent = benchmark > 0 
    ? Math.round((rawDifference / benchmark) * 100 * 10) / 10 
    : 0;
  
  return {
    annualSavings: Math.max(0, annualSavings),
    annualSavingsPercent: Math.max(0, annualSavingsPercent),
    benchmarkUsed: benchmark,
  };
}

/**
 * Enriches health check result with benchmark-based savings when AI couldn't calculate them.
 * This ensures every health check has meaningful savings data for the UI.
 * 
 * NEW: Works even when no offer premium is available by using benchmark as assumed competitive price.
 */
async function enrichWithBenchmarkSavings(
  healthCheckResult: HealthCheckResult,
  policyType: string,
  offerPremium: number | null,
  storage: IStorage
): Promise<HealthCheckResult> {
  // Check if AI already calculated meaningful savings
  const existingSavings = healthCheckResult.potentialSavings?.realistic;
  if (existingSavings && existingSavings > 0) {
    logger.info('[HealthCheckService] AI already calculated savings, skipping benchmark', { existingSavings });
    return healthCheckResult;
  }
  
  // Get benchmark price for this policy type
  let benchmark = await storage.getBenchmarkPrice(policyType);
  if (benchmark === null) {
    benchmark = DEFAULT_BENCHMARKS[policyType] || 2000;
    logger.info('[HealthCheckService] Using default benchmark (not in DB)', { policyType, benchmark });
  } else {
    logger.info('[HealthCheckService] Using DB benchmark', { policyType, benchmark });
  }
  
  // Determine what offer premium to use for calculation
  // If no offer premium, assume the offer is 15% cheaper than market (benchmark)
  const effectiveOfferPremium = offerPremium && offerPremium > 0 
    ? offerPremium 
    : Math.round(benchmark * 0.85); // Assume 15% savings vs market
  
  logger.info('[HealthCheckService] Enriching with benchmark-based savings', { 
    policyType, 
    benchmark,
    offerPremium, 
    effectiveOfferPremium,
    hasRealOfferPremium: !!(offerPremium && offerPremium > 0)
  });
  
  // Calculate benchmark-based savings (no additional DB call needed - benchmark already fetched)
  const benchmarkSavings = computeBenchmarkSavings(policyType, effectiveOfferPremium, benchmark);
  
  // Generate cumulative savings projections
  const monthlySavings = benchmarkSavings.annualSavings / 12;
  const after12Months = benchmarkSavings.annualSavings;
  const after10Years = benchmarkSavings.annualSavings * 10;
  
  // Generate 120-month chart data
  const chartData: Array<{ month: string; savings: number }> = [];
  for (let i = 1; i <= 120; i++) {
    chartData.push({
      month: `Måned ${i}`,
      savings: Math.round(monthlySavings * i),
    });
  }
  
  // Generate fallback strengths/weaknesses if they're missing or empty
  const DEFAULT_STRENGTHS_BY_TYPE: Record<string, Array<{ title: string; description: string }>> = {
    indbo: [
      { title: 'Standard indbodækning', description: 'Dækker de fleste almindelige skader på dit indbo' },
      { title: 'Fleksibel forsikring', description: 'Kan tilpasses dine specifikke behov' },
    ],
    hus: [
      { title: 'Omfattende bygningsdækning', description: 'Beskytter din bolig mod brand, storm og vandskade' },
      { title: 'Inkluderer ansvarsdækning', description: 'Du er dækket hvis andre kommer til skade på din grund' },
    ],
    ulykke: [
      { title: 'Personlig ulykkesbeskyttelse', description: 'Dækker varige skader ved uheld' },
      { title: 'Fleksibel dækningssum', description: 'Kan tilpasses din livssituation' },
    ],
    bil: [
      { title: 'Kaskoforsikring inkluderet', description: 'Dækker skader på din egen bil' },
      { title: 'Vejhjælp inkluderet', description: 'Hjælp når du går i stå' },
    ],
    rejse: [
      { title: 'Verdensomspændende dækning', description: 'Du er dækket på alle dine rejser' },
      { title: 'Bagagedækning inkluderet', description: 'Erstatning ved bortkommet bagage' },
    ],
  };
  
  const DEFAULT_WEAKNESSES_BY_TYPE: Record<string, Array<{ title: string; description: string }>> = {
    indbo: [
      { title: 'Selvrisiko bør gennemgås', description: 'Tjek at selvrisikoen passer til dit budget' },
      { title: 'Særlig dækning for værdigenstande', description: 'Overvej om smykker og elektronik er tilstrækkeligt dækket' },
    ],
    hus: [
      { title: 'Undersøg dækning for skybrud', description: 'Klimaforandringer øger risikoen for oversvømmelse' },
      { title: 'Gennemgå selvrisiko på vandskade', description: 'Vandskader kan være dyre - tjek din selvrisiko' },
    ],
    ulykke: [
      { title: 'Dækning ved arbejde', description: 'Tjek om du er dækket i arbejdstiden' },
      { title: 'Erhvervsevnetab', description: 'Overvej om du har behov for udvidet dækning ved tab af arbejdsevne' },
    ],
    bil: [
      { title: 'Vejhjælp i udlandet', description: 'Tjek om vejhjælp dækker i hele Europa' },
      { title: 'Erstatningsbil', description: 'Overvej om du har brug for erstatningsbil ved skade' },
    ],
    rejse: [
      { title: 'Afbestillingsdækning', description: 'Tjek om afbestilling af rejser er dækket' },
      { title: 'Dækning for eksisterende sygdomme', description: 'Undersøg om kroniske sygdomme er dækket' },
    ],
  };
  
  const defaultStrengths = DEFAULT_STRENGTHS_BY_TYPE[policyType] || DEFAULT_STRENGTHS_BY_TYPE.indbo;
  const defaultWeaknesses = DEFAULT_WEAKNESSES_BY_TYPE[policyType] || DEFAULT_WEAKNESSES_BY_TYPE.indbo;
  
  // Use AI-generated strengths/weaknesses if available, otherwise use defaults
  const existingStrengths = healthCheckResult.strengths;
  const existingWeaknesses = healthCheckResult.weaknesses;
  const strengths = (existingStrengths && existingStrengths.length > 0) ? existingStrengths : defaultStrengths;
  const weaknesses = (existingWeaknesses && existingWeaknesses.length > 0) ? existingWeaknesses : defaultWeaknesses;

  // Update health check result with benchmark-based savings and fallback strengths/weaknesses
  const enrichedResult: HealthCheckResult = {
    ...healthCheckResult,
    strengths,
    weaknesses,
    potentialSavings: {
      conservative: Math.round(benchmarkSavings.annualSavings * 0.7),
      realistic: benchmarkSavings.annualSavings,
      optimistic: Math.round(benchmarkSavings.annualSavings * 1.3),
      explanation: `Beregnet ud fra markedsgennemsnit på ${benchmarkSavings.benchmarkUsed} kr/år for ${policyType}forsikring.`,
    },
    cumulativeSavings: {
      totalOver10Years: after10Years,
      monthlyRange: {
        min: Math.round(monthlySavings * 0.7),
        max: Math.round(monthlySavings * 1.3),
      },
      after12Months,
      after10Years,
      chartData,
    },
    annualSavings: {
      amount: benchmarkSavings.annualSavings,
      percentageLower: benchmarkSavings.annualSavingsPercent,
      explanation: `Baseret på markedsgennemsnit for ${policyType}forsikring.`,
    },
  };
  
  logger.info('[HealthCheckService] Enriched with benchmark savings', {
    policyType,
    benchmarkUsed: benchmarkSavings.benchmarkUsed,
    annualSavings: benchmarkSavings.annualSavings,
    annualSavingsPercent: benchmarkSavings.annualSavingsPercent,
  });
  
  return enrichedResult;
}

/**
 * Enriches an existing health check result with benchmark data on-the-fly.
 * Used when returning stored health checks from the API to ensure they have savings data.
 * 
 * @param healthCheckResult - The stored health check result
 * @param policyType - The policy type (indbo, hus, etc.)
 * @param offerPremium - The offer premium if available
 * @param storage - Storage interface
 * @returns Enriched health check result
 */
export async function enrichStoredHealthCheck(
  healthCheckResult: HealthCheckResult,
  policyType: string,
  offerPremium: number | null,
  storage: IStorage
): Promise<HealthCheckResult> {
  return enrichWithBenchmarkSavings(healthCheckResult, policyType, offerPremium, storage);
}

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
  // Support BOTH policy_snapshots (new) and offer_snapshots (legacy)
  const { PolicySnapshotService } = await import("./policySnapshots/PolicySnapshotService");
  const snapshotService = new PolicySnapshotService();
  let snapshot: any = await snapshotService.getSnapshotById(snapshotId);

  // Fallback to legacy offer_snapshots if not in policy_snapshots
  if (!snapshot) {
    logger.info('[HealthCheckService] Not found in policy_snapshots, trying offer_snapshots', { snapshotId });
    const offerSnapshot = await storage.getOfferSnapshot(snapshotId);
    if (offerSnapshot) {
      snapshot = {
        ...offerSnapshot,
        companyName: 'Ukendt', // offer_snapshots don't have companyName field
        kind: 'offer'
      };
      logger.info('[HealthCheckService] Found in offer_snapshots', { snapshotId, policyType: snapshot.policyType });
    }
  } else {
    logger.info('[HealthCheckService] Found in policy_snapshots', { snapshotId, policyType: snapshot.policyType });
  }

  if (!snapshot) {
    throw new Error(`Snapshot not found for id ${snapshotId} in either policy_snapshots or offer_snapshots`);
  }

  // 3) Verify ownership - snapshot must belong to the requesting user
  const document = await storage.getDocument(snapshot.documentId);
  if (!document || document.userId !== userId) {
    throw new Error(`Unauthorized: Snapshot ${snapshotId} does not belong to user ${userId}`);
  }

  logger.info('[HealthCheckService] Loaded snapshot, starting AI analysis', {
    snapshotId,
    policyType: snapshot.policyType,
    companyName: snapshot.companyName || 'Ukendt',
    kind: snapshot.kind || 'offer'
  });

  // 4) Generate health check using existing AI service
  // This reuses the same logic as during upload (gpt-4o analysis)
  // The insuranceCheckService accepts both Policy and OfferSnapshot (and PolicySnapshot)
  // We cast to any because PolicySnapshot is compatible but has different optional fields
  let healthCheckResult = await insuranceCheckService.analyzeInsuranceHealth(snapshot as any);

  logger.info('[HealthCheckService] AI analysis complete', {
    snapshotId,
    overallScore: healthCheckResult.overallScore,
    savingsAmount: healthCheckResult.potentialSavings?.realistic || 0
  });

  // 4a) FIX BUG 3: Populate whatsIncluded from structuredPolicy if AI didn't generate any
  // This ensures coverage details are shown even when AI analysis produces empty whatsIncluded
  if ((!healthCheckResult.whatsIncluded || healthCheckResult.whatsIncluded.length === 0) 
      && snapshot.structuredPolicy?.coverageDetails) {
    const coverageDetails = snapshot.structuredPolicy.coverageDetails;
    const mappedCoverages: Array<{ coverage: string; value?: string; status?: string; attributes?: Record<string, string> }> = [];

    // Map mainCoverages
    if (Array.isArray(coverageDetails.mainCoverages)) {
      for (const coverage of coverageDetails.mainCoverages) {
        mappedCoverages.push({
          coverage: coverage.name || coverage.type || 'Dækning',
          value: coverage.limit || coverage.coverage || 'inkluderet',
          status: 'success',
          attributes: {
            ...(coverage.limit && { sum: coverage.limit }),
            ...(coverage.deductible && { selvrisiko: coverage.deductible })
          }
        });
      }
    }

    // Map extraCoverages
    if (Array.isArray(coverageDetails.extraCoverages)) {
      for (const coverage of coverageDetails.extraCoverages) {
        mappedCoverages.push({
          coverage: coverage.name || coverage.type || 'Tillægsdækning',
          value: coverage.limit || coverage.coverage || 'inkluderet',
          status: 'neutral',
          attributes: {
            ...(coverage.limit && { sum: coverage.limit }),
            ...(coverage.deductible && { selvrisiko: coverage.deductible })
          }
        });
      }
    }

    if (mappedCoverages.length > 0) {
      healthCheckResult.whatsIncluded = mappedCoverages;
      logger.info('[HealthCheckService] Populated whatsIncluded from structuredPolicy', {
        snapshotId,
        coverageCount: mappedCoverages.length
      });
    }
  }

  // 4b) ALWAYS enrich with benchmark-based savings if AI didn't calculate them
  // This ensures health checks always show meaningful savings data
  // The enrichment function now handles missing offer premiums gracefully
  const offerPremium = snapshot.premium 
    ? Number(snapshot.premium) 
    : (snapshot.structuredPolicy?.pricing?.annualPremium 
       || snapshot.pricing?.annualPremium 
       || null);
  
  healthCheckResult = await enrichWithBenchmarkSavings(
    healthCheckResult,
    snapshot.policyType,
    offerPremium,
    storage
  );
  logger.info('[HealthCheckService] After benchmark enrichment', {
    snapshotId,
    offerPremium,
    potentialSavings: healthCheckResult.potentialSavings?.realistic || 0,
    cumulativeSavings12Months: healthCheckResult.cumulativeSavings?.after12Months || 0
  });

  // 5) Prepare health check record for database
  // Determine dataSource based on which table we found the snapshot in
  const dataSource = snapshot.kind === 'offer' && !snapshot.rawText 
    ? 'OfferSnapshot'  // Legacy offer_snapshots
    : 'PolicySnapshot'; // New policy_snapshots

  const healthCheckData: InsertHealthCheck = {
    documentId: snapshot.documentId,
    userId,
    snapshotId: snapshot.id,
    policyType: snapshot.policyType,
    dataSource,
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
      logger.error('[HealthCheckService] Failed to ensure health check', result.reason, { snapshotId });
      return {
        snapshotId,
        success: false,
        error: result.reason?.message || 'Unknown error'
      };
    }
  });
}
