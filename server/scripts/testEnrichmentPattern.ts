#!/usr/bin/env tsx
/**
 * Minimal test for Enrichment Pattern implementation
 * Tests that coverage rows are preserved through the AI call
 */

import { drizzle } from 'drizzle-orm/neon-serverless';
import { Pool, neonConfig } from '@neondatabase/serverless';
import * as schema from '@shared/schema';
import ws from 'ws';
import { ComparisonOrchestrator } from '../services/comparisonOrchestrator.js';
import { StorageAdapter } from '../storage/adapter.js';

neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });
const storage = new StorageAdapter(db);
const orchestrator = new ComparisonOrchestrator(storage);

const TEST_USER_ID = 'e85ec3b9-e354-4c49-9f68-194830e356af'; // hello@vyork.dk

async function main() {
  console.log('\n🧪 ENRICHMENT PATTERN TEST\n');
  console.log('Testing that coverage rows are preserved through AI call...\n');

  try {
    // Run comparison for IF Forsikring (offer) vs Alm. Brand (current)
    const result = await orchestrator.runComparisonsForUser(TEST_USER_ID, true);

    console.log('\n✅ Comparison completed!');
    console.log(JSON.stringify(result, null, 2));

    // Fetch the comparison results
    const comparisons = await storage.getCompanyComparisonsByUserId(TEST_USER_ID);
    console.log(`\n📊 Found ${comparisons.length} comparison(s)`);

    for (const comp of comparisons) {
      if (comp.comparisonJSON) {
        const json = typeof comp.comparisonJSON === 'string' 
          ? JSON.parse(comp.comparisonJSON) 
          : comp.comparisonJSON;
        
        console.log(`\n📋 Comparison: ${json.meta.currentCompany} → ${json.meta.offerCompany}`);
        console.log(`   Policies: ${json.policyComparisons.length}`);
        
        for (const policy of json.policyComparisons) {
          console.log(`   - ${policy.policyType}: ${policy.coverageComparison.rows.length} coverage rows`);
        }

        // VALIDATION: Check if coverage rows are preserved
        const rowCounts = json.policyComparisons.map((p: any) => ({
          type: p.policyType,
          rows: p.coverageComparison.rows.length
        }));

        const hasRows = rowCounts.every((rc: any) => rc.rows > 0);
        
        if (hasRows) {
          console.log('\n✅ ENRICHMENT PATTERN TEST PASSED!');
          console.log('   All policies have coverage rows preserved.');
          console.log('   Row counts:', JSON.stringify(rowCounts));
        } else {
          console.log('\n❌ ENRICHMENT PATTERN TEST FAILED!');
          console.log('   Some policies lost coverage rows.');
          console.log('   Row counts:', JSON.stringify(rowCounts));
          process.exit(1);
        }
      }
    }

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
