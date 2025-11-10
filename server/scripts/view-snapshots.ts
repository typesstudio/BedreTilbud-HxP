import { storage } from "../storage";

async function viewSnapshots() {
  console.log("=== OfferSnapshot Database Viewer ===\n");

  const userId = "e86b6430-0013-4fdc-9025-27aefe2d1528"; // pvh user
  
  // Get all snapshots for this user
  const snapshots = await storage.getOfferSnapshotsByUser(userId);
  
  console.log(`📊 Total snapshots for user: ${snapshots.length}\n`);

  if (snapshots.length === 0) {
    console.log("No snapshots found.");
    return;
  }

  // Group by document
  const byDocument = new Map<string, typeof snapshots>();
  for (const snapshot of snapshots) {
    const docId = snapshot.documentId;
    if (!byDocument.has(docId)) {
      byDocument.set(docId, []);
    }
    byDocument.get(docId)!.push(snapshot);
  }

  console.log(`📄 Documents with snapshots: ${byDocument.size}\n`);

  // Display each document's snapshots
  for (const [documentId, docSnapshots] of Array.from(byDocument.entries())) {
    const document = await storage.getDocument(documentId);
    
    console.log("━".repeat(80));
    console.log(`📄 Document: ${documentId}`);
    console.log(`   File: ${document?.fileName || "Unknown"}`);
    console.log(`   Snapshots: ${docSnapshots.length}`);
    console.log("━".repeat(80));

    for (const snapshot of docSnapshots) {
      console.log(`\n  ✅ Snapshot ID: ${snapshot.id}`);
      console.log(`     Policy Type: ${snapshot.policyType}`);
      console.log(`     Company ID: ${snapshot.companyId || "Unknown (needs resolution)"}`);
      console.log(`     Premium: ${snapshot.premium ? `${snapshot.premium} DKK` : "Not found"}`);
      console.log(`     Deductible: ${snapshot.deductible ? `${snapshot.deductible} DKK` : "Not found"}`);
      console.log(`     Confidence: ${snapshot.confidenceScore}%`);
      console.log(`     Validation: ${snapshot.validationStatus}`);
      console.log(`     Extractor: ${snapshot.extractorProvider}/${snapshot.extractorModel}`);
      console.log(`     Version: ${snapshot.extractionVersion}`);
      console.log(`     Page Range: ${snapshot.sourcePageRange || "Unknown"}`);
      
      // Show coverage summary
      const coverages = snapshot.coverageDetails as any;
      if (coverages?.mainCoverages) {
        console.log(`     Main Coverages: ${coverages.mainCoverages.length} items`);
        coverages.mainCoverages.slice(0, 3).forEach((c: any, i: number) => {
          console.log(`       ${i + 1}. ${c.name} - Limit: ${c.limit || "N/A"}`);
        });
        if (coverages.mainCoverages.length > 3) {
          console.log(`       ... and ${coverages.mainCoverages.length - 3} more`);
        }
      }
      
      if (coverages?.additionalCoverages) {
        console.log(`     Additional Coverages: ${coverages.additionalCoverages.length} items`);
      }
      
      if (snapshot.validationErrors) {
        console.log(`     ⚠️  Validation Errors:`);
        const errors = Array.isArray(snapshot.validationErrors) 
          ? snapshot.validationErrors 
          : [snapshot.validationErrors];
        errors.forEach((err: any) => console.log(`       - ${err}`));
      }
    }
    
    console.log();
  }
}

viewSnapshots().catch(console.error);
