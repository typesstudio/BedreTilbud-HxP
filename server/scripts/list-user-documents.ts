import { storage } from "../storage";

const USER_ID = process.argv[2] || "e86b6430-0013-4fdc-9025-27aefe2d1528";

async function listDocuments() {
  try {
    const documents = await storage.getUserDocuments(USER_ID);
    
    console.log(`\n📄 Documents for user: ${USER_ID}\n`);
    console.log('='.repeat(80));
    
    for (const doc of documents) {
      console.log(`\nDocument ID: ${doc.id}`);
      console.log(`File Name: ${doc.fileName}`);
      console.log(`Type: ${doc.documentType}`);
      console.log(`Extraction Status: ${doc.extractionStatus}`);
      console.log(`Policies Extracted: ${doc.totalPoliciesExtracted || 0}`);
      console.log(`Created: ${doc.createdAt}`);
      
      // Get policies for this document
      const policies = await storage.getPoliciesByDocument(doc.id);
      if (policies.length > 0) {
        console.log(`\nPolicies (${policies.length}):`);
        policies.forEach((p, idx) => {
          console.log(`  ${idx + 1}. ${p.policyType} - Premium: ${p.premium || 'N/A'} kr - Deductible: ${p.deductible || 'N/A'} kr`);
          console.log(`     Health Check: ${p.healthCheckStatus}`);
        });
      }
      console.log('-'.repeat(80));
    }
    
    console.log(`\n✅ Total documents: ${documents.length}\n`);
    console.log(`To view OCR data, use the debug endpoint:`);
    console.log(`GET /api/debug/ocr/{documentId}\n`);
    
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

listDocuments();
