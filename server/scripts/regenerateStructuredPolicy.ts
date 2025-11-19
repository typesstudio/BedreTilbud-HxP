import { db } from "../db";
import { documents, offerSnapshots } from "@shared/schema";
import { eq, and, isNull } from "drizzle-orm";
import { policyExtractorService } from "../services/policyExtractorService";

/**
 * Regenerate structured_policy for snapshots that are missing it
 * 
 * This script:
 * 1. Finds snapshots without structured_policy for a specific user
 * 2. Loads the OCR data from their parent documents
 * 3. Runs PolicyExtractor (Phase 1) to generate structured policy JSON
 * 4. Updates snapshots with the extracted data
 * 
 * Usage:
 *   npx tsx server/scripts/regenerateStructuredPolicy.ts
 */

const USER_ID = 'e85ec3b9-e354-4c49-9f68-194830e356af'; // Test user

interface SnapshotToRegenerate {
  id: string;
  documentId: string;
  policyType: string;
  companyId: string | null;
  documentType: string;
}

async function main() {
  console.log('================================================================================');
  console.log('REGENERATE STRUCTURED_POLICY SCRIPT');
  console.log('================================================================================\n');
  console.log(`User ID: ${USER_ID}\n`);

  try {
    // Step 1: Find snapshots missing structured_policy
    console.log('[Step 1] Finding snapshots missing structured_policy...\n');
    
    const snapshotsWithoutStructured = await db
      .select({
        id: offerSnapshots.id,
        documentId: offerSnapshots.documentId,
        policyType: offerSnapshots.policyType,
        companyId: offerSnapshots.companyId,
        documentType: documents.documentType,
      })
      .from(offerSnapshots)
      .innerJoin(documents, eq(offerSnapshots.documentId, documents.id))
      .where(
        and(
          eq(offerSnapshots.userId, USER_ID),
          isNull(offerSnapshots.structuredPolicy)
        )
      );

    console.log(`Found ${snapshotsWithoutStructured.length} snapshots missing structured_policy:\n`);
    
    if (snapshotsWithoutStructured.length === 0) {
      console.log('✅ All snapshots already have structured_policy! Nothing to do.');
      return;
    }

    // Group by document
    const snapshotsByDocument = new Map<string, SnapshotToRegenerate[]>();
    for (const snapshot of snapshotsWithoutStructured) {
      if (!snapshotsByDocument.has(snapshot.documentId)) {
        snapshotsByDocument.set(snapshot.documentId, []);
      }
      snapshotsByDocument.get(snapshot.documentId)!.push(snapshot);
    }

    console.log(`Grouped into ${snapshotsByDocument.size} documents:\n`);
    for (const [documentId, snapshots] of snapshotsByDocument.entries()) {
      console.log(`  Document ${documentId.substring(0, 8)}:`);
      for (const snapshot of snapshots) {
        console.log(`    - Snapshot ${snapshot.id.substring(0, 8)} (${snapshot.policyType}, ${snapshot.documentType})`);
      }
    }
    console.log();

    // Step 2: Process each document
    let documentsProcessed = 0;
    let snapshotsUpdated = 0;
    let errors: string[] = [];

    for (const [documentId, snapshots] of snapshotsByDocument.entries()) {
      console.log(`[Step 2.${documentsProcessed + 1}] Processing document ${documentId.substring(0, 8)}...`);
      
      try {
        // Load document OCR data
        const [document] = await db
          .select()
          .from(documents)
          .where(eq(documents.id, documentId))
          .limit(1);

        if (!document) {
          throw new Error(`Document ${documentId} not found`);
        }

        // Get OCR markdown
        let ocrMarkdown: string;
        
        // Try extraction_stages first (new pipeline)
        if (document.extractionStages && typeof document.extractionStages === 'object') {
          const stages = document.extractionStages as any;
          ocrMarkdown = stages.stage1_ocr?.rawOutput || null;
        }
        
        // Fallback to legacy ocr_data field
        if (!ocrMarkdown && document.ocrData && typeof document.ocrData === 'object') {
          const ocrData = document.ocrData as any;
          ocrMarkdown = ocrData.markdown || null;
        }

        if (!ocrMarkdown) {
          throw new Error(`No OCR data found for document ${documentId}`);
        }

        console.log(`  OCR data loaded (${ocrMarkdown.length} chars)`);

        // Run PolicyExtractor (Phase 1) to extract structured policies
        console.log(`  Running PolicyExtractor...`);
        const extractionResult = await policyExtractorService.extractPolicies(ocrMarkdown);

        if (!extractionResult.policies || extractionResult.policies.length === 0) {
          throw new Error(`PolicyExtractor returned 0 policies for document ${documentId}`);
        }

        console.log(`  ✅ Extracted ${extractionResult.policies.length} policies`);

        // Match extracted policies to snapshots by policy type
        for (const snapshot of snapshots) {
          const matchingPolicy = extractionResult.policies.find(
            p => p.policyType === snapshot.policyType
          );

          if (!matchingPolicy) {
            console.warn(`  ⚠️  No matching policy found for snapshot ${snapshot.id} (${snapshot.policyType})`);
            errors.push(`No matching ${snapshot.policyType} policy in extraction for snapshot ${snapshot.id}`);
            continue;
          }

          // Update snapshot with structured_policy
          await db
            .update(offerSnapshots)
            .set({
              structuredPolicy: matchingPolicy as any,
              updatedAt: new Date()
            })
            .where(eq(offerSnapshots.id, snapshot.id));

          console.log(`  ✅ Updated snapshot ${snapshot.id.substring(0, 8)} (${snapshot.policyType})`);
          snapshotsUpdated++;
        }

        documentsProcessed++;

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`  ❌ Failed to process document ${documentId}:`, errorMsg);
        errors.push(`Document ${documentId}: ${errorMsg}`);
      }

      console.log(); // Blank line between documents
    }

    // Step 3: Summary
    console.log('================================================================================');
    console.log('SUMMARY');
    console.log('================================================================================\n');
    console.log(`Documents processed: ${documentsProcessed}/${snapshotsByDocument.size}`);
    console.log(`Snapshots updated: ${snapshotsUpdated}/${snapshotsWithoutStructured.length}`);
    
    if (errors.length > 0) {
      console.log(`\nErrors encountered (${errors.length}):`);
      errors.forEach((err, idx) => {
        console.log(`  ${idx + 1}. ${err}`);
      });
    }

    if (snapshotsUpdated === snapshotsWithoutStructured.length) {
      console.log('\n✅ SUCCESS: All snapshots now have structured_policy!');
    } else {
      console.log(`\n⚠️  WARNING: ${snapshotsWithoutStructured.length - snapshotsUpdated} snapshots still missing structured_policy`);
    }

    console.log('\nNext step: Run health check orchestrator to create health checks');
    console.log('================================================================================\n');

  } catch (error) {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
