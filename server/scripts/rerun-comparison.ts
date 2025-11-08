import { storage } from "../storage";
import { comparisonService } from "../services/comparisonService";
import { PolicyMatchingService } from "../services/policyMatchingService";

async function rerunComparison() {
  const userId = 'e86b6430-0013-4fdc-9025-27aefe2d1528';
  const companyId = '7bc8a405-83b2-4c7e-81e3-2644232a023e';
  const offerDocumentId = '62c0b9d6-4ab6-4856-99bc-b8d5d28716f0';
  
  console.log('[Rerun Comparison] Starting...');
  console.log('[Rerun Comparison] User:', userId);
  console.log('[Rerun Comparison] Company:', companyId);
  console.log('[Rerun Comparison] Offer Document:', offerDocumentId);
  
  // Get offer policies
  const allPolicies = await storage.getPoliciesByUser(userId);
  const offerPolicies = allPolicies.filter(p => 
    p.documentId === offerDocumentId && !p.isOwnPolicy
  );
  
  console.log('[Rerun Comparison] Found', offerPolicies.length, 'offer policies');
  offerPolicies.forEach(p => {
    console.log(`  - ${p.policyType}: ${p.premium} kr/year, ${p.deductible} kr deductible`);
  });
  
  // Run matching and comparison
  const policyMatchingService = new PolicyMatchingService(storage, comparisonService);
  const result = await policyMatchingService.matchAndCompareOfferPolicies(
    userId,
    companyId,
    offerDocumentId,
    offerPolicies
  );
  
  console.log('[Rerun Comparison] Results:');
  console.log('  - Matched comparisons:', result.matchedComparisons.length);
  console.log('  - Unmatched health checks:', result.unmatchedHealthChecks.length);
  
  // Print comparison details
  for (const comp of result.matchedComparisons) {
    console.log(`\n[${comp.policyType}] Comparison created:`);
    console.log(`  - ID: ${comp.id}`);
    console.log(`  - Savings: ${comp.savings} kr/year`);
    console.log(`  - Verdict: ${(comp.comparisonData as any)?.verdict || 'N/A'}`);
  }
  
  console.log('\n[Rerun Comparison] Testing combined overview...');
  const overview = await policyMatchingService.getCombinedOverview(userId, companyId);
  
  console.log('Combined Overview Results:');
  console.log(`  - Total Savings: ${overview.totalSavings} kr/year`);
  console.log(`  - Total Savings %: ${overview.totalSavingsPercentage}%`);
  console.log(`  - Policy Count: ${overview.policyCount}`);
  console.log(`  - Overall Verdict: ${overview.verdict}`);
  console.log(`  - Highlights Count: ${overview.highlights.length}`);
  console.log('\nQuick Comparison:');
  overview.quickComparison.forEach(q => {
    console.log(`  - ${q.policyType}: ${q.savings} kr/year savings (${q.verdict})`);
  });
  
  console.log('\n[Rerun Comparison] Complete!');
  process.exit(0);
}

rerunComparison().catch(error => {
  console.error('[Rerun Comparison] Error:', error);
  process.exit(1);
});
