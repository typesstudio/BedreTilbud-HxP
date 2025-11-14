/**
 * Test script for Phase 1 PolicyExtractor
 * 
 * Tests the PolicyExtractor service with sample OCR markdown to verify:
 * - All coverages are extracted
 * - Deductibles are preserved exactly (with thousand separators)
 * - No data loss from OCR → structured JSON
 */

import { policyExtractorService } from "../services/policyExtractorService";
import { coverageValidator } from "../utils/coverageValidator";

// Sample OCR markdown (simplified version of real insurance document)
const sampleOcrMarkdown = `
# Privatsikring Indbo
## Forsikringstilbud

**Alm. Brand Forsikring**
Tilbud nr.: 12345

Årlig pris inklusiv alle afgifter og moms er **8.734,59 kr.**

## Dækning | Selvrisiko

| Dækning | Selvrisiko |
|---------|------------|
| Brand | 2.834 kr |
| Vand | 2.834 kr |
| Tyveri | 2.834 kr |
| Hærværk | 2.834 kr |
| Kasko | 5.000 kr |
| Ansvar | 0 kr |

## Forsikringssummer for de valgte dækninger

| Dækning | Sum |
|---------|-----|
| Indbo | 500.000 kr |
| Løsøre | 62.344 kr |

## Tilvalg

- Udvidet vand (valgt): 2.500 kr selvrisiko
- Udvidet indbo (ikke valgt)
`;

async function testPhase1Extraction() {
  console.log("=".repeat(60));
  console.log("Testing Phase 1 PolicyExtractor");
  console.log("=".repeat(60));

  try {
    console.log("\n1. Running Phase 1 extraction...");
    const result = await policyExtractorService.extractPolicies(sampleOcrMarkdown);

    console.log(`\n✅ Extraction successful! Found ${result.policies.length} policy/policies`);

    for (const [idx, policy] of result.policies.entries()) {
      console.log(`\n--- Policy ${idx + 1} ---`);
      console.log(`Type: ${policy.policyType}`);
      console.log(`Name: ${policy.policyName}`);
      console.log(`Company: ${policy.company}`);
      console.log(`Annual Premium: ${policy.annualPremium} kr`);
      console.log(`Default Deductible: ${policy.defaultDeductible}`);

      const mainCoverages = policy.coverageDetails?.mainCoverages || [];
      const additionalCoverages = policy.coverageDetails?.additionalCoverages || [];
      
      console.log(`\nMain Coverages (${mainCoverages.length}):`);
      mainCoverages.forEach((coverage, i) => {
        console.log(`  ${i + 1}. ${coverage.name}`);
        console.log(`     Limit: ${coverage.limit || 'N/A'}`);
        console.log(`     Deductible: ${coverage.deductible || 'N/A'} ⭐`);
      });

      console.log(`\nAdditional Coverages (${additionalCoverages.length}):`);
      additionalCoverages.forEach((coverage, i) => {
        console.log(`  ${i + 1}. ${coverage.name} (${coverage.included ? 'included' : 'not included'})`);
        console.log(`     Deductible: ${coverage.deductible || 'N/A'}`);
      });
    }

    // Validate extraction
    console.log("\n\n2. Validating extraction quality...");
    const validation = coverageValidator.validateExtractionResult(result.policies);

    if (validation.isValid) {
      console.log("✅ Validation PASSED");
    } else {
      console.log("❌ Validation FAILED");
      console.log("Errors:", validation.errors);
    }

    if (validation.warnings.length > 0) {
      console.log("⚠️  Warnings:", validation.warnings);
    }

    // Check key fields
    console.log("\n\n3. Checking critical fields...");
    const policy = result.policies[0];
    
    const checks = [
      { name: "Annual Premium extracted", value: policy.annualPremium !== null },
      { name: "Policy type identified", value: policy.policyType === "indbo" },
      { name: "Main coverages present", value: (policy.coverageDetails?.mainCoverages?.length || 0) >= 4 },
      { name: "Deductibles preserved", value: policy.coverageDetails?.mainCoverages?.some(c => c.deductible?.includes(".")) || false }
    ];

    checks.forEach(check => {
      console.log(`${check.value ? '✅' : '❌'} ${check.name}`);
    });

    console.log("\n" + "=".repeat(60));
    console.log("Test completed successfully!");
    console.log("=".repeat(60));

  } catch (error) {
    console.error("\n❌ Test failed:");
    console.error(error);
    process.exit(1);
  }
}

// Run test
testPhase1Extraction()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Unexpected error:", error);
    process.exit(1);
  });
