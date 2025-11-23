/**
 * Enrich Policy Snapshots
 * 
 * This script enriches policy_snapshots with pricing and structured policy data.
 * 
 * Usage:
 *   npx tsx server/scripts/enrichPolicySnapshots.ts [--force]
 * 
 * FLAGS:
 *   --force    Re-enrich all snapshots (even those with existing pricing data)
 * 
 * WHAT IT DOES:
 * 1. Finds snapshots that need enrichment (pricing IS NULL, or --force)
 * 2. For each snapshot:
 *    - Calls EnrichmentService.enrichSnapshot(id)
 *    - This runs PricingAgent on snapshot.rawText
 *    - Updates snapshot.pricing with extracted pricing data
 * 3. Rate-limits API calls to avoid throttling
 * 4. Provides detailed progress logging
 */

import { db } from "../db";
import { policySnapshots } from "@shared/schema";
import { isNull } from "drizzle-orm";
import { enrichmentService } from "../services/policySnapshots/EnrichmentService";

const RATE_LIMIT_DELAY_MS = 500; // 2 calls per second
const FORCE_MODE = process.argv.includes('--force');

interface SnapshotToEnrich {
  id: string;
  kind: string;
  companyName: string;
  policyType: string;
  hasRawText: boolean;
}

/**
 * Sleep utility for rate limiting
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Step 1: Find snapshots that need enrichment
 */
async function findSnapshotsToEnrich(): Promise<SnapshotToEnrich[]> {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`STEP 1: FINDING SNAPSHOTS TO ENRICH`);
  console.log(`${'='.repeat(80)}\n`);
  
  if (FORCE_MODE) {
    console.log(`⚡ FORCE MODE: Re-enriching ALL snapshots\n`);
  } else {
    console.log(`📊 Finding snapshots without pricing data...\n`);
  }
  
  // Find snapshots that need enrichment
  const query = FORCE_MODE
    ? db.select().from(policySnapshots)
    : db.select().from(policySnapshots).where(isNull(policySnapshots.pricing));
  
  const snapshots = await query;
  
  console.log(`Found ${snapshots.length} snapshots to enrich\n`);
  
  return snapshots.map(s => ({
    id: s.id,
    kind: s.kind,
    companyName: s.companyName,
    policyType: s.policyType,
    hasRawText: !!s.rawText,
  }));
}

/**
 * Step 2: Enrich each snapshot
 */
async function enrichSnapshots(snapshots: SnapshotToEnrich[]): Promise<void> {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`STEP 2: ENRICHING SNAPSHOTS`);
  console.log(`${'='.repeat(80)}\n`);
  
  let successCount = 0;
  let failureCount = 0;
  let skippedCount = 0;
  
  for (let i = 0; i < snapshots.length; i++) {
    const snapshot = snapshots[i];
    const progress = `[${i + 1}/${snapshots.length}]`;
    
    try {
      console.log(`\n${progress} Enriching snapshot ${snapshot.id}`);
      console.log(`   ${snapshot.kind}/${snapshot.policyType} from ${snapshot.companyName}`);
      
      // Skip if no raw text
      if (!snapshot.hasRawText) {
        console.log(`   ⚠️  No rawText found, skipping...`);
        skippedCount++;
        continue;
      }
      
      // Call enrichment service
      await enrichmentService.enrichSnapshot(snapshot.id);
      
      console.log(`   ✅ Success`);
      successCount++;
      
      // Rate limit
      if (i < snapshots.length - 1) {
        await sleep(RATE_LIMIT_DELAY_MS);
      }
      
    } catch (error) {
      console.error(`   ❌ Failed:`, error);
      failureCount++;
    }
  }
  
  // Final summary
  console.log(`\n${'='.repeat(80)}`);
  console.log(`ENRICHMENT SUMMARY`);
  console.log(`${'='.repeat(80)}`);
  console.log(`Total snapshots: ${snapshots.length}`);
  console.log(`Successfully enriched: ${successCount}`);
  console.log(`Failed: ${failureCount}`);
  console.log(`Skipped (no rawText): ${skippedCount}`);
  console.log(`${'='.repeat(80)}\n`);
}

/**
 * Main execution
 */
async function main() {
  console.log(`${'='.repeat(80)}`);
  console.log(`ENRICH POLICY SNAPSHOTS`);
  console.log(`${'='.repeat(80)}`);
  
  try {
    // Step 1: Find snapshots
    const snapshots = await findSnapshotsToEnrich();
    
    if (snapshots.length === 0) {
      console.log(`✅ No snapshots need enrichment!`);
      return;
    }
    
    // Step 2: Enrich them
    await enrichSnapshots(snapshots);
    
    console.log(`✅ Enrichment process completed`);
    
  } catch (error) {
    console.error(`❌ Enrichment process failed:`, error);
    process.exit(1);
  }
}

// Run
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
