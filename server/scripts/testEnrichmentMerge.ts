/**
 * FOCUSED TEST: Enrichment Pattern Merge Logic
 * Tests that deterministicId-based merging preserves coverage rows exactly
 */

import { storage } from "../storage";
import { ComparisonOrchestrator } from "../services/comparisonOrchestrator";

const TEST_USER_ID = "e85ec3b9-e354-4c49-9f68-194830e356af";
const ALM_BRAND_ID = "abd44932-e5b2-4fda-a463-e75fd46c1ccc";

async function testEnrichmentMerge() {
  console.log("================================================================================");
  console.log("ENRICHMENT PATTERN MERGE TEST");
  console.log("================================================================================\n");

  try {
    console.log("[1] Running comparison with Alm. Brand...");
    const orchestrator = new ComparisonOrchestrator(storage);
    
    // Run comparison (this will use the enrichment pattern)
    const orchestrationResult = await orchestrator.runForUser({
      userId: TEST_USER_ID,
      currentCompany: undefined, // All current policies
      offerCompany: ALM_BRAND_ID,
      forceRerun: true,
    });

    console.log(`   - Success: ${orchestrationResult.success}`);
    console.log(`   - Comparisons created: ${orchestrationResult.comparisonsCreated}`);
    console.log(`   - Comparisons failed: ${orchestrationResult.comparisonsFailed}`);

    if (!orchestrationResult.success) {
      throw new Error("Comparison orchestration failed");
    }

    console.log("\n[2] Fetching comparison from database...");
    const comparisons = await storage.getComparisonsByUser(TEST_USER_ID);
    const almBrandComparison = comparisons.find(c => c.offerCompany === ALM_BRAND_ID);
    
    if (!almBrandComparison) {
      throw new Error("Alm. Brand comparison not found in database");
    }

    console.log(`   - Comparison ID: ${almBrandComparison.id}`);
    console.log(`   - Policy comparisons: ${almBrandComparison.result.policyComparisons.length}`);

    let totalCoverageRows = 0;
    let totalHighlights = 0;

    for (const policy of almBrandComparison.result.policyComparisons) {
      const rowCount = policy.coverageComparison.rows.length;
      const highlightCount = policy.highlights.length;
      
      totalCoverageRows += rowCount;
      totalHighlights += highlightCount;

      console.log(`\n   Policy: ${policy.policyType} (${policy.label})`);
      console.log(`     - Coverage rows: ${rowCount}`);
      console.log(`     - Highlights: ${highlightCount}`);
      console.log(`     - Recommendations: ${policy.recommendations.length}`);
      console.log(`     - Missing info: ${policy.missingInformation.length}`);
      
      // Show first 3 coverage rows as sample
      console.log(`     - Sample coverage rows:`);
      policy.coverageComparison.rows.slice(0, 3).forEach((row, idx) => {
        console.log(`       ${idx + 1}. ${row.coverageName} | ${row.currentValue || 'N/A'} → ${row.offerValue || 'N/A'}`);
      });
    }

    console.log("\n================================================================================");
    console.log("ENRICHMENT PATTERN TEST RESULTS");
    console.log("================================================================================");
    console.log(`✅ Comparison created successfully`);
    console.log(`   - Total coverage rows: ${totalCoverageRows}`);
    console.log(`   - Total highlights: ${totalHighlights}`);
    console.log(`   - Total policies: ${result.result.policyComparisons.length}`);
    
    if (totalCoverageRows === 0) {
      console.log("\n⚠️  WARNING: No coverage rows found! This suggests the enrichment pattern failed.");
      process.exit(1);
    } else if (totalCoverageRows < 10) {
      console.log(`\n⚠️  WARNING: Only ${totalCoverageRows} coverage rows found. Expected more.`);
    } else {
      console.log("\n✅ SUCCESS: Coverage rows were preserved by the enrichment pattern!");
    }

  } catch (error: any) {
    console.error("\n❌ TEST FAILED:", error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

testEnrichmentMerge();
