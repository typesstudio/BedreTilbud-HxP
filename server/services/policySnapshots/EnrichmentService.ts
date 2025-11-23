/**
 * EnrichmentService
 * 
 * ARCHITECTURE (Dec 2025 Refactor):
 * ═══════════════════════════════════════════════════════════════════
 * This service enriches PolicySnapshots with optional structured data:
 * 
 * 1. structuredPolicy - from stage3 extraction (coverages, limits, deductibles)
 * 2. pricing - from PricingAgent (annual premium, components, status)
 * 
 * IMPORTANT: These enrichments are OPTIONAL. The system works without them.
 * The comparison and health check services can fall back to raw text if needed.
 * ═══════════════════════════════════════════════════════════════════
 */

import { policySnapshotService } from "./PolicySnapshotService";
import type { PolicySnapshot } from "../../../shared/schema";

export class EnrichmentService {
  /**
   * Main entry point: Enrich a single PolicySnapshot with all available enrichments.
   * 
   * Currently enriches with:
   * - Pricing data (from PricingAgent)
   * - TODO: Structured policy data (from PolicyExtractor)
   */
  async enrichSnapshot(snapshotId: string): Promise<void> {
    console.log(`[EnrichmentService] Enriching snapshot ${snapshotId}...`);
    
    // Run enrichments
    await this.enrichWithPricing(snapshotId);
    // await this.enrichWithStructuredPolicy(snapshotId); // TODO: Implement when needed
    
    console.log(`[EnrichmentService] ✓ Completed enrichment for snapshot ${snapshotId}`);
  }

  /**
   * Enrich a PolicySnapshot with pricing information.
   * 
   * This calls PricingAgent on the snapshot's rawText (not the full document).
   * The result is stored in snapshot.pricing.
   */
  async enrichWithPricing(snapshotId: string): Promise<void> {
    try {
      console.log(`[EnrichmentService] Enriching snapshot ${snapshotId} with pricing...`);
      
      // Get the snapshot by ID
      const snapshot = await policySnapshotService.getSnapshotById(snapshotId);
      if (!snapshot) {
        console.error(`[EnrichmentService] Snapshot ${snapshotId} not found`);
        return;
      }
      
      // Call PricingAgent on this snapshot's raw text
      const { policyPricingService } = await import("../policyPricingService");
      
      const pricingResult = await policyPricingService.extractPricingForPolicy({
        policyType: snapshot.policyType,
        companyName: snapshot.companyName,
        currency: "DKK",
        rawText: snapshot.rawText, // Use segment text, not full document
      });
      
      // Convert to simplified format for PolicySnapshot
      const simplifiedPricing = {
        status: this.mapPricingStatus(pricingResult.pricingStatus),
        annualPremium: pricingResult.annualPremium,
        currency: "DKK" as const,
        confidence: pricingResult.pricingConfidence,
        components: pricingResult.rawPrices.map(p => ({
          label: p.label,
          amount: p.amount,
        })),
        // Preserve full PricingAgent output for debugging
        _fullPricingData: pricingResult,
      };
      
      // Update the snapshot
      await policySnapshotService.updateSnapshotEnrichment(snapshotId, {
        pricing: simplifiedPricing,
      });
      
      console.log(
        `[EnrichmentService] ✓ Enriched ${snapshotId} with pricing: ` +
        `status=${simplifiedPricing.status}, premium=${simplifiedPricing.annualPremium}`
      );
    } catch (error) {
      console.error(`[EnrichmentService] Failed to enrich snapshot ${snapshotId} with pricing:`, error);
      // Don't throw - enrichment failures shouldn't break the pipeline
    }
  }

  /**
   * Enrich a PolicySnapshot with structured policy data.
   * 
   * This would call the stage3 extraction logic on the snapshot's rawText.
   * For now, this is a placeholder - we can implement it when needed.
   */
  async enrichWithStructuredPolicy(snapshotId: string): Promise<void> {
    try {
      console.log(`[EnrichmentService] Enriching snapshot ${snapshotId} with structured policy...`);
      
      // TODO: Implement when needed
      // This would call the PolicyExtractor or similar extraction logic
      // on snapshot.rawText to get coverages, limits, deductibles
      
      console.log(`[EnrichmentService] ⚠️ Structured policy enrichment not yet implemented`);
    } catch (error) {
      console.error(`[EnrichmentService] Failed to enrich snapshot ${snapshotId} with structured policy:`, error);
    }
  }

  /**
   * Enrich multiple snapshots in parallel.
   */
  async enrichSnapshots(snapshotIds: string[]): Promise<void> {
    console.log(`[EnrichmentService] Enriching ${snapshotIds.length} snapshots...`);
    
    const enrichmentPromises = snapshotIds.map(async (id) => {
      await this.enrichWithPricing(id);
      await this.enrichWithStructuredPolicy(id);
    });
    
    await Promise.allSettled(enrichmentPromises);
    
    console.log(`[EnrichmentService] Completed enrichment for ${snapshotIds.length} snapshots`);
  }

  /**
   * Map PricingAgent status to simplified status for PolicySnapshot.
   */
  private mapPricingStatus(status: string): "exact" | "components_only" | "missing" {
    switch (status) {
      case "ok":
        return "exact";
      case "package_only":
        return "components_only";
      case "unknown":
      case "conflict":
      default:
        return "missing";
    }
  }
}

export const enrichmentService = new EnrichmentService();
