import { storage } from "../storage";
import { HealthCheckOrchestrator } from "../services/healthCheckOrchestrator";

const DOCUMENT_ID = process.argv[2] || 'c008290f-d4e3-4461-82a2-7c985dcffe3c';
const USER_ID = process.argv[3] || 'e85ec3b9-e354-4c49-9f68-194830e356af';

async function runHealthCheckOrchestrator() {
  try {
    console.log(`\n🔄 Running Health Check Orchestrator`);
    console.log(`Document ID: ${DOCUMENT_ID}`);
    console.log(`User ID: ${USER_ID}\n`);
    
    // Get document info
    const document = await storage.getDocument(DOCUMENT_ID);
    if (!document) {
      console.error("❌ Document not found");
      process.exit(1);
    }
    
    console.log(`Document: ${document.fileName}`);
    console.log(`Type: ${document.documentType}`);
    console.log(`Status: ${document.extractionStatus}\n`);
    
    // Check policies BEFORE
    console.log("=== BEFORE ===");
    const policiesBefore = await storage.getPoliciesByDocument(DOCUMENT_ID);
    console.log(`Policies: ${policiesBefore.length}`);
    for (const p of policiesBefore) {
      console.log(`  - ${p.policyType}: status="${p.healthCheckStatus}", savings=${p.healthCheckSavingsAnnual || 0}kr`);
    }
    
    // Run orchestrator
    console.log("\n⏳ Running Health Check Orchestrator...\n");
    const orchestrator = new HealthCheckOrchestrator(storage);
    
    // Delete existing health checks for clean run
    await orchestrator.deleteHealthChecksForDocument(DOCUMENT_ID);
    
    const result = await orchestrator.runForDocument(DOCUMENT_ID, {
      source: 'current_upload',
      userId: USER_ID,
      forceRerun: true
    });
    
    console.log("\n✅ Orchestrator completed!\n");
    console.log(`Success: ${result.success}`);
    console.log(`Health Checks Created: ${result.healthChecksCreated}`);
    console.log(`Health Checks Failed: ${result.healthChecksFailed}`);
    
    if (result.errors.length > 0) {
      console.log(`Errors: ${result.errors.join(', ')}`);
    }
    
    // Check policies AFTER
    console.log("\n=== AFTER ===");
    const policiesAfter = await storage.getPoliciesByDocument(DOCUMENT_ID);
    console.log(`Policies: ${policiesAfter.length}`);
    for (const p of policiesAfter) {
      console.log(`  - ${p.policyType}: status="${p.healthCheckStatus}", savings=${p.healthCheckSavingsAnnual || 0}kr`);
    }
    
    console.log("\n✅ TEST COMPLETE!\n");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

runHealthCheckOrchestrator();
