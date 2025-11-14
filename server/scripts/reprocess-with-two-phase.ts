/**
 * Reprocessing Script for Two-Phase Health Check Architecture
 * 
 * Purpose: Backfill existing offer_snapshots with Phase 1 structured policy data.
 * 
 * This script:
 * 1. Finds all offer_snapshots without structuredPolicy
 * 2. Extracts OCR markdown from rawExtractedData
 * 3. Runs Phase 1 PolicyExtractor on OCR markdown
 * 4. Updates offer_snapshots with structured policy
 * 5. Optionally regenerates health checks with Phase 2
 * 
 * Usage:
 *   tsx server/scripts/reprocess-with-two-phase.ts [userId]
 * 
 * Examples:
 *   tsx server/scripts/reprocess-with-two-phase.ts                      # Reprocess all snapshots
 *   tsx server/scripts/reprocess-with-two-phase.ts e85ec3b9-...         # Reprocess specific user
 */

import { db } from "../db";
import { offerSnapshots } from "@shared/schema";
import { eq, isNull } from "drizzle-orm";
import { policyExtractorService } from "../services/policyExtractorService";
import { coverageValidator } from "../utils/coverageValidator";

interface ReprocessingStats {
  total: number;
  processed: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: Array<{ snapshotId: string; error: string }>;
}

async function reprocessOfferSnapshots(userId?: string): Promise<ReprocessingStats> {
  const stats: ReprocessingStats = {
    total: 0,
    processed: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    errors: []
  };

  try {
    console.log("=".repeat(60));
    console.log("Two-Phase Health Check Reprocessing");
    console.log("=".repeat(60));

    // Fetch offer_snapshots without structuredPolicy
    const query = userId 
      ? db.select().from(offerSnapshots).where(eq(offerSnapshots.userId, userId)).where(isNull(offerSnapshots.structuredPolicy))
      : db.select().from(offerSnapshots).where(isNull(offerSnapshots.structuredPolicy));

    const snapshots = await query;
    stats.total = snapshots.length;

    console.log(`\nFound ${stats.total} snapshots to reprocess${userId ? ` for user ${userId}` : ''}`);

    if (stats.total === 0) {
      console.log("✅ All snapshots already have structured policy data!");
      return stats;
    }

    console.log("\nStarting reprocessing...\n");

    for (const snapshot of snapshots) {
      stats.processed++;
      const progress = `[${stats.processed}/${stats.total}]`;
      
      try {
        console.log(`${progress} Processing snapshot ${snapshot.id} (${snapshot.policyType})...`);

        // Extract OCR markdown from rawExtractedData
        const rawData = snapshot.rawExtractedData as any;
        const ocrMarkdown = rawData?.ocrMarkdown;

        if (!ocrMarkdown || typeof ocrMarkdown !== 'string') {
          console.log(`${progress} ⚠️  Skipping: No OCR markdown in rawExtractedData`);
          stats.skipped++;
          continue;
        }

        console.log(`${progress} Found ${ocrMarkdown.length} chars of OCR markdown`);

        // Run Phase 1 PolicyExtractor
        console.log(`${progress} Running Phase 1 extraction...`);
        const extractionResult = await policyExtractorService.extractPolicies(ocrMarkdown);

        if (!extractionResult.policies || extractionResult.policies.length === 0) {
          console.log(`${progress} ⚠️  Skipping: No policies extracted`);
          stats.skipped++;
          continue;
        }

        // Validate extraction
        const validation = coverageValidator.validateExtractionResult(extractionResult.policies);
        if (!validation.isValid) {
          console.log(`${progress} ⚠️  Validation failed: ${validation.errors.join(', ')}`);
          stats.failed++;
          stats.errors.push({
            snapshotId: snapshot.id,
            error: `Validation failed: ${validation.errors.join(', ')}`
          });
          continue;
        }

        // Find matching policy by type
        const matchingPolicy = extractionResult.policies.find(
          p => p.policyType === snapshot.policyType
        );

        if (!matchingPolicy) {
          console.log(`${progress} ⚠️  No matching policy for type ${snapshot.policyType}`);
          stats.skipped++;
          continue;
        }

        // Update snapshot with structured policy
        console.log(`${progress} Updating snapshot with structured policy...`);
        await db.update(offerSnapshots)
          .set({ structuredPolicy: matchingPolicy as any })
          .where(eq(offerSnapshots.id, snapshot.id));

        console.log(`${progress} ✅ Updated successfully`);
        stats.updated++;

      } catch (error) {
        console.error(`${progress} ❌ Error processing snapshot ${snapshot.id}:`, error);
        stats.failed++;
        stats.errors.push({
          snapshotId: snapshot.id,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    // Print summary
    console.log("\n" + "=".repeat(60));
    console.log("Reprocessing Complete");
    console.log("=".repeat(60));
    console.log(`Total snapshots: ${stats.total}`);
    console.log(`Processed: ${stats.processed}`);
    console.log(`✅ Updated: ${stats.updated}`);
    console.log(`⚠️  Skipped: ${stats.skipped}`);
    console.log(`❌ Failed: ${stats.failed}`);

    if (stats.errors.length > 0) {
      console.log("\nErrors:");
      stats.errors.forEach(({ snapshotId, error }) => {
        console.log(`  - ${snapshotId}: ${error}`);
      });
    }

    return stats;

  } catch (error) {
    console.error("\n❌ Fatal error during reprocessing:", error);
    throw error;
  }
}

// Main execution
const userId = process.argv[2];

reprocessOfferSnapshots(userId)
  .then((stats) => {
    console.log("\n✅ Reprocessing completed successfully!");
    process.exit(stats.failed > 0 ? 1 : 0);
  })
  .catch((error) => {
    console.error("\n❌ Reprocessing failed:", error);
    process.exit(1);
  });
