import { db } from "../db";
import { documents, offerSnapshots, companies } from "@shared/schema";
import { eq, and, sql, isNull, isNotNull, or, ne } from "drizzle-orm";
import { policyPricingService } from "../services/policyPricingService";

/**
 * Backfill Pricing Script
 * 
 * This script backfills pricing data for existing offer snapshots that don't have
 * structured_policy.pricing populated by the PricingAgent.
 * 
 * USAGE:
 *   npx tsx server/scripts/backfillPricing.ts [--force]
 * 
 * FLAGS:
 *   --force    Recompute pricing for ALL snapshots (even those with pricing.pricingStatus === 'ok')
 * 
 * WHAT IT DOES:
 * 1. Finds all offer snapshots without pricing data (or all if --force)
 * 2. For each snapshot:
 *    - Loads OCR text from documents.extraction_stages.stage1_ocr
 *    - Calls PricingAgent to extract pricing
 *    - Updates offer_snapshots.structured_policy.pricing
 * 3. Rate-limits API calls to avoid throttling (2 calls/second)
 * 4. Provides detailed progress logging and error tracking
 */

const RATE_LIMIT_DELAY_MS = 500; // 2 calls per second
const FORCE_MODE = process.argv.includes('--force');

interface SnapshotToProcess {
  id: string;
  documentId: string;
  policyType: string;
  companyId: string | null;
  companyName: string | null;
  structuredPolicy: any;
  createdAt: Date;
}

/**
 * Sleep utility for rate limiting
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Step 1: Find snapshots that need pricing backfill
 */
async function findSnapshotsToProcess(): Promise<SnapshotToProcess[]> {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`STEP 1: FINDING SNAPSHOTS TO PROCESS`);
  console.log(`${'='.repeat(80)}\n`);
  
  console.log(`Mode: ${FORCE_MODE ? '🔄 FORCE (recompute all snapshots)' : '📊 INCREMENTAL (only missing pricing)'}`);

  // Query snapshots with left join to companies
  const results = await db
    .select({
      id: offerSnapshots.id,
      documentId: offerSnapshots.documentId,
      policyType: offerSnapshots.policyType,
      companyId: offerSnapshots.companyId,
      companyName: companies.name,
      structuredPolicy: offerSnapshots.structuredPolicy,
      createdAt: offerSnapshots.createdAt,
    })
    .from(offerSnapshots)
    .leftJoin(companies, eq(offerSnapshots.companyId, companies.id))
    .innerJoin(documents, eq(offerSnapshots.documentId, documents.id))
    .where(
      and(
        eq(documents.documentType, 'offer'), // Only offer snapshots
        isNotNull(offerSnapshots.structuredPolicy) // Must have structuredPolicy
      )
    )
    .orderBy(offerSnapshots.createdAt); // Process oldest first

  console.log(`Found ${results.length} total offer snapshots with structured_policy`);

  // Filter based on pricing status
  const snapshots: SnapshotToProcess[] = [];
  let hasOkPricing = 0;
  let hasPricingButNotOk = 0;
  let noPricing = 0;

  for (const row of results) {
    // Parse structured_policy
    let structured: any;
    try {
      structured = typeof row.structuredPolicy === 'string'
        ? JSON.parse(row.structuredPolicy)
        : row.structuredPolicy;
    } catch (error) {
      console.warn(`⚠️ Snapshot ${row.id.substring(0, 8)} has invalid JSON in structured_policy, skipping`);
      continue;
    }

    // Check pricing status
    const pricing = structured?.pricing;
    const hasPricingOk = pricing?.pricingStatus === 'ok';

    if (hasPricingOk) {
      hasOkPricing++;
      if (!FORCE_MODE) {
        continue; // Skip snapshots that already have OK pricing
      }
    } else if (pricing) {
      hasPricingButNotOk++;
    } else {
      noPricing++;
    }

    // Add to processing queue
    snapshots.push({
      id: row.id,
      documentId: row.documentId,
      policyType: row.policyType,
      companyId: row.companyId,
      companyName: row.companyName,
      structuredPolicy: structured,
      createdAt: row.createdAt,
    });
  }

  console.log(`\n📊 Pricing Status Breakdown:`);
  console.log(`  ✅ Has pricing (status=ok):         ${hasOkPricing}`);
  console.log(`  ⚠️  Has pricing (status!=ok):        ${hasPricingButNotOk}`);
  console.log(`  ❌ No pricing field:                ${noPricing}`);
  console.log(`\n📝 Snapshots to process: ${snapshots.length}`);

  return snapshots;
}

/**
 * Step 2: Load OCR text for a document
 */
async function loadOcrText(documentId: string): Promise<string | null> {
  const [doc] = await db
    .select({
      extractionStages: documents.extractionStages,
    })
    .from(documents)
    .where(eq(documents.id, documentId));

  if (!doc) {
    console.error(`❌ Document ${documentId} not found`);
    return null;
  }

  // Extract stage1_ocr from extraction_stages
  const stages = doc.extractionStages as any;
  if (!stages?.stage1_ocr?.rawOutput) {
    console.error(`❌ Document ${documentId} has no stage1_ocr.rawOutput`);
    return null;
  }

  const ocrText = stages.stage1_ocr.rawOutput;
  console.log(`  📄 Loaded OCR text: ${ocrText.length} chars`);
  return ocrText;
}

/**
 * Step 3: Backfill pricing for a single snapshot
 */
async function backfillSnapshot(snapshot: SnapshotToProcess, ocrText: string): Promise<{
  success: boolean;
  pricingStatus: string;
  annualPremium: number | null;
  error?: string;
}> {
  try {
    console.log(`\n  🔄 Processing ${snapshot.policyType} (${snapshot.id.substring(0, 8)})`);
    console.log(`     Company: ${snapshot.companyName || 'unknown'}`);
    
    // Call PricingAgent
    const pricing = await policyPricingService.extractPricingForPolicy({
      policyType: snapshot.policyType,
      companyName: snapshot.companyName,
      currency: "DKK",
      rawText: ocrText,
    });

    console.log(`     Status: ${pricing.pricingStatus}, Premium: ${pricing.annualPremium}, Confidence: ${pricing.pricingConfidence}%`);

    // Update structured_policy with pricing
    const updatedStructured = {
      ...snapshot.structuredPolicy,
      pricing,
      annualPremium: pricing.annualPremium ?? null, // Mirror for backward compatibility
    };

    // Update database
    await db
      .update(offerSnapshots)
      .set({
        structuredPolicy: updatedStructured,
        updatedAt: new Date(),
      })
      .where(eq(offerSnapshots.id, snapshot.id));

    console.log(`     ✅ Updated database`);

    return {
      success: true,
      pricingStatus: pricing.pricingStatus,
      annualPremium: pricing.annualPremium,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`     ❌ Failed: ${errorMsg}`);
    
    return {
      success: false,
      pricingStatus: 'error',
      annualPremium: null,
      error: errorMsg,
    };
  }
}

/**
 * Main execution
 */
async function main() {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`PRICING BACKFILL SCRIPT`);
  console.log(`${'='.repeat(80)}`);
  console.log(`Started at: ${new Date().toISOString()}`);

  // Step 1: Find snapshots to process
  const snapshots = await findSnapshotsToProcess();

  if (snapshots.length === 0) {
    console.log(`\n✅ No snapshots to process. All done!`);
    return;
  }

  // Step 2: Process each snapshot
  console.log(`\n${'='.repeat(80)}`);
  console.log(`STEP 2: BACKFILLING PRICING`);
  console.log(`${'='.repeat(80)}\n`);

  const stats = {
    total: snapshots.length,
    processed: 0,
    successful: 0,
    failed: 0,
    okStatus: 0,
    unknownStatus: 0,
    missingStatus: 0,
    conflictStatus: 0,
    packageOnlyStatus: 0,
    errors: [] as { snapshotId: string; policyType: string; error: string }[],
  };

  // Group snapshots by document to avoid redundant OCR loads
  const byDocument = new Map<string, SnapshotToProcess[]>();
  for (const snapshot of snapshots) {
    if (!byDocument.has(snapshot.documentId)) {
      byDocument.set(snapshot.documentId, []);
    }
    byDocument.get(snapshot.documentId)!.push(snapshot);
  }

  console.log(`Processing ${byDocument.size} documents with ${snapshots.length} total snapshots\n`);

  for (const [documentId, docSnapshots] of byDocument) {
    console.log(`📄 Document ${documentId.substring(0, 8)} (${docSnapshots.length} snapshots)`);
    
    // Load OCR text once per document
    const ocrText = await loadOcrText(documentId);
    if (!ocrText) {
      console.error(`  ⚠️ Skipping ${docSnapshots.length} snapshots - no OCR text`);
      for (const snapshot of docSnapshots) {
        stats.failed++;
        stats.errors.push({
          snapshotId: snapshot.id,
          policyType: snapshot.policyType,
          error: 'No OCR text available',
        });
      }
      continue;
    }

    // Process each snapshot in this document
    for (const snapshot of docSnapshots) {
      const result = await backfillSnapshot(snapshot, ocrText);
      stats.processed++;

      if (result.success) {
        stats.successful++;
        
        // Track pricing status distribution
        switch (result.pricingStatus) {
          case 'ok':
            stats.okStatus++;
            break;
          case 'unknown':
            stats.unknownStatus++;
            break;
          case 'missing':
            stats.missingStatus++;
            break;
          case 'conflict':
            stats.conflictStatus++;
            break;
          case 'package_only':
            stats.packageOnlyStatus++;
            break;
        }
      } else {
        stats.failed++;
        stats.errors.push({
          snapshotId: snapshot.id,
          policyType: snapshot.policyType,
          error: result.error || 'Unknown error',
        });
      }

      // Rate limiting: wait between API calls
      if (stats.processed < stats.total) {
        await sleep(RATE_LIMIT_DELAY_MS);
      }
    }
  }

  // Step 3: Summary report
  console.log(`\n${'='.repeat(80)}`);
  console.log(`BACKFILL COMPLETE`);
  console.log(`${'='.repeat(80)}\n`);
  
  console.log(`📊 Summary:`);
  console.log(`  Total snapshots:          ${stats.total}`);
  console.log(`  Processed:                ${stats.processed}`);
  console.log(`  ✅ Successful:             ${stats.successful}`);
  console.log(`  ❌ Failed:                 ${stats.failed}`);
  
  console.log(`\n📈 Pricing Status Distribution:`);
  console.log(`  ✅ OK:                     ${stats.okStatus}`);
  console.log(`  ⚠️  Unknown:                ${stats.unknownStatus}`);
  console.log(`  ❌ Missing:                ${stats.missingStatus}`);
  console.log(`  ⚠️  Conflict:               ${stats.conflictStatus}`);
  console.log(`  📦 Package Only:           ${stats.packageOnlyStatus}`);

  if (stats.errors.length > 0) {
    console.log(`\n❌ Errors (${stats.errors.length}):`);
    for (const error of stats.errors.slice(0, 10)) { // Show first 10 errors
      console.log(`  - ${error.snapshotId.substring(0, 8)} (${error.policyType}): ${error.error}`);
    }
    if (stats.errors.length > 10) {
      console.log(`  ... and ${stats.errors.length - 10} more errors`);
    }
  }

  console.log(`\nCompleted at: ${new Date().toISOString()}`);
  console.log(`${'='.repeat(80)}\n`);
}

// Run script
main().catch((err) => {
  console.error('\n❌ Fatal error:', err);
  process.exit(1);
});
