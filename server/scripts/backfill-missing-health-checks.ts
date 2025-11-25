import { db } from "../db";
import { policySnapshots, healthChecks } from "@shared/schema";
import { eq, isNull, sql } from "drizzle-orm";
import { storage } from "../storage";
import { ensureHealthCheckForSnapshot } from "../services/healthCheckService";

/**
 * BACKFILL MISSING HEALTH CHECKS
 * 
 * This script finds all policy_snapshots that don't have a corresponding health check
 * and generates health checks for them using the existing AI analysis pipeline.
 * 
 * Use cases:
 * - After regenerating comparisons (which creates new snapshots without health checks)
 * - After system updates or data migrations
 * - For snapshots created before health check automation was implemented
 * 
 * Safety:
 * - Idempotent: ensureHealthCheckForSnapshot won't create duplicates
 * - Batched: Processes snapshots in chunks to avoid memory issues
 * - Error handling: Continues processing even if individual snapshots fail
 * 
 * Usage:
 *   npx tsx server/scripts/backfill-missing-health-checks.ts
 * 
 * Optional filters:
 *   npx tsx server/scripts/backfill-missing-health-checks.ts --user-id=<userId>
 *   npx tsx server/scripts/backfill-missing-health-checks.ts --policy-type=indbo
 */

interface SnapshotToProcess {
  id: string;
  userId: string;
  policyType: string;
  companyName: string | null;
  kind: string;
  documentId: string;
}

async function main() {
  console.log('\n' + '='.repeat(80));
  console.log('BACKFILL MISSING HEALTH CHECKS');
  console.log('='.repeat(80) + '\n');

  // Parse command line arguments
  const args = process.argv.slice(2);
  const userIdFilter = args.find(arg => arg.startsWith('--user-id='))?.split('=')[1];
  const policyTypeFilter = args.find(arg => arg.startsWith('--policy-type='))?.split('=')[1];

  console.log('Filters:');
  console.log(`  User ID: ${userIdFilter || 'all users'}`);
  console.log(`  Policy Type: ${policyTypeFilter || 'all types'}`);
  console.log('');

  // Find all policy_snapshots without health checks
  console.log('🔍 Querying database for snapshots without health checks...\n');

  // Build query with LEFT JOIN to find missing health checks
  let query = db
    .select({
      id: policySnapshots.id,
      userId: policySnapshots.userId,
      policyType: policySnapshots.policyType,
      companyName: policySnapshots.companyName,
      kind: policySnapshots.kind,
      documentId: policySnapshots.documentId,
      healthCheckId: healthChecks.id,
    })
    .from(policySnapshots)
    .leftJoin(
      healthChecks,
      eq(healthChecks.snapshotId, policySnapshots.id)
    )
    .$dynamic();

  // Apply filters if specified
  if (userIdFilter) {
    query = query.where(eq(policySnapshots.userId, userIdFilter));
  }
  if (policyTypeFilter) {
    query = query.where(eq(policySnapshots.policyType, policyTypeFilter));
  }

  const rows = await query;

  // Filter to only rows where healthCheckId is null
  const snapshotsWithoutHealthChecks = rows
    .filter(row => row.healthCheckId === null)
    .map(row => ({
      id: row.id,
      userId: row.userId!,
      policyType: row.policyType!,
      companyName: row.companyName,
      kind: row.kind!,
      documentId: row.documentId!,
    })) as SnapshotToProcess[];

  if (snapshotsWithoutHealthChecks.length === 0) {
    console.log('✅ No snapshots found without health checks. All done!');
    return;
  }

  console.log(`📊 Found ${snapshotsWithoutHealthChecks.length} snapshots without health checks:\n`);

  // Group by policy type for summary
  const byPolicyType = snapshotsWithoutHealthChecks.reduce((acc, snap) => {
    acc[snap.policyType] = (acc[snap.policyType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('Breakdown by policy type:');
  Object.entries(byPolicyType).forEach(([type, count]) => {
    console.log(`  ${type}: ${count}`);
  });
  console.log('');

  // Process snapshots
  console.log('🚀 Starting health check generation...\n');
  console.log('─'.repeat(80));

  let successCount = 0;
  let failureCount = 0;
  const failures: Array<{ snapshotId: string; error: string }> = [];

  for (let i = 0; i < snapshotsWithoutHealthChecks.length; i++) {
    const snapshot = snapshotsWithoutHealthChecks[i];
    const progress = `[${i + 1}/${snapshotsWithoutHealthChecks.length}]`;

    try {
      console.log(`${progress} Generating health check for snapshot ${snapshot.id}`);
      console.log(`         Type: ${snapshot.policyType} | Company: ${snapshot.companyName || 'Unknown'} | Kind: ${snapshot.kind}`);

      await ensureHealthCheckForSnapshot(snapshot.id, snapshot.userId, storage);

      successCount++;
      console.log(`         ✅ Success`);
    } catch (error: any) {
      failureCount++;
      failures.push({
        snapshotId: snapshot.id,
        error: error.message || String(error)
      });
      console.error(`         ❌ Failed: ${error.message}`);
    }

    console.log('─'.repeat(80));
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('BACKFILL COMPLETE');
  console.log('='.repeat(80) + '\n');

  console.log(`Total snapshots processed: ${snapshotsWithoutHealthChecks.length}`);
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${failureCount}`);

  if (failures.length > 0) {
    console.log('\nFailed snapshots:');
    failures.forEach(({ snapshotId, error }) => {
      console.log(`  - ${snapshotId}: ${error}`);
    });
  }

  console.log('');

  if (failureCount > 0) {
    console.log('⚠️  Some health checks failed to generate. Review errors above.');
    process.exit(1);
  } else {
    console.log('🎉 All health checks generated successfully!');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('\n❌ Fatal error:', err);
  process.exit(1);
});
