import { storage } from "../storage";
import { comparisonService } from "../services/comparisonService";
import { PolicyMatchingService } from "../services/policyMatchingService";

async function regenerateAlkaComparison() {
  const userId = 'e86b6430-0013-4fdc-9025-27aefe2d1528';
  const companyId = 'fca6c156-cf00-4e92-b906-80844e3448ae';
  const offerDocumentId = '5e0bfa34-091e-482e-af8f-ebffc002b857';
  
  console.log('[Regenerate Alka] Starting...');
  console.log('[Regenerate Alka] User:', userId);
  console.log('[Regenerate Alka] Company: Alka Forsikring');
  console.log('[Regenerate Alka] Offer Document:', offerDocumentId);
  
  const allPolicies = await storage.getPoliciesByUser(userId);
  const offerPolicies = allPolicies.filter(p => 
    p.documentId === offerDocumentId && !p.isOwnPolicy
  );
  
  console.log('[Regenerate Alka] Found', offerPolicies.length, 'offer policies');
  offerPolicies.forEach(p => {
    console.log(`  - ${p.policyType}: ${p.premium} kr/year`);
  });
  
  const policyMatchingService = new PolicyMatchingService(storage, comparisonService);
  const result = await policyMatchingService.matchAndCompareOfferPolicies(
    userId,
    companyId,
    offerDocumentId,
    offerPolicies
  );
  
  console.log('[Regenerate Alka] Results:');
  console.log('  - Matched comparisons:', result.matchedComparisons.length);
  console.log('  - Unmatched health checks:', result.unmatchedHealthChecks.length);
  
  for (const comp of result.matchedComparisons) {
    const compData = comp.comparisonData as any;
    console.log(`\n[${comp.policyType}] Comparison created:`);
    console.log(`  - ID: ${comp.id}`);
    console.log(`  - Savings: ${comp.savings} kr/year`);
    console.log(`  - Verdict: ${compData?.verdict || 'N/A'}`);
    console.log(`  - Highlights: ${compData?.highlights?.length || 0} (first has icon? ${compData?.highlights?.[0]?.icon ? 'YES ❌' : 'NO ✅'})`);
    console.log(`  - Projection: ${compData?.cumulativeSavings?.length || 0} months (expected: 120)`);
    
    if (compData?.cumulativeSavings?.length === 120) {
      console.log('  ✅ 120-month projection validated!');
    } else {
      console.log('  ❌ Projection length incorrect!');
    }
    
    if (!compData?.highlights?.[0]?.icon) {
      console.log('  ✅ No icon field in highlights!');
    } else {
      console.log('  ❌ Icon field still present!');
    }
  }
  
  console.log('\n[Regenerate Alka] Complete!');
  process.exit(0);
}

regenerateAlkaComparison().catch(error => {
  console.error('[Regenerate Alka] Error:', error);
  process.exit(1);
});
