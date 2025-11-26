/**
 * Regenerate Health Checks for Document
 * 
 * PURPOSE: Fix broken health checks that were generated BEFORE the PolicySnapshot fix.
 * These old health checks have empty whatsIncluded arrays because the old code
 * couldn't properly detect PolicySnapshot objects (it was looking for 'extractionVersion'
 * field which doesn't exist on PolicySnapshots).
 * 
 * WHAT THIS SCRIPT DOES:
 * 1. Takes a reference snapshot ID (one that belongs to the target document)
 * 2. Finds ALL policy_snapshots for that document
 * 3. Checks each one's health_check for whatsIncluded count
 * 4. DELETES health_checks where whatsIncluded = 0 (broken)
 * 5. REGENERATES new health_checks using the FIXED PolicySnapshot detection logic
 * 6. Verifies the new health_checks have non-empty whatsIncluded
 * 
 * SAFETY:
 * - Only affects health_checks with whatsIncluded = 0
 * - Preserves working health_checks (like Ulykke with 11 items)
 * - Scoped to single document, not global
 * 
 * USAGE:
 *   npx tsx server/scripts/regenerateHealthChecksForDocument.ts --snapshot-id=<id>
 * 
 * EXAMPLE:
 *   npx tsx server/scripts/regenerateHealthChecksForDocument.ts --snapshot-id=9ba9a43c-0a4a-48d0-8bd6-51bee5aae479
 * 
 * CREATED: 2025-11-26
 * REASON: Fix pre-fix health checks where PolicySnapshot detection failed
 */

import { db } from "../db";
import { policySnapshots, healthChecks } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { storage } from "../storage";

interface RegenerationResult {
  snapshotId: string;
  policyType: string;
  action: 'skipped' | 'regenerated' | 'error';
  oldWhatsIncludedCount: number;
  newWhatsIncludedCount?: number;
  error?: string;
}

async function regenerateHealthChecksForDocument(referenceSnapshotId: string): Promise<void> {
  console.log('='.repeat(70));
  console.log('HEALTH CHECK REGENERATION SCRIPT');
  console.log('='.repeat(70));
  console.log(`Reference Snapshot ID: ${referenceSnapshotId}`);
  console.log(`Started at: ${new Date().toISOString()}`);
  console.log('');

  // 1. Find the document ID from reference snapshot
  const referenceSnapshot = await db
    .select({ documentId: policySnapshots.documentId, userId: policySnapshots.userId })
    .from(policySnapshots)
    .where(eq(policySnapshots.id, referenceSnapshotId))
    .limit(1);

  if (referenceSnapshot.length === 0) {
    console.error(`ERROR: Reference snapshot ${referenceSnapshotId} not found in policy_snapshots`);
    process.exit(1);
  }

  const { documentId, userId } = referenceSnapshot[0];
  console.log(`Document ID: ${documentId}`);
  console.log(`User ID: ${userId}`);
  console.log('');

  // 2. Find ALL snapshots for this document
  const allSnapshots = await db
    .select({
      id: policySnapshots.id,
      policyType: policySnapshots.policyType,
      companyName: policySnapshots.companyName,
    })
    .from(policySnapshots)
    .where(eq(policySnapshots.documentId, documentId));

  console.log(`Found ${allSnapshots.length} snapshots in document:`);
  allSnapshots.forEach(s => console.log(`  - ${s.policyType}: ${s.id}`));
  console.log('');

  // 3. Check health_checks for each snapshot
  console.log('Analyzing existing health checks:');
  console.log('-'.repeat(70));
  
  const results: RegenerationResult[] = [];
  
  for (const snapshot of allSnapshots) {
    const existingHC = await db.execute(sql`
      SELECT 
        id,
        json_array_length(result->'whatsIncluded') as whats_included_count
      FROM health_checks 
      WHERE snapshot_id = ${snapshot.id}
      LIMIT 1
    `);

    const hcRow = existingHC.rows[0] as any;
    const whatsIncludedCount = hcRow ? parseInt(hcRow.whats_included_count || '0') : 0;
    const healthCheckId = hcRow?.id;

    console.log(`  ${snapshot.policyType.padEnd(12)} | HC exists: ${hcRow ? 'YES' : 'NO'} | whatsIncluded: ${whatsIncludedCount}`);

    if (whatsIncludedCount > 0) {
      // Health check is OK - skip
      results.push({
        snapshotId: snapshot.id,
        policyType: snapshot.policyType,
        action: 'skipped',
        oldWhatsIncludedCount: whatsIncludedCount,
      });
      console.log(`           → SKIPPING (already has ${whatsIncludedCount} coverage items)`);
    } else {
      // Health check is broken - needs regeneration
      console.log(`           → NEEDS REGENERATION (whatsIncluded is empty)`);
      
      try {
        // Delete the broken health check if it exists
        if (healthCheckId) {
          console.log(`           → Deleting broken health_check: ${healthCheckId}`);
          await db.delete(healthChecks).where(eq(healthChecks.id, healthCheckId));
        }

        // Import the health check service
        const { ensureHealthCheckForSnapshot } = await import("../services/healthCheckService");
        
        // Regenerate using the FIXED logic
        console.log(`           → Regenerating health check for ${snapshot.policyType}...`);
        const newHC = await ensureHealthCheckForSnapshot(snapshot.id, userId!, storage);
        
        // Check the new whatsIncluded count
        const newResult = newHC.result as any;
        const newCount = Array.isArray(newResult?.whatsIncluded) ? newResult.whatsIncluded.length : 0;
        
        results.push({
          snapshotId: snapshot.id,
          policyType: snapshot.policyType,
          action: 'regenerated',
          oldWhatsIncludedCount: whatsIncludedCount,
          newWhatsIncludedCount: newCount,
        });
        
        console.log(`           → SUCCESS! New whatsIncluded count: ${newCount}`);
        
      } catch (error: any) {
        results.push({
          snapshotId: snapshot.id,
          policyType: snapshot.policyType,
          action: 'error',
          oldWhatsIncludedCount: whatsIncludedCount,
          error: error.message,
        });
        console.log(`           → ERROR: ${error.message}`);
      }
    }
  }

  // 4. Print summary
  console.log('');
  console.log('='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));
  
  const skipped = results.filter(r => r.action === 'skipped');
  const regenerated = results.filter(r => r.action === 'regenerated');
  const errors = results.filter(r => r.action === 'error');

  console.log(`Total snapshots: ${results.length}`);
  console.log(`  Skipped (already OK): ${skipped.length}`);
  console.log(`  Regenerated: ${regenerated.length}`);
  console.log(`  Errors: ${errors.length}`);
  console.log('');

  if (regenerated.length > 0) {
    console.log('Regenerated health checks:');
    regenerated.forEach(r => {
      console.log(`  - ${r.policyType}: ${r.snapshotId}`);
      console.log(`    Old whatsIncluded: ${r.oldWhatsIncludedCount} → New: ${r.newWhatsIncludedCount}`);
    });
  }

  if (errors.length > 0) {
    console.log('');
    console.log('Errors:');
    errors.forEach(r => {
      console.log(`  - ${r.policyType}: ${r.error}`);
    });
  }

  console.log('');
  console.log(`Completed at: ${new Date().toISOString()}`);
  console.log('='.repeat(70));
}

// Parse command line arguments
const args = process.argv.slice(2);
const snapshotIdArg = args.find(a => a.startsWith('--snapshot-id='));

if (!snapshotIdArg) {
  console.error('Usage: npx tsx server/scripts/regenerateHealthChecksForDocument.ts --snapshot-id=<snapshot-id>');
  console.error('');
  console.error('Example:');
  console.error('  npx tsx server/scripts/regenerateHealthChecksForDocument.ts --snapshot-id=9ba9a43c-0a4a-48d0-8bd6-51bee5aae479');
  process.exit(1);
}

const snapshotId = snapshotIdArg.split('=')[1];

regenerateHealthChecksForDocument(snapshotId)
  .then(() => {
    console.log('Script completed successfully.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
