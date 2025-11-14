import { db } from '../db';
import { documents } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { extractionOrchestrator } from '../services/extractionOrchestrator';

async function reprocessOffer() {
  console.log('\n🔄 Reprocessing offer document...\n');
  
  const offerDoc = await db.select()
    .from(documents)
    .where(eq(documents.fileName, 'attachment_1760437335072_7041411_1991117.pdf'))
    .limit(1);
  
  if (!offerDoc.length) {
    console.log('❌ Offer document not found');
    return;
  }
  
  const doc = offerDoc[0];
  console.log('📄 Document ID:', doc.id);
  console.log('📄 File:', doc.fileName);
  console.log('📄 Current status:', doc.extractionStatus);
  
  try {
    console.log('\n⏳ Starting extraction...');
    await extractionOrchestrator.orchestrate(doc.id);
    console.log('✅ Extraction completed!');
  } catch (error) {
    console.error('❌ Extraction failed:', error.message);
    console.error('Full error:', error);
  }
  
  process.exit(0);
}

reprocessOffer().catch(err => {
  console.error('Script error:', err);
  process.exit(1);
});
