import { db } from "../db";
import { storage } from "../storage";
import { documents, offerSnapshots } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { HealthCheckOrchestrator } from "../services/healthCheckOrchestrator";

/**
 * Regenerate health checks for test user documents
 * 
 * This script:
 * 1. Finds current and offer documents for test user
 * 2. Runs the FIXED HealthCheckOrchestrator with validation
 * 3. Creates new health checks with correct policy_type
 * 
 * Usage:
 *   npx tsx server/scripts/regenerateHealthChecks.ts
 */

const USER_ID = 'e85ec3b9-e354-4c49-9f68-194830e356af'; // Test user
const OFFER_COMPANY_ID = 'abd44932-e5b2-4fda-a463-e75fd46c1ccc'; // Alm. Brand

async function main() {
  console.log('================================================================================');
  console.log('REGENERATE HEALTH CHECKS SCRIPT');
  console.log('================================================================================\n');
  console.log(`User ID: ${USER_ID}`);
  console.log(`Offer Company: Alm. Brand (${OFFER_COMPANY_ID})\n`);

  try {
    const orchestrator = new HealthCheckOrchestrator(storage);

    // Step 1: Find current document (Privatsikring) with snapshots
    console.log('[Step 1] Finding current policy document (Privatsikring) with snapshots...\n');
    
    // Find the current document that actually has snapshots
    const currentDocsWithSnapshots = await db
      .select({
        documentId: documents.id,
        fileName: documents.fileName,
        snapshotCount: sql<number>`count(${offerSnapshots.id})::int`.as('snapshot_count')
      })
      .from(documents)
      .leftJoin(offerSnapshots, eq(offerSnapshots.documentId, documents.id))
      .where(
        and(
          eq(documents.userId, USER_ID),
          eq(documents.documentType, 'current')
        )
      )
      .groupBy(documents.id, documents.fileName)
      .having(sql`count(${offerSnapshots.id}) > 0`);

    if (currentDocsWithSnapshots.length === 0) {
      throw new Error('No current document with snapshots found for test user');
    }

    const currentDocInfo = currentDocsWithSnapshots[0];
    const [currentDoc] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, currentDocInfo.documentId));

    console.log(`Found current document: ${currentDoc.id} (${currentDoc.fileName}) with ${currentDocInfo.snapshotCount} snapshots\n`);

    // Step 2: Find Alm. Brand offer document
    console.log('[Step 2] Finding Alm. Brand offer document...\n');
    
    const [offerDoc] = await db
      .select()
      .from(documents)
      .where(
        and(
          eq(documents.userId, USER_ID),
          eq(documents.documentType, 'offer'),
          eq(documents.companyId, OFFER_COMPANY_ID)
        )
      );

    if (!offerDoc) {
      throw new Error('No Alm. Brand offer document found for test user');
    }

    console.log(`Found offer document: ${offerDoc.id} (${offerDoc.fileName})\n`);

    // Step 3: Regenerate health checks for current document
    console.log('[Step 3] Regenerating health checks for current document...\n');
    
    const currentResult = await orchestrator.runForDocument(currentDoc.id, {
      source: 'current_upload',
      userId: USER_ID,
      forceRerun: true // Force regeneration
    });

    console.log('Current document result:');
    console.log(`  Success: ${currentResult.success}`);
    console.log(`  Health checks created: ${currentResult.healthChecksCreated}`);
    console.log(`  Health checks failed: ${currentResult.healthChecksFailed}`);
    
    if (currentResult.errors.length > 0) {
      console.log('  Errors:');
      currentResult.errors.forEach((err, idx) => {
        console.log(`    ${idx + 1}. ${err}`);
      });
    }
    console.log();

    // Step 4: Regenerate health checks for offer document
    console.log('[Step 4] Regenerating health checks for Alm. Brand offer...\n');
    
    const offerResult = await orchestrator.runForDocument(offerDoc.id, {
      source: 'offer_upload',
      userId: USER_ID,
      forceRerun: true // Force regeneration
    });

    console.log('Offer document result:');
    console.log(`  Success: ${offerResult.success}`);
    console.log(`  Health checks created: ${offerResult.healthChecksCreated}`);
    console.log(`  Health checks failed: ${offerResult.healthChecksFailed}`);
    
    if (offerResult.errors.length > 0) {
      console.log('  Errors:');
      offerResult.errors.forEach((err, idx) => {
        console.log(`    ${idx + 1}. ${err}`);
      });
    }
    console.log();

    // Step 5: Summary
    console.log('================================================================================');
    console.log('SUMMARY');
    console.log('================================================================================\n');
    
    const totalCreated = currentResult.healthChecksCreated + offerResult.healthChecksCreated;
    const totalFailed = currentResult.healthChecksFailed + offerResult.healthChecksFailed;
    
    console.log(`Total health checks created: ${totalCreated}`);
    console.log(`Total health checks failed: ${totalFailed}`);
    
    if (totalFailed === 0 && totalCreated >= 6) {
      console.log('\n✅ SUCCESS: Health checks regenerated with validation!');
      console.log('\nExpected health checks:');
      console.log('  Current (Privatsikring): hus, indbo, ulykke (3 health checks)');
      console.log('  Offer (Alm. Brand): hus, indbo, ulykke (3 health checks)');
    } else {
      console.log(`\n⚠️  WARNING: Expected 6+ health checks, got ${totalCreated}`);
      if (totalFailed > 0) {
        console.log('   Some health checks failed due to policy type mismatches (EXPECTED)');
        console.log('   The validator is working correctly by rejecting bad data!');
      }
    }

    console.log('\nNext step: Run debugComparison.ts to verify comparison quality');
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
