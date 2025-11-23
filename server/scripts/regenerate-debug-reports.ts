import { db } from "../db";
import { companyComparisons, companies } from "@shared/schema";
import { eq } from "drizzle-orm";
import { generateComparisonDebugReport } from "../services/comparisonDebugReportService";

/**
 * REGENERATE DEBUG REPORTS
 * 
 * Regenerates debug reports for specific comparisons to reflect updated pricing data.
 * This is useful after backfilling pricing to ensure debug reports show current data.
 */

const COMPARISON_IDS = [
  'c8e94c9f-4fca-41d0-beba-f9a4bd283fee', // Tryg
  'b443a0dd-6ebc-4e5c-8390-ceeb8044517d', // Types Studio
  '564420f5-a8ba-4d19-a96c-a9339e0b9b5d', // Gjensidige  
];

async function main() {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`REGENERATE DEBUG REPORTS`);
  console.log(`${'='.repeat(80)}\n`);
  console.log(`Regenerating ${COMPARISON_IDS.length} debug reports...\n`);

  let successCount = 0;
  let failCount = 0;

  for (const comparisonId of COMPARISON_IDS) {
    try {
      console.log(`\n📄 Processing comparison ${comparisonId.substring(0, 8)}...`);

      // Load comparison from database
      const [comparison] = await db
        .select({
          id: companyComparisons.id,
          userId: companyComparisons.userId,
          currentCompany: companyComparisons.currentCompany,
          offerCompany: companyComparisons.offerCompany,
          comparisonJSON: companyComparisons.comparisonJSON,
          status: companyComparisons.status,
          createdAt: companyComparisons.createdAt,
        })
        .from(companyComparisons)
        .where(eq(companyComparisons.id, comparisonId));

      if (!comparison) {
        console.error(`  ❌ Comparison not found: ${comparisonId}`);
        failCount++;
        continue;
      }

      if (comparison.status !== 'completed') {
        console.error(`  ⚠️ Comparison status is ${comparison.status}, skipping`);
        failCount++;
        continue;
      }

      if (!comparison.comparisonJSON) {
        console.error(`  ❌ Comparison has no JSON data`);
        failCount++;
        continue;
      }

      // Get company names
      const [offerCompanyData] = await db
        .select({ name: companies.name })
        .from(companies)
        .where(eq(companies.id, comparison.offerCompany));

      const companyName = offerCompanyData?.name || 'Unknown';
      console.log(`  Company: ${companyName}`);

      // Generate debug report
      const result = await generateComparisonDebugReport(comparisonId, {
        saveToDisk: true,
        logToConsole: false
      });

      console.log(`  ✅ Debug report generated: ${result.filePath || 'N/A'}`);
      successCount++;
    } catch (error) {
      console.error(`  ❌ Failed to regenerate report:`, error);
      failCount++;
    }
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log(`SUMMARY`);
  console.log(`${'='.repeat(80)}`);
  console.log(`  ✅ Success: ${successCount}`);
  console.log(`  ❌ Failed: ${failCount}`);
  console.log(`\nCheck debug-reports/ directory for updated reports.\n`);
}

main().catch((err) => {
  console.error('\n❌ Fatal error:', err);
  process.exit(1);
});
