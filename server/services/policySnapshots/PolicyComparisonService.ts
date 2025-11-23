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
} from "../../types/policyComparison";

export class PolicyComparisonService {
  /**
   * Get policy comparisons for a user.
   * 
   * Groups all policy snapshots by (policyType, coverageAddress) and
   * compares current vs offers with price deltas.
   */
  async getComparisonsForUser(userId: string): Promise<PolicyComparisonRow[]> {
    // 1) Load snapshots + documents for this user
    // Order by createdAt DESC to get latest snapshots first (for deterministic current selection)
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
      return [];
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

    // 3) Build comparison rows
    const result: PolicyComparisonRow[] = [];

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
        // Pick the first one (they're already in creation order from DB)
        current = currentCandidates[0];
      } else if (currentCandidates.length === 1) {
        current = currentCandidates[0];
      }

      // Find offer policies
      const offers = summaries.filter(s => s.kind === "offer");

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

      result.push({
        policyType,
        coverageAddress,
        current,
        offers: offerWithDeltas,
      });
    }

    console.log(`[PolicyComparisonService] Returning ${result.length} comparison rows`);
    
    return result;
  }
}

export const policyComparisonService = new PolicyComparisonService();
