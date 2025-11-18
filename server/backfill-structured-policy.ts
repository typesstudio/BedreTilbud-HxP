#!/usr/bin/env tsx
import { db } from "./db";
import { documents, offerSnapshots } from "@shared/schema";
import { eq, isNull } from "drizzle-orm";
import { policyExtractorService } from "./services/policyExtractorService";

const BATCH_SIZE = 10;
const DRY_RUN = process.env.DRY_RUN === "true";

async function backfillStructuredPolicies() {
  console.log("=".repeat(60));
  console.log("BACKFILL SCRIPT: Structured Policy Data");
  console.log("=".repeat(60));
  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}`);
  console.log(`Batch Size: ${BATCH_SIZE}`);
  console.log();

  try {
    // Step 1: Find all offer_snapshots with NULL structuredPolicy
    console.log("[1/5] Finding offer_snapshots with NULL structuredPolicy...");
    const snapshotsToBackfill = await db
      .select()
      .from(offerSnapshots)
      .where(isNull(offerSnapshots.structuredPolicy));

    console.log(`Found ${snapshotsToBackfill.length} snapshots to backfill`);

    if (snapshotsToBackfill.length === 0) {
      console.log("✅ No snapshots need backfilling");
      return;
    }

    // Group snapshots by documentId to minimize document lookups
    const snapshotsByDocument = snapshotsToBackfill.reduce((acc, snapshot) => {
      if (!acc[snapshot.documentId]) {
        acc[snapshot.documentId] = [];
      }
      acc[snapshot.documentId].push(snapshot);
      return acc;
    }, {} as Record<string, typeof snapshotsToBackfill>);

    const documentIds = Object.keys(snapshotsByDocument);
    console.log(`Grouped into ${documentIds.length} unique documents`);

    // Step 2: Process each document
    console.log("\n[2/5] Processing documents...");
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (let i = 0; i < documentIds.length; i++) {
      const documentId = documentIds[i];
      const snapshots = snapshotsByDocument[documentId];

      console.log(`\n[${i + 1}/${documentIds.length}] Processing document ${documentId}`);
      console.log(`  - ${snapshots.length} snapshots to update`);

      try {
        // Fetch document with extraction data
        const [document] = await db
          .select()
          .from(documents)
          .where(eq(documents.id, documentId))
          .limit(1);

        if (!document) {
          console.log(`  ⚠️  Document not found, skipping`);
          skipCount += snapshots.length;
          continue;
        }

        // Try to get OCR markdown from extraction_stages
        let ocrMarkdown: string | null = null;

        if (document.extractionStages) {
          const stages = document.extractionStages as any;
          if (stages.stage1_ocr?.rawOutput) {
            ocrMarkdown = stages.stage1_ocr.rawOutput;
            console.log(`  ✓ Found OCR markdown in extraction_stages (${ocrMarkdown!.length} chars)`);
          }
        }

        // Fallback: Try ocrRawResponse
        if (!ocrMarkdown && document.ocrRawResponse) {
          const ocrResponse = document.ocrRawResponse as any;
          if (ocrResponse.text) {
            ocrMarkdown = ocrResponse.text;
            console.log(`  ✓ Found OCR markdown in ocrRawResponse (${ocrMarkdown!.length} chars)`);
          }
        }

        if (!ocrMarkdown) {
          console.log(`  ⚠️  No OCR markdown found, skipping`);
          skipCount += snapshots.length;
          continue;
        }

        // Step 3: Run PolicyExtractor to get structured policies
        console.log(`  → Running PolicyExtractor...`);
        const extractionResult = await policyExtractorService.extractPolicies(ocrMarkdown);
        const structuredPolicies = extractionResult.policies;

        console.log(`  ✓ Extracted ${structuredPolicies.length} structured policies`);

        // Step 4: Match and update snapshots
        for (const snapshot of snapshots) {
          // Try to match by policyType
          const matchingPolicy = structuredPolicies.find(
            (p: any) => p.policyType?.toLowerCase() === snapshot.policyType?.toLowerCase()
          );

          if (!matchingPolicy) {
            console.log(`  ⚠️  No matching policy found for snapshot ${snapshot.id} (${snapshot.policyType})`);
            skipCount++;
            continue;
          }

          if (DRY_RUN) {
            console.log(`  [DRY RUN] Would update snapshot ${snapshot.id} with structured policy`);
            successCount++;
          } else {
            // Update the snapshot
            await db
              .update(offerSnapshots)
              .set({
                structuredPolicy: matchingPolicy as any,
                updatedAt: new Date()
              })
              .where(eq(offerSnapshots.id, snapshot.id));

            console.log(`  ✓ Updated snapshot ${snapshot.id} with structured policy`);
            successCount++;
          }
        }
      } catch (error) {
        console.error(`  ❌ Error processing document ${documentId}:`, error);
        errorCount += snapshots.length;
      }

      // Rate limiting: wait between batches
      if ((i + 1) % BATCH_SIZE === 0 && i + 1 < documentIds.length) {
        console.log(`\n⏸  Processed ${i + 1} documents, pausing for 2 seconds...`);
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    // Step 5: Summary
    console.log("\n" + "=".repeat(60));
    console.log("BACKFILL SUMMARY");
    console.log("=".repeat(60));
    console.log(`Total snapshots: ${snapshotsToBackfill.length}`);
    console.log(`✅ Successfully updated: ${successCount}`);
    console.log(`⚠️  Skipped: ${skipCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log();

    if (DRY_RUN) {
      console.log("ℹ️  This was a DRY RUN. No changes were made to the database.");
      console.log("   Run with DRY_RUN=false to apply changes.");
    } else {
      console.log("✅ Backfill complete!");
    }

    console.log("=".repeat(60));
  } catch (error) {
    console.error("\n❌ Backfill failed:", error);
    process.exit(1);
  }
}

// Run the backfill
backfillStructuredPolicies()
  .then(() => {
    console.log("\n👋 Backfill script finished");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Fatal error:", error);
    process.exit(1);
  });
