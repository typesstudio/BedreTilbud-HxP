import { db } from '../db';
import { offerSnapshots, healthChecks, documents } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';

async function checkHealthChecks() {
  const userId = 'e85ec3b9-e354-4c49-9f68-194830e356af';
  
  // Get all snapshots
  const snapshots = await db.select().from(offerSnapshots).where(eq(offerSnapshots.userId, userId));
  console.log(`\n📋 Total snapshots: ${snapshots.length}`);
  
  for (const snap of snapshots) {
    const hc = await db.select()
      .from(healthChecks)
      .where(eq(healthChecks.snapshotId, snap.id))
      .limit(1);
    
    const doc = await db.select()
      .from(documents)
      .where(eq(documents.id, snap.documentId))
      .limit(1);
    
    console.log(`\n  Snapshot: ${snap.id}`);
    console.log(`    Company: ${snap.companyId}`);
    console.log(`    Type: ${snap.policyType}`);
    console.log(`    Document: ${doc[0]?.documentType || 'unknown'}`);
    console.log(`    Health Check: ${hc.length > 0 ? hc[0].status : '❌ MISSING'}`);
  }
  
  process.exit(0);
}

checkHealthChecks();
