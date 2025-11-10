import { storage } from "../storage";
import { ExtractionOrchestratorService } from "../services/extractionOrchestratorService";

async function testOrchestrator() {
  console.log("=== Testing ExtractionOrchestratorService ===\n");

  // Find a test document from pvh user
  const userId = "e86b6430-0013-4fdc-9025-27aefe2d1528"; // pvh user
  const documents = await storage.getUserDocuments(userId);
  
  if (documents.length === 0) {
    console.log("❌ No documents found for pvh user");
    return;
  }

  const testDoc = documents[0];
  console.log(`📄 Testing with document: ${testDoc.id}`);
  console.log(`   File: ${testDoc.filename}`);
  console.log(`   Uploaded: ${testDoc.uploadedAt}\n`);

  // Initialize orchestrator
  const orchestrator = new ExtractionOrchestratorService(storage);

  // Test the pipeline
  console.log("🚀 Running extraction pipeline...\n");
  const result = await orchestrator.processDocument(testDoc.id);

  // Display results
  console.log("\n=== EXTRACTION RESULT ===");
  console.log(`✅ Success: ${result.success}`);
  console.log(`📊 Snapshots created: ${result.snapshots.length}`);
  
  if (result.error) {
    console.log(`❌ Error: ${result.error}`);
  }

  console.log("\n=== PIPELINE STAGES ===");
  for (const stage of result.stages) {
    const duration = stage.completedAt && stage.startedAt 
      ? `${Math.round((stage.completedAt.getTime() - stage.startedAt.getTime()) / 1000)}s`
      : "N/A";
    
    const statusEmoji = {
      pending: "⏳",
      running: "🔄",
      completed: "✅",
      failed: "❌"
    }[stage.status];

    console.log(`${statusEmoji} ${stage.name}: ${stage.status} (${duration})`);
    
    if (stage.output) {
      console.log(`   Output:`, JSON.stringify(stage.output, null, 2));
    }
    
    if (stage.error) {
      console.log(`   Error: ${stage.error}`);
    }
  }

  console.log("\n=== TEST COMPLETE ===");
}

testOrchestrator().catch(console.error);
