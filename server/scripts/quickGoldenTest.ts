import { storage } from "../storage";
import { HealthCheckOrchestrator } from "../services/healthCheckOrchestrator";
import { ComparisonOrchestrator } from "../services/comparisonOrchestrator";
import { db } from "../db";
import { companyComparisons, healthChecks } from "@shared/schema";
import { eq } from "drizzle-orm";

/**
 * QUICK GOLDEN TEST - Creates health checks + comparison for Alm. Brand ONLY
 * Verifies AI prompt fixes work end-to-end
 */

const USER_ID = 'e85ec3b9-e354-4c49-9f68-194830e356af';
const CURRENT_DOC_ID = 'c008290f-d4e3-4461-82a2-7c985dcffe3c';
const ALM_BRAND_DOC_ID = 'c93ed2b7-e397-46c3-a2da-32d3f8074166';
const ALM_BRAND_COMPANY_ID = 'abd44932-e5b2-4fda-a463-e75fd46c1ccc';

async function main() {
  console.log('================================================================================');
  console.log('QUICK GOLDEN TEST: Alm. Brand (Health Checks + Comparison)');
  console.log('================================================================================\n');

  try {
    // 1. Clean up
    console.log('[Cleanup] Deleting old comparison...');
    await db.delete(companyComparisons).where(eq(companyComparisons.offerCompany, ALM_BRAND_COMPANY_ID));
    console.log('[Cleanup] Done\n');

    // 2. Create health checks for current document
    console.log('[HealthChecks] Processing current document...');
    const healthCheckOrch = new HealthCheckOrchestrator(storage);
    const currentResult = await healthCheckOrch.runForDocument(CURRENT_DOC_ID, {
      source: 'current_upload',
      userId: USER_ID,
      forceRerun: true
    });
    console.log(`[HealthChecks] Current: ${currentResult.healthChecksCreated} created, ${currentResult.healthChecksFailed} failed\n`);

    // 3. Create health checks for Alm. Brand document
    console.log('[HealthChecks] Processing Alm. Brand offer document...');
    const offerResult = await healthCheckOrch.runForDocument(ALM_BRAND_DOC_ID, {
      source: 'offer_upload',
      userId: USER_ID,
      forceRerun: true
    });
    console.log(`[HealthChecks] Offer: ${offerResult.healthChecksCreated} created, ${offerResult.healthChecksFailed} failed\n`);

    // 4. Run comparison
    console.log('[Comparison] Running comparison...');
    const compOrch = new ComparisonOrchestrator(storage);
    const compResult = await compOrch.runForUser({
      userId: USER_ID,
      offerCompany: ALM_BRAND_COMPANY_ID,
      forceRerun: true
    });
    console.log(`[Comparison] Created: ${compResult.comparisonsCreated}, Failed: ${compResult.comparisonsFailed}\n`);

    // 5. Validate results
    if (compResult.comparisonIds.length > 0) {
      const [comparison] = await db
        .select()
        .from(companyComparisons)
        .where(eq(companyComparisons.id, compResult.comparisonIds[0]));

      if (comparison) {
        const policyComparisons = (comparison.comparisonJSON as any)?.policyComparisons || [];
        
        console.log('================================================================================');
        console.log('VALIDATION RESULTS');
        console.log('================================================================================');
        console.log(`Status: ${comparison.status}`);
        console.log(`Policy Count: ${policyComparisons.length} (expected: 3)`);
        
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
        
        const testPassed = allPassed && policyComparisons.length === 3;
        console.log(`\n${testPassed ? '✅ TEST PASSED - All criteria met!' : '❌ TEST FAILED - Criteria not met'}`);
        console.log('================================================================================\n');
        
        process.exit(testPassed ? 0 : 1);
      }
    }

    console.error('❌ No comparison created');
    process.exit(1);
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    if (error instanceof Error) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
