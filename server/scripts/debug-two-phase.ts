/**
 * Debug Two-Phase Architecture
 * 
 * Detailed analysis of the two-phase health check for hello@vyork.dk
 */

import { db } from "../db";
import { offerSnapshots } from "@shared/schema";
import { eq } from "drizzle-orm";
import { policyExtractorService } from "../services/policyExtractorService";
import { insuranceCheckService } from "../services/insuranceCheckService";

const USER_ID = "e85ec3b9-e354-4c49-9f68-194830e356af"; // hello@vyork.dk

async function debugTwoPhase() {
  console.log("=".repeat(80));
  console.log("TWO-PHASE ARCHITECTURE DEBUG - hello@vyork.dk");
  console.log("=".repeat(80));

  // Step 1: Get first snapshot
  const snapshots = await db.select()
    .from(offerSnapshots)
    .where(eq(offerSnapshots.userId, USER_ID))
    .limit(1);

  if (snapshots.length === 0) {
    console.log("❌ No snapshots found for user");
    return;
  }

  const snapshot = snapshots[0];
  console.log(`\n📋 Testing Snapshot: ${snapshot.id}`);
  console.log(`   Type: ${snapshot.policyType}`);
  console.log(`   Company: ${snapshot.company}`);
  console.log(`   Premium: ${snapshot.annualPremium} kr`);

  // Step 2: Extract OCR and run Phase 1
  const rawData = snapshot.rawExtractedData as any;
  const ocrMarkdown = rawData?.ocrMarkdown;

  if (!ocrMarkdown) {
    console.log("❌ No OCR markdown found");
    return;
  }

  console.log(`\n📄 OCR Markdown: ${ocrMarkdown.length} chars`);
  console.log(`   Preview: ${ocrMarkdown.substring(0, 150)}...`);

  console.log(`\n🔍 Phase 1: PolicyExtractor`);
  console.log("-".repeat(80));
  const result = await policyExtractorService.extractPolicies(ocrMarkdown);
  
  console.log(`   ✅ Extracted ${result.policies.length} policies`);
  
  const policy = result.policies.find(p => p.policyType === snapshot.policyType) || result.policies[0];
  
  if (!policy) {
    console.log("❌ No matching policy found");
    return;
  }

  console.log(`\n   Policy: ${policy.policyName}`);
  console.log(`   Type: ${policy.policyType}`);
  console.log(`   Premium: ${policy.annualPremium} kr`);
  
  const mainCov = policy.coverageDetails?.mainCoverages || [];
  const addCov = policy.coverageDetails?.additionalCoverages || [];
  
  console.log(`   Main coverages: ${mainCov.length}`);
  console.log(`   Additional coverages: ${addCov.length}`);
  
  console.log(`\n   🔑 Deductibles Check:`);
  mainCov.forEach((c, i) => {
    if (c.deductible) {
      const hasFormat = c.deductible.includes('.');
      console.log(`   ${hasFormat ? '✅' : '⚠️'} ${c.name}: ${c.deductible}`);
    }
  });

  // Step 3: Update snapshot with structured policy (mirror production pipeline)
  console.log(`\n💾 Step 3: Persisting structured policy to database...`);
  console.log("-".repeat(80));
  await db.update(offerSnapshots)
    .set({ structuredPolicy: policy as any })
    .where(eq(offerSnapshots.id, snapshot.id));
  console.log(`   ✅ Saved to offer_snapshots.structuredPolicy`);

  // Step 4: Reload snapshot with structured policy
  const [updatedSnapshot] = await db.select()
    .from(offerSnapshots)
    .where(eq(offerSnapshots.id, snapshot.id));

  // Step 5: Run Phase 2 Health Check with updated snapshot
  console.log(`\n💊 Step 4: Running Phase 2 HealthCheck Analysis`);
  console.log("-".repeat(80));
  console.log(`   (Should see: "[Health Check Phase 2] Using structured policy from Phase 1")`);
  
  const healthCheck = await insuranceCheckService.analyzeInsuranceHealth(updatedSnapshot);
  
  console.log(`   ✅ Health score: ${healthCheck.healthScore}/100`);
  console.log(`   Savings: ${healthCheck.potentialAnnualSavings} kr`);
  console.log(`   Coverage items: ${healthCheck.whatsIncluded.length}`);
  
  console.log(`\n   🎯 Selvrisiko Badges:`);
  const withSelvrisiko = healthCheck.whatsIncluded.filter(item => item.selvrisiko);
  console.log(`   Found: ${withSelvrisiko.length} items with selvrisiko`);
  
  if (withSelvrisiko.length > 0) {
    withSelvrisiko.slice(0, 5).forEach((item, i) => {
      console.log(`   ✅ ${i + 1}. ${item.title}: ${item.selvrisiko} (${item.selvrisikoVariant})`);
    });
  } else {
    console.log(`   ⚠️ WARNING: No selvrisiko data in output!`);
  }

  // Step 6: Verification
  console.log(`\n${"=".repeat(80)}`);
  console.log("VERIFICATION");
  console.log("=".repeat(80));
  
  const checks = [
    ["Phase 1 extraction", result.policies.length > 0],
    ["Deductibles preserved", mainCov.some(c => c.deductible?.includes('.'))],
    ["1:1 mapping", healthCheck.whatsIncluded.length === mainCov.length + addCov.length],
    ["Selvrisiko in output", withSelvrisiko.length > 0]
  ];
  
  checks.forEach(([name, passed]) => {
    console.log(`${passed ? '✅' : '❌'} ${name}`);
  });
  
  const allPassed = checks.every(c => c[1]);
  console.log(`\n${allPassed ? '🎉 TWO-PHASE WORKING PERFECTLY!' : '⚠️ ISSUES DETECTED'}`);
  
  return { snapshot, policy, healthCheck, allPassed };
}

debugTwoPhase()
  .then(() => process.exit(0))
  .catch(err => {
    console.error("Error:", err);
    process.exit(1);
  });
