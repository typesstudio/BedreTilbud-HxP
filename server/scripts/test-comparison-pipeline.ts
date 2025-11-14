/**
 * End-to-End Comparison Pipeline Test
 * 
 * Tests Phase 3 (Matching) → Phase 4 (Comparison) for a real user
 * 
 * Usage:
 *   tsx server/scripts/test-comparison-pipeline.ts [email]
 * 
 * Example:
 *   tsx server/scripts/test-comparison-pipeline.ts hello@vyork.dk
 */

import { storage } from "../storage";
import { ComparisonOrchestrator } from "../services/comparisonOrchestrator";
import { comparisonResultSchema } from "@shared/schema";

const TEST_USER_EMAIL = process.argv[2] || "hello@vyork.dk";

interface TestResult {
  success: boolean;
  stage: string;
  message: string;
  data?: any;
}

const results: TestResult[] = [];

function logResult(stage: string, success: boolean, message: string, data?: any) {
  results.push({ success, stage, message, data });
  const icon = success ? "✅" : "❌";
  console.log(`${icon} [${stage}] ${message}`);
  if (data) {
    console.log(`   Data:`, JSON.stringify(data, null, 2));
  }
}

async function main() {
  console.log(`\n🧪 Starting End-to-End Comparison Pipeline Test`);
  console.log(`📧 Test user: ${TEST_USER_EMAIL}\n`);

  try {
    // ========================================
    // STAGE 1: Load User
    // ========================================
    console.log(`\n━━━ STAGE 1: Load User ━━━`);
    const user = await storage.getUserByEmail(TEST_USER_EMAIL);
    
    if (!user) {
      logResult("Load User", false, `User ${TEST_USER_EMAIL} not found`);
      process.exit(1);
    }
    
    logResult("Load User", true, `Found user ${user.id} (${user.email})`);

    // ========================================
    // STAGE 2: Load Current Policies
    // ========================================
    console.log(`\n━━━ STAGE 2: Load Current Policies ━━━`);
    const currentDocuments = await storage.getUserDocuments(user.id, "current");
    
    if (currentDocuments.length === 0) {
      logResult("Load Current", false, "No current documents found");
      process.exit(1);
    }
    
    logResult("Load Current", true, `Found ${currentDocuments.length} current documents`);
    
    const currentSnapshots: any[] = [];
    for (const doc of currentDocuments) {
      const snapshots = await storage.getOfferSnapshotsByDocument(doc.id);
      currentSnapshots.push(...snapshots);
    }
    
    logResult("Load Current Snapshots", true, `Found ${currentSnapshots.length} current policy snapshots`);
    
    // Check health checks exist
    let currentWithHealthChecks = 0;
    for (const doc of currentDocuments) {
      const healthChecks = await storage.getHealthChecksByDocument(doc.id);
      currentWithHealthChecks += healthChecks.length;
    }
    
    logResult("Current Health Checks", currentWithHealthChecks > 0, 
      `Found ${currentWithHealthChecks} health checks for current policies`);

    // ========================================
    // STAGE 3: Load Offer Policies
    // ========================================
    console.log(`\n━━━ STAGE 3: Load Offer Policies ━━━`);
    const offerDocuments = await storage.getUserDocuments(user.id, "offer");
    
    if (offerDocuments.length === 0) {
      logResult("Load Offers", false, "No offer documents found");
      process.exit(1);
    }
    
    logResult("Load Offers", true, `Found ${offerDocuments.length} offer documents`);
    
    const offerSnapshots: any[] = [];
    for (const doc of offerDocuments) {
      const snapshots = await storage.getOfferSnapshotsByDocument(doc.id);
      offerSnapshots.push(...snapshots);
    }
    
    logResult("Load Offer Snapshots", true, `Found ${offerSnapshots.length} offer policy snapshots`);
    
    // Check health checks exist
    let offerWithHealthChecks = 0;
    for (const doc of offerDocuments) {
      const healthChecks = await storage.getHealthChecksByDocument(doc.id);
      offerWithHealthChecks += healthChecks.length;
    }
    
    logResult("Offer Health Checks", offerWithHealthChecks > 0, 
      `Found ${offerWithHealthChecks} health checks for offer policies`);

    // ========================================
    // STAGE 4: Run Comparison Orchestrator
    // ========================================
    console.log(`\n━━━ STAGE 4: Run Comparison Orchestrator ━━━`);
    const orchestrator = new ComparisonOrchestrator(storage);
    
    const orchestrationResult = await orchestrator.runForUser({
      userId: user.id,
      forceRerun: true // Always regenerate for testing
    });
    
    if (!orchestrationResult.success) {
      logResult("Orchestration", false, 
        `Orchestration failed: ${orchestrationResult.errors.join(', ')}`,
        orchestrationResult);
      process.exit(1);
    }
    
    if (orchestrationResult.skipped) {
      logResult("Orchestration", false, 
        `Orchestration skipped: ${orchestrationResult.skipReason}`,
        orchestrationResult);
      process.exit(1);
    }
    
    logResult("Orchestration", true, 
      `Created ${orchestrationResult.comparisonsCreated} comparisons`,
      {
        created: orchestrationResult.comparisonsCreated,
        failed: orchestrationResult.comparisonsFailed,
        comparisonIds: orchestrationResult.comparisonIds
      });

    // ========================================
    // STAGE 5: Validate Comparison Results
    // ========================================
    console.log(`\n━━━ STAGE 5: Validate Comparison Results ━━━`);
    
    if (orchestrationResult.comparisonIds.length === 0) {
      logResult("Validation", false, "No comparison IDs returned");
      process.exit(1);
    }
    
    // Load and validate each comparison
    for (const comparisonId of orchestrationResult.comparisonIds) {
      const comparison = await storage.getCompanyComparison(comparisonId);
      
      if (!comparison) {
        logResult("Load Comparison", false, `Comparison ${comparisonId} not found`);
        continue;
      }
      
      logResult("Load Comparison", true, 
        `Loaded comparison ${comparison.id} (${comparison.currentCompany} → ${comparison.offerCompany})`);
      
      // Verify status
      if (comparison.status !== 'completed') {
        logResult("Status Check", false, 
          `Comparison status is ${comparison.status}, expected 'completed'`,
          { errorMessage: comparison.errorMessage });
        continue;
      }
      
      logResult("Status Check", true, `Comparison status: completed`);
      
      // Parse and validate comparisonJSON
      const comparisonJSON = typeof comparison.comparisonJSON === 'string'
        ? JSON.parse(comparison.comparisonJSON)
        : comparison.comparisonJSON;
      
      if (!comparisonJSON) {
        logResult("JSON Check", false, "comparisonJSON is null");
        continue;
      }
      
      // Validate against Zod schema
      try {
        const validated = comparisonResultSchema.parse(comparisonJSON);
        logResult("Schema Validation", true, "comparisonJSON matches schema");
        
        // Check for Samlet data
        if (!validated.samlet) {
          logResult("Samlet Data", false, "Missing samlet overview");
        } else {
          logResult("Samlet Data", true, 
            `Samlet overview present: ${validated.samlet.totalSavings} kr annual savings`);
        }
        
        // Check policy comparisons
        if (validated.policyComparisons.length === 0) {
          logResult("Policy Comparisons", false, "No policy comparisons found");
        } else {
          logResult("Policy Comparisons", true, 
            `Found ${validated.policyComparisons.length} policy comparisons`);
          
          // Check each policy comparison for coverage rows and selvrisiko
          for (const policyComp of validated.policyComparisons) {
            const policyType = policyComp.policyType;
            const coverageRows = policyComp.coverageComparison.rows;
            
            if (coverageRows.length === 0) {
              logResult(`${policyType} Coverages`, false, "No coverage rows");
              continue;
            }
            
            logResult(`${policyType} Coverages`, true, 
              `${coverageRows.length} coverage rows`);
            
            // Check for selvrisiko preservation
            const rowsWithSelvrisiko = coverageRows.filter(row => 
              row.attributes.selvrisiko.value !== null
            );
            
            if (rowsWithSelvrisiko.length > 0) {
              logResult(`${policyType} Selvrisiko`, true, 
                `${rowsWithSelvrisiko.length}/${coverageRows.length} rows have selvrisiko`,
                {
                  examples: rowsWithSelvrisiko.slice(0, 3).map(row => ({
                    coverage: row.coverageName,
                    selvrisiko: row.attributes.selvrisiko.value,
                    variant: row.attributes.selvrisiko.variant
                  }))
                });
            } else {
              logResult(`${policyType} Selvrisiko`, false, 
                `No selvrisiko data found in ${coverageRows.length} rows`);
            }
          }
        }
        
        // Check cumulative savings chart
        if (!validated.cumulativeSavingsChart || validated.cumulativeSavingsChart.dataPoints.length === 0) {
          logResult("Savings Chart", false, "Missing cumulative savings chart data");
        } else {
          const chartPoints = validated.cumulativeSavingsChart.dataPoints.length;
          logResult("Savings Chart", true, 
            `Cumulative savings chart has ${chartPoints} data points`);
          
          if (chartPoints !== 120) {
            logResult("Chart Points", false, 
              `Expected 120 data points (10 years), got ${chartPoints}`);
          } else {
            logResult("Chart Points", true, "Chart has correct 120 data points");
          }
        }
        
      } catch (error: any) {
        logResult("Schema Validation", false, 
          `Zod validation failed: ${error.message}`,
          { errors: error.errors });
      }
    }

    // ========================================
    // SUMMARY
    // ========================================
    console.log(`\n━━━ TEST SUMMARY ━━━`);
    const totalTests = results.length;
    const passedTests = results.filter(r => r.success).length;
    const failedTests = totalTests - passedTests;
    
    console.log(`\nTotal: ${totalTests} tests`);
    console.log(`✅ Passed: ${passedTests}`);
    console.log(`❌ Failed: ${failedTests}`);
    
    if (failedTests > 0) {
      console.log(`\nFailed tests:`);
      results.filter(r => !r.success).forEach(r => {
        console.log(`  • [${r.stage}] ${r.message}`);
      });
      process.exit(1);
    } else {
      console.log(`\n🎉 All tests passed!`);
      process.exit(0);
    }

  } catch (error: any) {
    console.error(`\n❌ Fatal error:`, error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
