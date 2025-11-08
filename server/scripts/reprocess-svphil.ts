import { storage } from "../storage";
import { mistralOcrService } from "../services/mistralOcrService";
import { convertToPolicyRecord } from "../utils/policyExtractionParser";
import { PolicyMatchingService } from "../services/policyMatchingService";
import { comparisonService } from "../services/comparisonService";

const USER_ID = 'e86b6430-0013-4fdc-9025-27aefe2d1528';
const COMPANY_ID = '7bc8a405-83b2-4c7e-81e3-2644232a023e';
const OFFER_DOCUMENT_ID = '62c0b9d6-4ab6-4856-99bc-b8d5d28716f0';

async function reprocessSvphil() {
  console.log('[Reprocess Svphil] Starting...');
  console.log(`[Reprocess Svphil] User: ${USER_ID}`);
  console.log(`[Reprocess Svphil] Company: svphil (${COMPANY_ID})`);
  console.log(`[Reprocess Svphil] Document: ${OFFER_DOCUMENT_ID}`);
  
  const document = await storage.getDocument(OFFER_DOCUMENT_ID);
  if (!document) {
    throw new Error('Document not found');
  }
  
  console.log(`[Reprocess Svphil] Document path: ${document.filePath}`);
  
  console.log('\n[Reprocess Svphil] Step 1: Delete existing comparisons via SQL (MUST be first due to FK constraints)...');
  const { db } = await import("../db");
  const { comparisons } = await import("../../shared/schema");
  const { eq, and } = await import("drizzle-orm");
  const existingComparisons = await storage.getComparisonsByUserAndCompany(USER_ID, COMPANY_ID);
  console.log(`[Reprocess Svphil] Found ${existingComparisons.length} existing comparisons to delete`);
  
  await db.delete(comparisons).where(
    and(
      eq(comparisons.userId, USER_ID),
      eq(comparisons.companyId, COMPANY_ID)
    )
  );
  console.log(`  ✅ Deleted ${existingComparisons.length} comparisons`);
  
  console.log('\n[Reprocess Svphil] Step 2: Delete existing offer policies...');
  const existingPolicies = await storage.getPoliciesByUser(USER_ID);
  const offerPolicies = existingPolicies.filter(p => 
    p.documentId === OFFER_DOCUMENT_ID && !p.isOwnPolicy
  );
  
  console.log(`[Reprocess Svphil] Found ${offerPolicies.length} existing offer policies to delete`);
  for (const policy of offerPolicies) {
    await storage.deletePolicy(policy.id);
    console.log(`  ✅ Deleted policy: ${policy.policyType}`);
  }

  
  console.log('\n[Reprocess Svphil] Step 3: Re-run OCR extraction with improved prompt...');
  const extractionResult = await mistralOcrService.extractInsuranceDataFromPDF(document.filePath);
  
  console.log(`[Reprocess Svphil] Extracted ${extractionResult.policies.length} policies`);
  extractionResult.policies.forEach((p, idx) => {
    console.log(`  Policy ${idx + 1}: ${p.type}`);
    console.log(`    - Company: ${p.company}`);
    console.log(`    - Premium: ${p.premium !== null && p.premium !== undefined ? p.premium + ' kr/year' : 'NOT FOUND'}`);
    console.log(`    - Deductible: ${p.deductible !== null && p.deductible !== undefined ? p.deductible + ' kr' : 'NOT FOUND'}`);
    console.log(`    - Page Range: ${p.pageRange}`);
  });
  
  console.log('\n[Reprocess Svphil] Step 4: Create new policies...');
  const newPolicies = [];
  for (const extractedPolicy of extractionResult.policies) {
    const policyRecord = convertToPolicyRecord(
      extractedPolicy,
      OFFER_DOCUMENT_ID,
      USER_ID,
      COMPANY_ID
    );
    
    policyRecord.isOwnPolicy = false;
    
    const savedPolicy = await storage.createPolicy(policyRecord);
    newPolicies.push(savedPolicy);
    console.log(`  ✅ Created policy: ${savedPolicy.policyType} (Premium: ${savedPolicy.premium || 'NULL'})`);
  }
  
  await storage.updateDocument(OFFER_DOCUMENT_ID, {
    extractionStatus: 'completed',
    totalPoliciesExtracted: newPolicies.length,
    ocrData: { policies: extractionResult.policies },
    ocrRawResponse: extractionResult.rawOcrResponse
  });
  
  console.log('\n[Reprocess Svphil] Step 5: Run policy matching and comparisons...');
  const policyMatchingService = new PolicyMatchingService(storage, comparisonService);
  const result = await policyMatchingService.matchAndCompareOfferPolicies(
    USER_ID,
    COMPANY_ID,
    OFFER_DOCUMENT_ID,
    newPolicies
  );
  
  console.log(`[Reprocess Svphil] Created ${result.matchedComparisons.length} comparisons`);
  console.log(`[Reprocess Svphil] Ran ${result.unmatchedHealthChecks.length} health checks`);
  
  console.log('\n[Reprocess Svphil] Step 6: Show results...');
  for (const comparison of result.matchedComparisons) {
    const data = comparison.comparisonData as any;
    console.log(`\n[${comparison.policyType}] Comparison:`);
    console.log(`  - Savings: ${comparison.savings} kr/year`);
    console.log(`  - Verdict: ${data?.verdict || 'N/A'}`);
    console.log(`  - Current Premium: ${data?.pricing?.currentAnnual || 'N/A'} kr/year`);
    console.log(`  - Offer Premium: ${data?.pricing?.offerAnnualIntro || 'N/A'} kr/year`);
  }
  
  console.log('\n[Reprocess Svphil] Testing combined overview...');
  const overview = await policyMatchingService.getCombinedOverview(USER_ID, COMPANY_ID);
  
  console.log('\nCombined Overview:');
  console.log(`  - Total Savings: ${overview.totalSavings} kr/year`);
  console.log(`  - Verdict: ${overview.verdict}`);
  console.log(`  - Policy Count: ${overview.policyCount}`);
  console.log('\nQuick Comparison:');
  overview.quickComparison.forEach((q: any) => {
    console.log(`  - ${q.policyType}: ${q.savings} kr/year (${q.verdict})`);
  });
  
  console.log('\n[Reprocess Svphil] ✅ Complete!');
  process.exit(0);
}

reprocessSvphil().catch(error => {
  console.error('[Reprocess Svphil] ❌ Error:', error);
  process.exit(1);
});
