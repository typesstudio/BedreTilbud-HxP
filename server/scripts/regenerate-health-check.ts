import { storage } from "../storage";
import { insuranceCheckService } from "../services/insuranceCheckService";

const POLICY_ID = process.argv[2];

if (!POLICY_ID) {
  console.error("Usage: tsx server/scripts/regenerate-health-check.ts <policyId>");
  process.exit(1);
}

async function regenerateHealthCheck() {
  try {
    console.log(`\n🔄 Regenerating health check for policy: ${POLICY_ID}\n`);
    
    // Get the policy
    const policy = await storage.getPolicy(POLICY_ID);
    if (!policy) {
      console.error("❌ Policy not found");
      process.exit(1);
    }
    
    console.log(`Policy Type: ${policy.policyType}`);
    console.log(`Premium: ${policy.premium} kr`);
    console.log(`Deductible: ${policy.deductible} kr`);
    console.log(`Current Health Check Status: ${policy.healthCheckStatus}\n`);
    
    // Run health check analysis
    console.log("⏳ Running health check analysis with OpenAI...\n");
    const healthCheckResult = await insuranceCheckService.analyzeInsuranceHealth(policy);
    
    // Update policy with new health check
    await storage.updatePolicy(POLICY_ID, {
      healthCheckStatus: "completed",
      healthCheckPayload: healthCheckResult as any,
      healthCheckSavingsAnnual: healthCheckResult.potentialSavings?.realistic || null,
      healthCheckUpdatedAt: new Date()
    });
    
    console.log("✅ Health check completed!\n");
    console.log("=== RESULTS ===\n");
    console.log(`Overall Score: ${healthCheckResult.overallScore}/10`);
    console.log(`Score Explanation: ${healthCheckResult.scoreExplanation}\n`);
    
    console.log("Potential Savings:");
    console.log(`  Conservative: ${healthCheckResult.potentialSavings?.conservative} kr/year`);
    console.log(`  Realistic: ${healthCheckResult.potentialSavings?.realistic} kr/year`);
    console.log(`  Optimistic: ${healthCheckResult.potentialSavings?.optimistic} kr/year\n`);
    
    console.log("Cumulative Savings:");
    console.log(`  Total Over 10 Years: ${healthCheckResult.cumulativeSavings?.totalOver10Years} kr`);
    console.log(`  Monthly Range: ${healthCheckResult.cumulativeSavings?.monthlyRange?.min}-${healthCheckResult.cumulativeSavings?.monthlyRange?.max} kr`);
    console.log(`  After 12 Months: ${healthCheckResult.cumulativeSavings?.after12Months} kr`);
    console.log(`  After 10 Years: ${healthCheckResult.cumulativeSavings?.after10Years} kr`);
    console.log(`  Chart Data Points: ${healthCheckResult.cumulativeSavings?.chartData?.length || 0}\n`);
    
    console.log(`Highlights (${healthCheckResult.highlights?.length || 0}):`);
    healthCheckResult.highlights?.slice(0, 3).forEach((h: any, idx: number) => {
      console.log(`  ${idx + 1}. ${h.title}: ${h.description}`);
    });
    
    console.log(`\nWhat's Included (${healthCheckResult.whatsIncluded?.length || 0} items):`);
    healthCheckResult.whatsIncluded?.slice(0, 5).forEach((item: any, idx: number) => {
      const selvrisiko = item.attributes?.selvrisiko || 'N/A';
      console.log(`  ${idx + 1}. ${item.coverage} (${item.value}) - Selvrisiko: ${selvrisiko}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

regenerateHealthCheck();
