import { db } from '../db';
import { users, documents, offerSnapshots, healthChecks, companyComparisons } from '../../shared/schema';
import { eq, and, desc } from 'drizzle-orm';

async function debugComparison() {
  console.log('\n=== DEBUGGING COMPARISON FOR hello@vyork.dk ===\n');
  
  // 1. Find user
  const user = await db.select().from(users).where(eq(users.email, 'hello@vyork.dk')).limit(1);
  if (!user.length) {
    console.log('❌ User not found');
    return;
  }
  console.log('✅ User found:', user[0].id, user[0].email);
  const userId = user[0].id;
  
  // 2. Find all documents
  const allDocs = await db.select().from(documents).where(eq(documents.userId, userId));
  console.log(`\n📄 Total documents: ${allDocs.length}`);
  allDocs.forEach(doc => {
    console.log(`  - ${doc.id}: ${doc.documentType} (${doc.fileName || 'no name'})`);
  });
  
  // 3. Find all snapshots
  const allSnapshots = await db.select().from(offerSnapshots).where(eq(offerSnapshots.userId, userId));
  console.log(`\n📋 Total snapshots: ${allSnapshots.length}`);
  
  // Group by document type
  const currentSnapshots = [];
  const offerSnaps = [];
  
  for (const snap of allSnapshots) {
    const doc = allDocs.find(d => d.id === snap.documentId);
    if (doc?.documentType === 'current') {
      currentSnapshots.push(snap);
    } else if (doc?.documentType === 'offer') {
      offerSnaps.push(snap);
    }
  }
  
  console.log(`\n  Current policies: ${currentSnapshots.length}`);
  currentSnapshots.forEach(snap => {
    console.log(`    - ${snap.id}: ${snap.companyId} (${snap.policyType})`);
  });
  
  console.log(`\n  Offer policies: ${offerSnaps.length}`);
  offerSnaps.forEach(snap => {
    console.log(`    - ${snap.id}: ${snap.companyId} (${snap.policyType})`);
  });
  
  // 4. Find svphil offer specifically
  const svphilOffers = offerSnaps.filter(s => s.companyId?.toLowerCase().includes('svphil') || s.companyId?.toLowerCase().includes('sv phil'));
  console.log(`\n🎯 Svphil offers: ${svphilOffers.length}`);
  svphilOffers.forEach(snap => {
    console.log(`    - ${snap.id}: ${snap.companyId} (${snap.policyType})`);
  });
  
  // 5. Check health checks
  const allHealthChecks = await db.select().from(healthChecks).where(eq(healthChecks.userId, userId));
  console.log(`\n🏥 Total health checks: ${allHealthChecks.length}`);
  
  const currentWithHealth = currentSnapshots.filter(snap => 
    allHealthChecks.some(hc => hc.snapshotId === snap.id && hc.status === 'completed')
  );
  const offerWithHealth = offerSnaps.filter(snap => 
    allHealthChecks.some(hc => hc.snapshotId === snap.id && hc.status === 'completed')
  );
  
  console.log(`  Current with health checks: ${currentWithHealth.length}`);
  console.log(`  Offer with health checks: ${offerWithHealth.length}`);
  
  // 6. Check existing comparisons
  const existingComparisons = await db.select()
    .from(companyComparisons)
    .where(eq(companyComparisons.userId, userId))
    .orderBy(desc(companyComparisons.createdAt));
  
  console.log(`\n📊 Existing comparisons: ${existingComparisons.length}`);
  existingComparisons.forEach(comp => {
    console.log(`  - ${comp.currentCompany} vs ${comp.offerCompany}: ${comp.status}`);
  });
  
  // 7. Summary
  console.log('\n=== SUMMARY ===');
  console.log(`Current policies with health checks: ${currentWithHealth.length}`);
  console.log(`Offer policies with health checks: ${offerWithHealth.length}`);
  console.log(`Svphil offers with health checks: ${svphilOffers.filter(s => offerWithHealth.includes(s)).length}`);
  console.log(`Ready for comparison: ${currentWithHealth.length > 0 && offerWithHealth.length > 0 ? '✅ YES' : '❌ NO'}`);
  
  process.exit(0);
}

debugComparison().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
