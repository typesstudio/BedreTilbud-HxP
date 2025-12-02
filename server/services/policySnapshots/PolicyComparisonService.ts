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
} from "../../types/policyComparison";
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

    // 3) Build comparison rows with matchStatus
    const comparisons: PolicyComparisonRow[] = [];
    const missingInOffers: PolicyComparisonsWithCoverage['missingInOffers'] = [];

    // Track for aggregated savings
    let totalSavings = 0;
    let totalCurrentPremium = 0;
    let totalOfferPremium = 0;
    let hasPriceData = false;

    for (const [key, summaries] of groups.entries()) {
      if (summaries.length === 0) continue;

      const [policyType, addressPart] = key.split("::");
      const coverageAddress = addressPart || null;

      // Find current policy (should be max 1)
      const currentCandidates = summaries.filter(s => s.kind === "current");
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
      const offers = summaries.filter(s => s.kind === "offer");

      // Determine match status
      let matchStatus: PolicyComparisonRow['matchStatus'];
      if (current && offers.length > 0) {
        matchStatus = 'matched';
      } else if (current && offers.length === 0) {
        matchStatus = 'current_only';
        // Add to missing list
        missingInOffers.push({
          policyType,
          label: getPolicyTypeLabel(policyType),
          currentPremium: current.pricing?.annualPremium ?? null,
        });
      } else {
        matchStatus = 'missing_in_offer';
      }

      // Compute deltas for each offer
      const offerWithDeltas: PolicyOfferWithDelta[] = offers.map(offer => {
        const currentPrem = current?.pricing?.annualPremium ?? null;
        const offerPrem = offer.pricing?.annualPremium ?? null;

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
        };
      });

      // Calculate aggregated savings for matched policies with valid prices
      if (matchStatus === 'matched' && offers.length > 0) {
        const currentPrem = current?.pricing?.annualPremium;
        // Use cheapest offer for aggregated savings
        const cheapestOffer = offerWithDeltas.reduce((min, offer) => {
          const offerPrem = offer.pricing?.annualPremium;
          const minPrem = min?.pricing?.annualPremium;
          if (offerPrem == null) return min;
          if (minPrem == null) return offer;
          return offerPrem < minPrem ? offer : min;
        }, offerWithDeltas[0]);

        const offerPrem = cheapestOffer?.pricing?.annualPremium;

        if (currentPrem != null && offerPrem != null && currentPrem > 0) {
          hasPriceData = true;
          totalCurrentPremium += currentPrem;
          totalOfferPremium += offerPrem;
          totalSavings += (currentPrem - offerPrem);
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

    const totalCurrentCount = comparisons.filter(c => c.current != null).length;
    const matchedCount = comparisons.filter(c => c.matchStatus === 'matched').length;
    const coversAllCurrentPolicies = missingInOffers.length === 0;

    console.log(`[PolicyComparisonService] Returning ${comparisons.length} rows: ` +
      `${matchedCount} matched, ${missingInOffers.length} missing, coversAll=${coversAllCurrentPolicies}`);
    
    return {
      comparisons,
      missingInOffers,
      coversAllCurrentPolicies,
      matchedCount,
      totalCurrentCount,
      aggregatedSavings: {
        hasPrice: hasPriceData,
        totalSavings: hasPriceData ? totalSavings : null,
        totalCurrentPremium: hasPriceData ? totalCurrentPremium : null,
        totalOfferPremium: hasPriceData ? totalOfferPremium : null,
      },
    };
  }
}

export const policyComparisonService = new PolicyComparisonService();
