import { ExtractionOrchestratorService } from '../services/extractionOrchestratorService';
import { DatabaseStorage } from '../storage';
import { db } from '../db';

async function forceExtractOffer() {
  console.log('\n🔄 Force extracting stuck offer document...\n');
  
  const documentId = '6c7e7d93-187f-4ae9-9ca8-bf40d60e15ce'; // The svphil offer
  const storage = new DatabaseStorage(db);
  
  try {
    console.log('📄 Document ID:', documentId);
    console.log('⏳ Starting extraction orchestrator...\n');
    
    const orchestrator = new ExtractionOrchestratorService(storage);
    const result = await orchestrator.processDocument(documentId);
    
    if (!result.success) {
      console.error('❌ Extraction failed:', result.error);
      process.exit(1);
    }
    
    console.log('\n✅ Extraction completed successfully!');
    console.log('📊 Results:');
    console.log(`  - Snapshots created: ${result.snapshots.length}`);
    console.log(`  - Processing time: ${result.metadata?.totalDuration || 'N/A'}ms`);
    
    console.log('\n📋 Extracted policies:');
    result.snapshots.forEach((snap, idx) => {
      console.log(`  ${idx + 1}. ${snap.policyType || 'Unknown type'} - ${snap.companyId || 'Unknown company'}`);
    });
    
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Script error:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

forceExtractOffer();
