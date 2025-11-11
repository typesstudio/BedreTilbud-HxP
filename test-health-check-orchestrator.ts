import { storage } from "./server/storage";
import { HealthCheckOrchestrator } from "./server/services/healthCheckOrchestrator";

const DOCUMENT_ID = 'c008290f-d4e3-4461-82a2-7c985dcffe3c'; // hello@vyork.dk's latest document
const USER_ID = 'e85ec3b9-e354-4c49-9f68-194830e356af';

async function testHealthCheckOrchestrator() {
  console.log('========================================');
  console.log('Testing HealthCheckOrchestrator');
  console.log('========================================\n');

  try {
    // Initialize orchestrator
    const healthCheckOrchestrator = new HealthCheckOrchestrator(storage);

    console.log(`Document ID: ${DOCUMENT_ID}`);
    console.log(`User ID: ${USER_ID}\n`);

    // Check document exists
    const document = await storage.getDocument(DOCUMENT_ID);
    if (!document) {
      console.error('❌ Document not found!');
      process.exit(1);
    }

    console.log(`✅ Document found: ${document.fileName}`);
    console.log(`   Document Type: ${document.documentType}`);
    console.log(`   Extraction Status: ${document.extractionStatus}`);
    console.log(`   Total Policies: ${document.totalPoliciesExtracted}\n`);

    // Check existing health checks
    const existingHealthChecks = await storage.getHealthChecksByDocument(DOCUMENT_ID);
    console.log(`Existing health checks: ${existingHealthChecks.length}`);
    if (existingHealthChecks.length > 0) {
      console.log('   Deleting existing health checks to test fresh run...\n');
      await healthCheckOrchestrator.deleteHealthChecksForDocument(DOCUMENT_ID);
    }

    // Run health check orchestrator
    console.log('Running HealthCheckOrchestrator.runForDocument()...\n');
    const result = await healthCheckOrchestrator.runForDocument(
      DOCUMENT_ID,
      {
        source: 'current_upload',
        userId: USER_ID,
        forceRerun: true
      }
    );

    console.log('========================================');
    console.log('RESULT:');
    console.log('========================================');
    console.log(`Success: ${result.success}`);
    console.log(`Health Checks Created: ${result.healthChecksCreated}`);
    console.log(`Health Checks Failed: ${result.healthChecksFailed}`);
    console.log(`Skipped: ${result.skipped}`);
    if (result.skipReason) {
      console.log(`Skip Reason: ${result.skipReason}`);
    }
    if (result.errors.length > 0) {
      console.log(`Errors: ${result.errors.join(', ')}`);
    }

    // Verify health checks were created
    const newHealthChecks = await storage.getHealthChecksByDocument(DOCUMENT_ID);
    console.log(`\n✅ Health checks in database: ${newHealthChecks.length}`);

    if (newHealthChecks.length > 0) {
      console.log('\nHealth Check Details:');
      for (const hc of newHealthChecks) {
        const result = hc.result as any;
        console.log(`  - ID: ${hc.id}`);
        console.log(`    Data Source: ${hc.dataSource}`);
        console.log(`    Confidence Score: ${hc.confidenceScore}`);
        console.log(`    Overall Score: ${result?.overallScore || 'N/A'}`);
        console.log(`    Potential Savings: ${result?.potentialSavings?.realistic || 0} kr`);
      }
    }

    console.log('\n========================================');
    console.log('TEST COMPLETE ✅');
    console.log('========================================');

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error);
    process.exit(1);
  }
}

testHealthCheckOrchestrator();
