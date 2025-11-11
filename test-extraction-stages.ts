import { ExtractionOrchestratorService } from './server/services/extractionOrchestratorService';
import { DatabaseStorage } from './server/storage';

const BENCHMARK_DOC_ID = '399a9364-0d9c-4070-8e61-9770486031a8';

async function testExtractionStages() {
  console.log('🧪 Testing Extraction Stages Feature');
  console.log('========================================');
  
  try {
    const storage = new DatabaseStorage();
    const orchestrator = new ExtractionOrchestratorService(storage);
    
    console.log(`\n📄 Processing benchmark document: ${BENCHMARK_DOC_ID}`);
    console.log('⚠️  Note: This will re-extract the document and capture pipeline stages\n');
    
    const result = await orchestrator.processDocument(BENCHMARK_DOC_ID, {
      forceReprocess: true
    });
    
    if (result.success) {
      console.log('\n✅ Extraction completed successfully!');
      console.log(`   Snapshots created: ${result.snapshots.length}`);
      console.log(`   Policy types: ${result.snapshots.map(s => s.policyType).join(', ')}`);
    } else {
      console.error('\n❌ Extraction failed:', result.error);
      process.exit(1);
    }
    
    console.log('\n📊 Fetching extraction stages from database...');
    const doc = await storage.getDocument(BENCHMARK_DOC_ID);
    
    if (!doc) {
      console.error('❌ Document not found');
      process.exit(1);
    }
    
    if (!doc.extractionStages) {
      console.error('❌ No extraction stages found');
      process.exit(1);
    }
    
    const stages = doc.extractionStages as any;
    
    console.log('\n✅ Extraction Stages Captured:');
    console.log('   Stage 1 (OCR):', stages.stage1_ocr ? '✓' : '✗');
    console.log('   Stage 2 (Segmentation):', stages.stage2_segmentation ? '✓' : '✗');
    console.log('   Stage 3 (Extraction):', stages.stage3_extraction ? '✓' : '✗');
    
    if (stages.stage1_ocr) {
      console.log('\n📝 Stage 1 (OCR) Details:');
      console.log(`   Markdown length: ${stages.stage1_ocr.metadata?.markdownLength || 'N/A'}`);
      console.log(`   Page count: ${stages.stage1_ocr.metadata?.pageCount || 'N/A'}`);
      console.log(`   Latency: ${stages.stage1_ocr.metadata?.latencyMs || 'N/A'}ms`);
    }
    
    if (stages.stage2_segmentation) {
      console.log('\n🔍 Stage 2 (Segmentation) Details:');
      console.log(`   Segments found: ${stages.stage2_segmentation.metadata?.segmentCount || 'N/A'}`);
      console.log(`   Model used: ${stages.stage2_segmentation.metadata?.modelUsed || 'N/A'}`);
      console.log(`   Tokens: ${stages.stage2_segmentation.metadata?.tokensUsed || 'N/A'}`);
      console.log(`   Cost: $${stages.stage2_segmentation.metadata?.costUsd || 'N/A'}`);
      console.log(`   Latency: ${stages.stage2_segmentation.metadata?.latencyMs || 'N/A'}ms`);
      
      if (stages.stage2_segmentation.rawOutput) {
        console.log(`   Policy types: ${stages.stage2_segmentation.rawOutput.map((s: any) => s.policyType).join(', ')}`);
      }
    }
    
    if (stages.stage3_extraction) {
      console.log('\n📦 Stage 3 (Extraction) Details:');
      console.log(`   Policies extracted: ${stages.stage3_extraction.metadata?.policyCount || 'N/A'}`);
      console.log(`   Success count: ${stages.stage3_extraction.metadata?.successCount || 'N/A'}`);
      console.log(`   Failure count: ${stages.stage3_extraction.metadata?.failureCount || 'N/A'}`);
      console.log(`   Latency: ${stages.stage3_extraction.metadata?.latencyMs || 'N/A'}ms`);
      
      if (stages.stage3_extraction.metadata?.errors && stages.stage3_extraction.metadata.errors.length > 0) {
        console.log(`   Errors: ${stages.stage3_extraction.metadata.errors.join('; ')}`);
      }
    }
    
    console.log('\n✅ Test completed successfully!');
    console.log('\n📝 Next: Compare extracted data against benchmark manually');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

testExtractionStages();
