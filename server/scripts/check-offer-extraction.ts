import { db } from '../db';
import { documents } from '../../shared/schema';
import { eq } from 'drizzle-orm';

async function checkOfferExtraction() {
  const offerDoc = await db.select()
    .from(documents)
    .where(eq(documents.fileName, 'attachment_1760437335072_7041411_1991117.pdf'))
    .limit(1);
  
  if (!offerDoc.length) {
    console.log('❌ Offer document not found');
    return;
  }
  
  const doc = offerDoc[0];
  console.log('\n📄 Offer Document Details:');
  console.log('  ID:', doc.id);
  console.log('  File:', doc.fileName);
  console.log('  Type:', doc.documentType);
  console.log('  Status:', doc.status);
  console.log('  Company:', doc.companyId);
  console.log('  OCR Status:', doc.ocrStatus);
  console.log('  Extraction Status:', doc.extractionStatus);
  console.log('  Error:', doc.errorMessage);
  console.log('  Created:', doc.createdAt);
  console.log('  Updated:', doc.updatedAt);
  
  console.log('\n📋 Extraction Stages:', doc.extractionStages ? 'Present' : 'Not present');
  if (doc.extractionStages) {
    console.log(JSON.stringify(doc.extractionStages, null, 2));
  }
  
  process.exit(0);
}

checkOfferExtraction().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
