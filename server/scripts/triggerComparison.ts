import { storage } from "../storage";
import { ComparisonOrchestrator } from "../services/comparisonOrchestrator";

const USER_ID = 'e85ec3b9-e354-4c49-9f68-194830e356af';

async function main() {
  console.log('================================================================================');
  console.log('TRIGGER COMPARISON SCRIPT');
  console.log('================================================================================\n');
  console.log(`User ID: ${USER_ID}\n`);

  const orchestrator = new ComparisonOrchestrator(storage);

  console.log('[Step 1] Running comparison for user...\n');

  const result = await orchestrator.runForUser({
    userId: USER_ID,
    forceRerun: true // Force regeneration
  });

  console.log('\n================================================================================');
  console.log('RESULT');
  console.log('================================================================================\n');
  console.log(`Success: ${result.success}`);
  console.log(`Comparisons created: ${result.comparisonsCreated}`);
  console.log(`Comparisons failed: ${result.comparisonsFailed}`);
  console.log(`Skipped: ${result.skipped || false}`);
  if (result.skipReason) {
    console.log(`Skip reason: ${result.skipReason}`);
  }
  
  if (result.errors.length > 0) {
    console.log('\nErrors:');
    result.errors.forEach((err, idx) => {
      console.log(`  ${idx + 1}. ${err}`);
    });
  }

  if (result.comparisonIds.length > 0) {
    console.log('\nComparison IDs:');
    result.comparisonIds.forEach((id, idx) => {
      console.log(`  ${idx + 1}. ${id}`);
    });
  }

  console.log('\n================================================================================');
  process.exit(0);
}

main().catch((err) => {
  console.error('\n❌ Script failed:', err.message);
  console.error(err.stack);
  process.exit(1);
});
