import { storage } from "../storage";
import { ExtractionOrchestratorService } from "../services/extractionOrchestratorService";

async function reprocessAllDocuments() {
  console.log("=== Reprocessing All Documents with New Extraction Pipeline ===\n");

  const userId = "e86b6430-0013-4fdc-9025-27aefe2d1528"; // pvh user
  
  // Get all documents for this user
  const documents = await storage.getUserDocuments(userId);
  
  console.log(`📄 Found ${documents.length} documents for user\n`);

  if (documents.length === 0) {
    console.log("❌ No documents found");
    return;
  }

  const orchestrator = new ExtractionOrchestratorService(storage);
  const results: any[] = [];

  for (const [index, document] of documents.entries()) {
    console.log(`\n${"=".repeat(80)}`);
    console.log(`📄 Processing Document ${index + 1}/${documents.length}`);
    console.log(`${"=".repeat(80)}`);
    console.log(`   ID: ${document.id}`);
    console.log(`   File: ${document.fileName}`);
    console.log(`   Type: ${document.documentType}`);
    console.log(`   Created: ${document.createdAt}\n`);

    // Check if already processed (forceReprocess will handle this internally)
    const existingSnapshots = await storage.getOfferSnapshotsByDocument(document.id);
    if (existingSnapshots.length > 0) {
      console.log(`   ℹ️  Has ${existingSnapshots.length} existing snapshots - will force reprocess`);
    }

    console.log("   🚀 Running extraction pipeline with forceReprocess...\n");

    try {
      const startTime = Date.now();
      const result = await orchestrator.processDocument(document.id, {
        forceReprocess: true // Enable force reprocess to regenerate
      });
      const duration = Date.now() - startTime;

      if (result.success) {
        console.log(`   ✅ SUCCESS in ${Math.round(duration / 1000)}s`);
        console.log(`   📊 Created ${result.snapshots.length} OfferSnapshots`);
        
        // Show stage summary
        console.log(`\n   📋 Pipeline Stages:`);
        for (const stage of result.stages) {
          const icon = stage.status === 'completed' ? '✅' : 
                       stage.status === 'failed' ? '❌' : '⏳';
          const stageDuration = stage.completedAt && stage.startedAt
            ? `${Math.round((stage.completedAt.getTime() - stage.startedAt.getTime()) / 1000)}s`
            : 'N/A';
          console.log(`      ${icon} ${stage.name}: ${stage.status} (${stageDuration})`);
          if (stage.output) {
            console.log(`         Output: ${JSON.stringify(stage.output)}`);
          }
        }

        // Show extracted policies
        console.log(`\n   📝 Extracted Policies:`);
        for (const snapshot of result.snapshots) {
          console.log(`      • ${snapshot.policyType.toUpperCase()}`);
          console.log(`        Premium: ${snapshot.premium || 'N/A'} DKK`);
          console.log(`        Deductible: ${snapshot.deductible || 'N/A'} DKK`);
          console.log(`        Confidence: ${snapshot.confidenceScore}%`);
          console.log(`        Company: ${snapshot.companyId || 'Not resolved'}`);
        }

        results.push({
          documentId: document.id,
          fileName: document.fileName,
          status: 'success',
          snapshotsCount: result.snapshots.length,
          duration: duration,
          stages: result.stages.map(s => `${s.name}:${s.status}`)
        });

      } else {
        console.log(`   ❌ FAILED: ${result.error}`);
        results.push({
          documentId: document.id,
          fileName: document.fileName,
          status: 'failed',
          error: result.error
        });
      }

    } catch (error) {
      console.error(`   ❌ EXCEPTION:`, error);
      results.push({
        documentId: document.id,
        fileName: document.fileName,
        status: 'error',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // Summary
  console.log(`\n\n${"=".repeat(80)}`);
  console.log("📊 REPROCESSING SUMMARY");
  console.log(`${"=".repeat(80)}`);
  console.log(`Total documents: ${documents.length}`);
  console.log(`Successful: ${results.filter(r => r.status === 'success').length}`);
  console.log(`Skipped: ${results.filter(r => r.status === 'skipped').length}`);
  console.log(`Failed: ${results.filter(r => r.status === 'failed' || r.status === 'error').length}`);
  
  const totalSnapshots = results
    .filter(r => r.status === 'success' || r.status === 'skipped')
    .reduce((sum, r) => sum + (r.snapshotsCount || 0), 0);
  console.log(`Total OfferSnapshots: ${totalSnapshots}`);

  console.log(`\n✅ Reprocessing complete!\n`);

  // Verification: Check final counts
  const allSnapshots = await storage.getOfferSnapshotsByUser(userId);
  console.log(`\n📊 Database Verification:`);
  console.log(`   OfferSnapshots in database: ${allSnapshots.length}`);
  console.log(`   Breakdown by validation status:`);
  const byStatus = allSnapshots.reduce((acc: any, s) => {
    acc[s.validationStatus] = (acc[s.validationStatus] || 0) + 1;
    return acc;
  }, {});
  for (const [status, count] of Object.entries(byStatus)) {
    console.log(`      - ${status}: ${count}`);
  }

  console.log(`\n   Breakdown by policy type:`);
  const byType = allSnapshots.reduce((acc: any, s) => {
    acc[s.policyType] = (acc[s.policyType] || 0) + 1;
    return acc;
  }, {});
  for (const [type, count] of Object.entries(byType)) {
    console.log(`      - ${type}: ${count}`);
  }
}

reprocessAllDocuments().catch(console.error);
