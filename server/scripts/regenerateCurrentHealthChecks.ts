import { db } from "../db";
import { storage } from "../storage";
import { HealthCheckOrchestrator } from "../services/healthCheckOrchestrator";

const CURRENT_DOC_ID = 'c008290f-d4e3-4461-82a2-7c985dcffe3c';
const USER_ID = 'e85ec3b9-e354-4c49-9f68-194830e356af';

async function main() {
  console.log('Regenerating health checks for current document...\n');
  console.log(`Document ID: ${CURRENT_DOC_ID}`);
  console.log(`User ID: ${USER_ID}\n`);

  const orchestrator = new HealthCheckOrchestrator(storage);

  const result = await orchestrator.runForDocument(CURRENT_DOC_ID, {
    source: 'current_upload',
    userId: USER_ID,
    forceRerun: true
  });

  console.log('\nResult:');
  console.log(`  Success: ${result.success}`);
  console.log(`  Health checks created: ${result.healthChecksCreated}`);
  console.log(`  Health checks failed: ${result.healthChecksFailed}`);
  
  if (result.errors.length > 0) {
    console.log('\n  Errors:');
    result.errors.forEach((err, idx) => {
      console.log(`    ${idx + 1}. ${err}`);
    });
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Script failed:', err.message);
  console.error(err.stack);
  process.exit(1);
});
