/**
 * PolicyComparisonService
 * 
 * ARCHITECTURE (Dec 2025 Refactor):
 * ═══════════════════════════════════════════════════════════════════
 * This service provides simple policy comparisons directly from PolicySnapshots.
 * 
 * NO MORE:
 * - health_checks table
 * - company_comparisons magic
 * - Complex AI-driven comparison logic
 * 
 * INSTEAD:
 * - Group snapshots by (policyType, coverageAddress)
 * - Match current vs offers
 * - Compute simple price deltas
 * 
 * Coverage comparisons will come later as a separate layer.
 * ═══════════════════════════════════════════════════════════════════
 */

import { db } from "../../db";
import { policySnapshots, documents } from "../../../shared/schema";
import { eq, desc } from "drizzle-orm";
import type {
  PolicySnapshotSummary,
  PolicyOfferWithDelta,
  PolicyComparisonRow,
  SnapshotPricing,
  PolicyComparisonsWithCoverage,
  ExtraOfferPolicy,
  PolicyMatchStatus,
  SavingsDirection,
} from "../../types/policyComparison";
import { computeSavings } from "../../types/policyComparison";
import { getPolicyTypeLabel } from "../../../shared/apiTypes";

export class PolicyComparisonService {
  /**
   * Get policy comparisons for a user (backward compatible).
   * 
   * Groups all policy snapshots by (policyType, coverageAddress) and
   * compares current vs offers with price deltas.
   */
  async getComparisonsForUser(userId: string): Promise<PolicyComparisonRow[]> {
    const result = await this.getComparisonsWithCoverage(userId);
    return result.comparisons;
  }

  /**
   * Step 4.1: Get policy comparisons with partial coverage info.
   * 
   * Returns:
   * - All comparison rows with matchStatus
   * - List of policies missing from offers
   * - Aggregated savings (only for matched policies with valid prices)
   * - Coverage flags for UI
   */
  async getComparisonsWithCoverage(userId: string): Promise<PolicyComparisonsWithCoverage> {
    // 1) Load snapshots + documents for this user
    const rows = await db
      .select({
        snapshotId: policySnapshots.id,
        documentId: policySnapshots.documentId,
        kind: policySnapshots.kind,
        companyName: policySnapshots.companyName,
        policyType: policySnapshots.policyType,
        coverageAddress: policySnapshots.coverageAddress,
        pricing: policySnapshots.pricing,
        createdAt: policySnapshots.createdAt,
      })
      .from(policySnapshots)
      .innerJoin(documents, eq(policySnapshots.documentId, documents.id))
      .where(eq(documents.userId, userId))
      .orderBy(desc(policySnapshots.createdAt));

    if (rows.length === 0) {
      return {
        comparisons: [],
        missingInOffers: [],
        extraOfferPolicies: [],
        coversAllCurrentPolicies: true,
        matchedCount: 0,
        totalCurrentCount: 0,
        aggregatedSavings: {
          hasPrice: false,
          totalSavings: null,
          totalCurrentPremium: null,
          totalOfferPremium: null,
        },
      };
    }

    console.log(`[PolicyComparisonService] Found ${rows.length} snapshots for user ${userId}`);

    // 2) Group by (policyType, coverageAddress)
    const groups = new Map<string, PolicySnapshotSummary[]>();

    for (const row of rows) {
      const key = `${row.policyType}::${row.coverageAddress ?? ""}`;
      const summary: PolicySnapshotSummary = {
        snapshotId: row.snapshotId,
        documentId: row.documentId,
        kind: row.kind as "current" | "offer",
        companyName: row.companyName,
        policyType: row.policyType,
        coverageAddress: row.coverageAddress,
        pricing: row.pricing as SnapshotPricing | null,
      };
      
      const arr = groups.get(key) ?? [];
      arr.push(summary);
      groups.set(key, arr);
    }

    console.log(`[PolicyComparisonService] Grouped into ${groups.size} policy groups`);

    // Step 4.2 Fix: First, collect all policyTypes that the user has (any address)
    // This prevents duplicate warnings when offers have different addresses
    const userPolicyTypes = new Set<string>();
    const offerPolicyTypes = new Set<string>();
    
    for (const [key, summaries] of Array.from(groups.entries())) {
      const [policyType] = key.split("::");
      for (const s of summaries) {
        if (s.kind === "current") userPolicyTypes.add(policyType);
        if (s.kind === "offer") offerPolicyTypes.add(policyType);
      }
    }

    // 3) Build comparison rows with matchStatus
    const comparisons: PolicyComparisonRow[] = [];
    const missingInOffers: PolicyComparisonsWithCoverage['missingInOffers'] = [];
    const extraOfferPolicies: ExtraOfferPolicy[] = [];
    
    // Track which policyTypes we've already added to missingInOffers/extraOfferPolicies
    const processedMissingTypes = new Set<string>();
    const processedExtraTypes = new Set<string>();

    // Track for aggregated savings
    let totalSavings = 0;
    let totalCurrentPremium = 0;
    let totalOfferPremium = 0;
    let hasPriceData = false;

    for (const [key, summaries] of Array.from(groups.entries())) {
      if (summaries.length === 0) continue;

      const [policyType, addressPart] = key.split("::");
      const coverageAddress = addressPart || null;

      // Find current policy (should be max 1)
      const currentCandidates = summaries.filter((s: PolicySnapshotSummary) => s.kind === "current");
      let current: PolicySnapshotSummary | null = null;
      
      if (currentCandidates.length > 1) {
        console.warn(
          `[PolicyComparisonService] Multiple current snapshots for ${policyType}/${coverageAddress}. ` +
          `Using most recent one.`
        );
        current = currentCandidates[0];
      } else if (currentCandidates.length === 1) {
        current = currentCandidates[0];
      }

      // Find offer policies
      const offers = summaries.filter((s: PolicySnapshotSummary) => s.kind === "offer");

      // Step 4.1/4.2: Determine match status
      // - matched: Both current and offer exist in this group
      // - missing_in_offer: User has policy but offer doesn't include it (no offer for this policyType AT ALL)
      // - missing_in_user: Offer has policy but user doesn't have ANY policy of this type
      let matchStatus: PolicyMatchStatus;
      
      if (current && offers.length > 0) {
        // Direct match in same group
        matchStatus = 'matched';
      } else if (current && offers.length === 0) {
        // User has policy, but check if there's any offer for this policyType (maybe different address)
        if (offerPolicyTypes.has(policyType)) {
          // There is an offer for this policyType, just different address - still counts as matched at type level
          matchStatus = 'matched';
        } else {
          // No offer exists for this policyType at all
          matchStatus = 'missing_in_offer';
          // Only add to missing list once per policyType
          if (!processedMissingTypes.has(policyType)) {
            processedMissingTypes.add(policyType);
            missingInOffers.push({
              policyType,
              label: getPolicyTypeLabel(policyType),
              currentPremium: current.pricing?.annualPremium ?? null,
            });
          }
        }
      } else {
        // No current policy in this group - check if user has ANY current policy of this type
        if (userPolicyTypes.has(policyType)) {
          // User has this policyType somewhere else - this is just an offer with different address
          // Don't mark as missing_in_user, and don't add to extraOfferPolicies
          matchStatus = 'matched';
        } else {
          // Step 4.2: User truly doesn't have this policyType at all
          matchStatus = 'missing_in_user';
          // Only add to extra list once per policyType (use first offer as representative)
          if (!processedExtraTypes.has(policyType) && offers.length > 0) {
            processedExtraTypes.add(policyType);
            const offer = offers[0];
            extraOfferPolicies.push({
              policyType,
              label: getPolicyTypeLabel(policyType),
              offerPolicyId: offer.snapshotId,
              companyName: offer.companyName,
              premiumAmount: offer.pricing?.annualPremium ?? null,
            });
          }
        }
      }

      // Step 4.4: Compute deltas and savings for each offer using computeSavings helper
      const offerWithDeltas: PolicyOfferWithDelta[] = offers.map(offer => {
        const currentPrem = current?.pricing?.annualPremium ?? null;
        const offerPrem = offer.pricing?.annualPremium ?? null;

        // Use the helper for full savings calculation with direction
        const savings = computeSavings(currentPrem, offerPrem);

        let deltaAnnual: number | null = null;
        let savingsAnnual: number | null = null;
        let cheaperThanCurrent: boolean | null = null;

        if (currentPrem != null && offerPrem != null) {
          deltaAnnual = offerPrem - currentPrem;
          savingsAnnual = currentPrem - offerPrem;
          cheaperThanCurrent = offerPrem < currentPrem;
        }

        return {
          ...offer,
          deltaAnnual,
          savingsAnnual,
          cheaperThanCurrent,
          savings,
        };
      });

      // Step 4.1: Calculate aggregated savings ONLY for matched policies with valid prices
      // This ensures missing/unmatched policies do NOT contribute to totals
      if (matchStatus === 'matched' && current && offers.length > 0) {
        const currentPrem = current.pricing?.annualPremium;
        
        // Use cheapest offer for aggregated savings
        const cheapestOffer = offerWithDeltas.reduce((min, offer) => {
          const offerPrem = offer.pricing?.annualPremium;
          const minPrem = min?.pricing?.annualPremium;
          if (offerPrem == null) return min;
          if (minPrem == null) return offer;
          return offerPrem < minPrem ? offer : min;
        }, offerWithDeltas[0]);

        const offerPrem = cheapestOffer?.pricing?.annualPremium;

        // Only accumulate if BOTH premiums are valid positive numbers
        if (
          typeof currentPrem === 'number' && 
          Number.isFinite(currentPrem) && 
          currentPrem > 0 &&
          typeof offerPrem === 'number' && 
          Number.isFinite(offerPrem) && 
          offerPrem >= 0
        ) {
          hasPriceData = true;
          totalCurrentPremium += currentPrem;
          totalOfferPremium += offerPrem;
          totalSavings += (currentPrem - offerPrem);
          console.log(`[PolicyComparisonService] Aggregating ${policyType}: current=${currentPrem}, offer=${offerPrem}, savings=${currentPrem - offerPrem}`);
        } else {
          console.log(`[PolicyComparisonService] Skipping aggregation for ${policyType}: invalid prices (current=${currentPrem}, offer=${offerPrem})`);
        }
      }

      comparisons.push({
        policyType,
        coverageAddress,
        current,
        offers: offerWithDeltas,
        matchStatus,
      });
    }

    // Sort comparisons by policy type for consistent ordering
    comparisons.sort((a, b) => a.policyType.localeCompare(b.policyType));
    missingInOffers.sort((a, b) => a.policyType.localeCompare(b.policyType));
    extraOfferPolicies.sort((a, b) => a.policyType.localeCompare(b.policyType));

    const totalCurrentCount = comparisons.filter(c => c.current != null).length;
    const matchedCount = comparisons.filter(c => c.matchStatus === 'matched').length;
    // Step 4.1/4.2: coversAllCurrentPolicies only considers missing_in_offer
    // Extra policies (missing_in_user) do NOT affect this flag
    const coversAllCurrentPolicies = missingInOffers.length === 0;

    // Step 4.4: Calculate aggregate savings direction
    let savingsDirection: SavingsDirection = null;
    let totalSavingsPercentage: number | null = null;
    let totalMonthlySavings: number | null = null;
    
    if (hasPriceData) {
      totalMonthlySavings = totalSavings / 12;
      totalSavingsPercentage = totalCurrentPremium > 0 ? totalSavings / totalCurrentPremium : null;
      
      if (totalSavings > 0) {
        savingsDirection = "cheaper";
      } else if (totalSavings === 0) {
        savingsDirection = "same_price";
      } else if (totalSavings < 0) {
        savingsDirection = "more_expensive";
      }
    }

    console.log(`[PolicyComparisonService] Returning ${comparisons.length} rows: ` +
      `${matchedCount} matched, ${missingInOffers.length} missing_in_offer, ${extraOfferPolicies.length} extra_in_offer, ` +
      `coversAll=${coversAllCurrentPolicies}, savingsDirection=${savingsDirection}`);
    
    return {
      comparisons,
      missingInOffers,
      extraOfferPolicies,
      coversAllCurrentPolicies,
      matchedCount,
      totalCurrentCount,
      aggregatedSavings: {
        hasPrice: hasPriceData,
        totalSavings: hasPriceData ? totalSavings : null,
        totalSavingsPercentage,
        totalMonthlySavings,
        totalCurrentPremium: hasPriceData ? totalCurrentPremium : null,
        totalOfferPremium: hasPriceData ? totalOfferPremium : null,
        savingsDirection,
      },
    };
  }
}

export const policyComparisonService = new PolicyComparisonService();
