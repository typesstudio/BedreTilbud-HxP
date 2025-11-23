/**
 * Backfill Policy Snapshots
 * 
 * This script populates the policy_snapshots table from existing documents
 * that have extraction_stages data.
 * 
 * Usage:
 *   npx tsx server/scripts/backfillPolicySnapshots.ts
 *   npx tsx server/scripts/backfillPolicySnapshots.ts --document-id=<id>
 */

import { db } from "../db";
import { documents, policySnapshots } from "@shared/schema";
import { policySnapshotService } from "../services/policySnapshots/PolicySnapshotService";
import { eq, isNotNull } from "drizzle-orm";

async function backfillPolicySnapshots(documentId?: string) {
  console.log("=".repeat(70));
  console.log("BACKFILL POLICY SNAPSHOTS");
  console.log("=".repeat(70));
  
  try {
    // Get documents to process
    let docsToProcess;
    
    if (documentId) {
      console.log(`\n📄 Processing single document: ${documentId}`);
      docsToProcess = await db
        .select()
        .from(documents)
        .where(eq(documents.id, documentId));
      
      if (docsToProcess.length === 0) {
        console.error(`❌ Document ${documentId} not found`);
        process.exit(1);
      }
    } else {
      console.log(`\n📄 Processing all completed documents with extraction stages...`);
      // Fetch documents where:
      // - extraction_status = 'completed'
      // - AND extraction_stages->'stage2_segmentation' is NOT NULL
      docsToProcess = await db
        .select()
        .from(documents)
        .where(eq(documents.extractionStatus, "completed"));
    }
    
    console.log(`\nFound ${docsToProcess.length} documents to process\n`);
    
    let totalSnapshotsCreated = 0;
    let successfulDocs = 0;
    let failedDocs = 0;
    
    for (const doc of docsToProcess) {
      try {
        console.log(`\n${"─".repeat(70)}`);
        console.log(`Processing: ${doc.fileName} (${doc.documentType})`);
        console.log(`Document ID: ${doc.id}`);
        
        // Check if we have extraction stages
        if (!doc.extractionStages) {
          console.log(`⚠️  No extraction_stages found, skipping...`);
          continue;
        }
        
        const stages = doc.extractionStages as any;
        
        // Check if we have stage2_segmentation
        if (!stages.stage2_segmentation || !stages.stage2_segmentation.rawOutput) {
          console.log(`⚠️  No stage2_segmentation data found, skipping...`);
          continue;
        }
        
        // Check if snapshots already exist for this document
        const existingSnapshots = await db
          .select()
          .from(policySnapshots)
          .where(eq(policySnapshots.documentId, doc.id));
        
        if (existingSnapshots.length > 0) {
          console.log(`⚠️  ${existingSnapshots.length} snapshots already exist, skipping...`);
          continue;
        }
        
        // Create snapshots
        console.log(`Creating snapshots from ${stages.stage2_segmentation.rawOutput.length} segments...`);
        
        const snapshots = await policySnapshotService.createSnapshotsFromDocument(
          doc,
          stages
        );
        
        console.log(`✅ Created ${snapshots.length} snapshots`);
        totalSnapshotsCreated += snapshots.length;
        successfulDocs++;
        
        // Show summary of created snapshots
        for (const snapshot of snapshots) {
          console.log(
            `   - ${snapshot.kind}/${snapshot.policyType} from ${snapshot.companyName}`
          );
        }
        
      } catch (error) {
        console.error(`❌ Failed to process document ${doc.id}:`, error);
        failedDocs++;
      }
    }
    
    // Final summary
    console.log(`\n${"=".repeat(70)}`);
    console.log("BACKFILL SUMMARY");
    console.log(`${"=".repeat(70)}`);
    console.log(`Documents processed: ${docsToProcess.length}`);
    console.log(`Successful: ${successfulDocs}`);
    console.log(`Failed: ${failedDocs}`);
    console.log(`Total snapshots created: ${totalSnapshotsCreated}`);
    console.log(`${"=".repeat(70)}\n`);
    
  } catch (error) {
    console.error("❌ Backfill failed:", error);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const documentIdArg = args.find(arg => arg.startsWith("--document-id="));
const documentId = documentIdArg ? documentIdArg.split("=")[1] : undefined;

// Run backfill
backfillPolicySnapshots(documentId)
  .then(() => {
    console.log("✅ Backfill completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Backfill failed:", error);
    process.exit(1);
  });
