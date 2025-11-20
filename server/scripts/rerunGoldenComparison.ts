import { db } from "../db";
import { storage } from "../storage";
import { documents, offerSnapshots, healthChecks, companyComparisons, companies } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { HealthCheckOrchestrator } from "../services/healthCheckOrchestrator";
import { ComparisonOrchestrator } from "../services/comparisonOrchestrator";

/**
 * GOLDEN COMPARISON RE-RUN SCRIPT
 * 
 * This script re-runs the full pipeline for the test user to ensure:
 * 1. All 3 policies (hus, indbo, ulykke) have health checks
 * 2. All comparisons have 3 policies with >= 3 coverage rows each
 * 
 * Acceptance Criteria:
 * - Privatsikring vs Alm. Brand: 3 policies, each with >= 3 coverage rows
 * - Privatsikring vs IF Forsikring: 3 policies, each with >= 3 coverage rows
 */

const USER_ID = 'e85ec3b9-e354-4c49-9f68-194830e356af';
const OFFER_COMPANY_NAMES = ['Alm. Brand', 'IF Forsikring'];

interface CompanyInfo {
  id: string;
  name: string;
}

interface DocumentInfo {
  id: string;
  fileName: string;
  companyId: string | null;
  snapshotCount: number;
}

async function findCompanyByName(name: string): Promise<CompanyInfo | null> {
  const [company] = await db
    .select()
    .from(companies)
    .where(sql`LOWER(${companies.name}) LIKE LOWER(${'%' + name + '%'})`)
    .limit(1);
  
  return company ? { id: company.id, name: company.name } : null;
}

async function findLatestDocumentForCompany(
  userId: string,
  documentType: 'current' | 'offer',
  companyId?: string
): Promise<DocumentInfo | null> {
  let query = db
    .select({
      id: documents.id,
      fileName: documents.fileName,
      companyId: documents.companyId,
      snapshotCount: sql<number>`count(${offerSnapshots.id})::int`.as('snapshot_count')
    })
    .from(documents)
    .leftJoin(offerSnapshots, eq(offerSnapshots.documentId, documents.id))
    .where(
      and(
        eq(documents.userId, userId),
        eq(documents.documentType, documentType),
        companyId ? eq(documents.companyId, companyId) : sql`true`
      )
    )
    .groupBy(documents.id, documents.fileName, documents.companyId)
    .having(sql`count(${offerSnapshots.id}) > 0`)
    .orderBy(sql`${documents.createdAt} DESC`)
    .limit(1);

  const [result] = await query;
  return result || null;
}

async function findAllDocumentsForCompany(
  userId: string,
  documentType: 'current' | 'offer',
  companyId?: string
): Promise<DocumentInfo[]> {
  let query = db
    .select({
      id: documents.id,
      fileName: documents.fileName,
      companyId: documents.companyId,
      snapshotCount: sql<number>`count(${offerSnapshots.id})::int`.as('snapshot_count')
    })
    .from(documents)
    .leftJoin(offerSnapshots, eq(offerSnapshots.documentId, documents.id))
    .where(
      and(
        eq(documents.userId, userId),
        eq(documents.documentType, documentType),
        companyId ? eq(documents.companyId, companyId) : sql`true`
      )
    )
    .groupBy(documents.id, documents.fileName, documents.companyId)
    .having(sql`count(${offerSnapshots.id}) > 0`)
    .orderBy(sql`${documents.createdAt} DESC`);

  return await query;
}

async function cleanupPreviousData(
  userId: string,
  offerCompanyId: string,
  currentDocId: string,
  offerDocIds: string[]
): Promise<void> {
  console.log(`\n[Cleanup] Removing old data for user ${userId}, offer company ${offerCompanyId}`);
  console.log(`[Cleanup] Processing ${offerDocIds.length} offer document(s)`);
  
  // 1. Delete company_comparisons for this user + offer company
  const deletedComparisons = await db
    .delete(companyComparisons)
    .where(
      and(
        eq(companyComparisons.userId, userId),
        eq(companyComparisons.offerCompany, offerCompanyId)
      )
    );
  console.log(`[Cleanup] Deleted comparisons: ${deletedComparisons.rowCount || 0}`);

  // 2. Get snapshot IDs for current document
  const currentSnapshots = await db
    .select({ id: offerSnapshots.id })
    .from(offerSnapshots)
    .where(eq(offerSnapshots.documentId, currentDocId));
  
  const allSnapshotIds = [...currentSnapshots.map(s => s.id)];
  
  // 3. Get snapshot IDs for ALL offer documents
  for (const offerDocId of offerDocIds) {
    const offerSnapshotsData = await db
      .select({ id: offerSnapshots.id })
      .from(offerSnapshots)
      .where(eq(offerSnapshots.documentId, offerDocId));
    allSnapshotIds.push(...offerSnapshotsData.map(s => s.id));
  }

  // 4. Delete health_checks for these snapshots
  let deletedHealthCheckCount = 0;
  if (allSnapshotIds.length > 0) {
    for (const snapshotId of allSnapshotIds) {
      const deleted = await db
        .delete(healthChecks)
        .where(eq(healthChecks.snapshotId, snapshotId));
      deletedHealthCheckCount += deleted.rowCount || 0;
    }
    console.log(`[Cleanup] Deleted health checks: ${deletedHealthCheckCount}`);
  }

  console.log(`[Cleanup] Cleanup complete\n`);
}

async function processDocumentForHealthChecks(
  documentId: string,
  userId: string,
  source: 'current_upload' | 'offer_upload'
): Promise<void> {
  const orchestrator = new HealthCheckOrchestrator(storage);
  
  console.log(`\n[HealthChecks] Processing document ${documentId} (${source})`);
  
  const result = await orchestrator.runForDocument(documentId, {
    source,
    userId,
    forceRerun: true
  });

  console.log(`[HealthChecks] Result for ${documentId}:`, {
    success: result.success,
    created: result.healthChecksCreated,
    failed: result.healthChecksFailed,
    errors: result.errors
  });

  if (result.errors.length > 0) {
    console.warn(`[HealthChecks] ⚠️  Errors encountered:`, result.errors);
  }
}

async function runMatcherAndComparison(
  userId: string,
  offerCompanyId: string
): Promise<string | null> {
  const comparisonOrchestrator = new ComparisonOrchestrator(storage);
  
  console.log(`\n[Comparison] Running matcher and comparison for user ${userId}, offer company ${offerCompanyId}`);
  
  const result = await comparisonOrchestrator.runForUser({
    userId,
    offerCompany: offerCompanyId,
    forceRerun: true
  });

  console.log(`[Comparison] Result:`, {
    success: result.success,
    created: result.comparisonsCreated,
    failed: result.comparisonsFailed,
    skipped: result.skipped,
    skipReason: result.skipReason
  });

  if (result.errors.length > 0) {
    console.warn(`[Comparison] ⚠️  Errors:`, result.errors);
  }

  // Find the comparison ID for this offer company
  if (result.comparisonIds.length > 0) {
    // Find the comparison that matches this offer company
    for (const id of result.comparisonIds) {
      const [comparison] = await db
        .select()
        .from(companyComparisons)
        .where(
          and(
            eq(companyComparisons.id, id),
            eq(companyComparisons.offerCompany, offerCompanyId)
          )
        );
      if (comparison) {
        return id;
      }
    }
    // Fallback to first comparison if no match found
    return result.comparisonIds[0];
  }

  return null;
}

async function logCoverageSummary(comparisonId: string, companyName: string): Promise<void> {
  const [comparison] = await db
    .select()
    .from(companyComparisons)
    .where(eq(companyComparisons.id, comparisonId));

  if (!comparison) {
    console.error(`[Summary] ❌ Comparison ${comparisonId} not found`);
    return;
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log(`COVERAGE SUMMARY: ${companyName}`);
  console.log(`${'='.repeat(80)}`);
  console.log(`Comparison ID: ${comparison.id}`);
  console.log(`Status: ${comparison.status}`);
  
  const policyComparisons = (comparison.comparisonJSON as any)?.policyComparisons || [];
  console.log(`Total policies: ${policyComparisons.length}`);
  
  let allPassed = true;
  
  for (const policy of policyComparisons) {
    const coverageRows = policy.coverageComparison?.rows || [];
    const rowCount = coverageRows.length;
    const passed = rowCount >= 3;
    const status = passed ? '✅' : '❌';
    
    console.log(`  ${status} ${policy.policyType.padEnd(8)} - ${rowCount} coverage rows ${passed ? '(PASS)' : '(FAIL: need >= 3)'}`);
    
    if (!passed) {
      allPassed = false;
    }
  }
  
  console.log(`\n${allPassed ? '✅ ALL ACCEPTANCE CRITERIA MET' : '❌ ACCEPTANCE CRITERIA NOT MET'}`);
  console.log(`${'='.repeat(80)}\n`);
  
  return;
}

async function main() {
  console.log('================================================================================');
  console.log('GOLDEN COMPARISON RE-RUN SCRIPT');
  console.log('================================================================================');
  console.log(`User ID: ${USER_ID}`);
  console.log(`Target Companies: ${OFFER_COMPANY_NAMES.join(', ')}`);
  console.log('');

  try {
    // Find current document (Privatsikring)
    const currentDoc = await findLatestDocumentForCompany(USER_ID, 'current');
    if (!currentDoc) {
      throw new Error('No current document found for test user');
    }
    console.log(`[Setup] Current document: ${currentDoc.id} (${currentDoc.fileName}) - ${currentDoc.snapshotCount} snapshots`);

    // Process each offer company
    for (const companyName of OFFER_COMPANY_NAMES) {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`PROCESSING: ${companyName}`);
      console.log(`${'='.repeat(80)}`);

      // 1. Find company
      const company = await findCompanyByName(companyName);
      if (!company) {
        console.error(`❌ Company "${companyName}" not found, skipping`);
        continue;
      }
      console.log(`[Setup] Found company: ${company.id} - ${company.name}`);

      // 2. Find ALL offer documents for this company
      const offerDocs = await findAllDocumentsForCompany(USER_ID, 'offer', company.id);
      if (offerDocs.length === 0) {
        console.error(`❌ No offer documents found for ${companyName}, skipping`);
        continue;
      }
      console.log(`[Setup] Found ${offerDocs.length} offer document(s):`);
      for (const doc of offerDocs) {
        console.log(`  - ${doc.id} (${doc.fileName}) - ${doc.snapshotCount} snapshots`);
      }

      // 3. Clean up previous data
      await cleanupPreviousData(USER_ID, company.id, currentDoc.id, offerDocs.map(d => d.id));

      // 4. Re-run health checks for current document
      await processDocumentForHealthChecks(currentDoc.id, USER_ID, 'current_upload');
      
      // 5. Re-run health checks for ALL offer documents
      for (const offerDoc of offerDocs) {
        await processDocumentForHealthChecks(offerDoc.id, USER_ID, 'offer_upload');
      }

      // 6. Run matcher and comparison
      const comparisonId = await runMatcherAndComparison(USER_ID, company.id);

      // 7. Log coverage summary
      if (comparisonId) {
        await logCoverageSummary(comparisonId, company.name);
      } else {
        console.error(`[Summary] ❌ No comparison ID returned for ${companyName}`);
      }
    }

    console.log('\n================================================================================');
    console.log('SCRIPT COMPLETE');
    console.log('================================================================================\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Script failed:', error);
    if (error instanceof Error) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
