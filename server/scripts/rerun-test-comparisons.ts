import { db } from "../db";
import { storage } from "../storage";
import { companies } from "@shared/schema";
import { sql } from "drizzle-orm";
import { ComparisonOrchestrator } from "../services/comparisonOrchestrator";
import { writeDebugReport } from "../services/comparisonDebugReportService";

/**
 * RE-RUN TEST COMPARISONS
 * 
 * This script re-runs comparisons for the test companies to verify
 * that all snapshots now have proper pricing data after backfill.
 * 
 * Test Companies:
 * - Types Studio
 * - Alm. Brand
 * - Tryg
 * - Gjensidige
 */

const USER_ID = 'e85ec3b9-e354-4c49-9f68-194830e356af';
const TEST_COMPANIES = ['Types Studio', 'Alm. Brand', 'Tryg', 'Gjensidige'];

async function findCompanyByName(name: string): Promise<{ id: string; name: string } | null> {
  const [company] = await db
    .select()
    .from(companies)
    .where(sql`LOWER(${companies.name}) LIKE LOWER(${'%' + name + '%'})`)
    .limit(1);
  
  return company ? { id: company.id, name: company.name } : null;
}

async function main() {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`RE-RUNNING TEST COMPARISONS`);
  console.log(`${'='.repeat(80)}\n`);
  console.log(`User ID: ${USER_ID}`);
  console.log(`Test Companies: ${TEST_COMPANIES.join(', ')}\n`);

  const orchestrator = new ComparisonOrchestrator(storage);

  for (const companyName of TEST_COMPANIES) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`PROCESSING: ${companyName}`);
    console.log(`${'='.repeat(80)}\n`);

    // Find company
    const company = await findCompanyByName(companyName);
    if (!company) {
      console.error(`❌ Company not found: ${companyName}`);
      continue;
    }

    console.log(`✅ Found company: ${company.name} (${company.id.substring(0, 8)})`);

    try {
      // Run comparison
      console.log(`\n🔄 Running comparison orchestrator...`);
      const result = await orchestrator.runComparison({
        userId: USER_ID,
        offerCompanyId: company.id,
        options: {
          forceRegenerate: true, // Force regeneration to use new pricing data
          enableDebugReport: true,
          skipHealthChecks: false,
        }
      });

      console.log(`\n📊 Comparison Result:`);
      console.log(`  Status: ${result.status}`);
      console.log(`  Comparison ID: ${result.comparisonId?.substring(0, 8) || 'N/A'}`);
      
      if (result.status === 'completed' && result.comparison) {
        const comparison = result.comparison as any;
        console.log(`  Policies: ${comparison.policies?.length || 0}`);
        console.log(`  Overall Savings: ${comparison.overall?.annualSavings || 0} DKK`);
        console.log(`  Pricing Status: ${comparison.meta?.pricingStatus || 'N/A'}`);
      }

      if (result.debugReportPath) {
        console.log(`  📄 Debug Report: ${result.debugReportPath}`);
      }

      if (result.status === 'failed') {
        console.error(`  ❌ Error: ${result.error || 'Unknown error'}`);
      }

      console.log(`\n✅ ${companyName} comparison complete`);
    } catch (error) {
      console.error(`\n❌ Failed to run comparison for ${companyName}:`, error);
    }
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log(`ALL COMPARISONS COMPLETE`);
  console.log(`${'='.repeat(80)}\n`);
  console.log(`Check debug-reports/ directory for detailed reports.`);
}

main().catch((err) => {
  console.error('\n❌ Fatal error:', err);
  process.exit(1);
});
