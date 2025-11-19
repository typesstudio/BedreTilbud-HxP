import { storage } from "../storage";
import { insuranceCheckService } from "../services/insuranceCheckService";

const SNAPSHOT_ID = process.argv[2] || '20c6e2d4-5747-4cb1-84bf-00ef9c9f672d';

async function generateHealthCheck() {
  try {
    console.log(`\n🔄 Generating health check for snapshot: ${SNAPSHOT_ID}\n`);
    
    // Get the snapshot
    const snapshot = await storage.getOfferSnapshot(SNAPSHOT_ID);
    if (!snapshot) {
      console.error("❌ Snapshot not found");
      process.exit(1);
    }
    
    console.log(`Policy Type: ${snapshot.policyType}`);
    console.log(`Annual Premium: ${snapshot.annualPremium} kr`);
    console.log(`Company: ${snapshot.companyId}\n`);
    
    // Check if health check already exists
    const existingHealthChecks = await storage.getHealthChecksByDocument(snapshot.documentId);
    const existingForSnapshot = existingHealthChecks.filter(hc => hc.snapshotId === SNAPSHOT_ID);
    if (existingForSnapshot.length > 0) {
      console.log(`⚠️  Health check already exists for this snapshot, skipping`);
      process.exit(0);
    }
    
    // Run health check analysis
    console.log("⏳ Running health check analysis with AI...\n");
    const healthCheckResult = await insuranceCheckService.analyzeInsuranceHealth(snapshot);
    
    // Create health check record
    const healthCheck = await storage.createHealthCheck({
      snapshotId: SNAPSHOT_ID,
      documentId: snapshot.documentId,
      healthCheckPayload: healthCheckResult as any,
      score: healthCheckResult.overallScore,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    
    console.log("✅ Health check created!\n");
    console.log(`Health Check ID: ${healthCheck.id}`);
    console.log(`Overall Score: ${healthCheckResult.overallScore}/10`);
    console.log(`Score Explanation: ${healthCheckResult.scoreExplanation}\n`);
    
    process.exit(0);
  } catch (error: any) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

generateHealthCheck();
