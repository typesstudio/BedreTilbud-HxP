import { db } from './server/db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { ComparisonOrchestrator } from './server/services/comparisonOrchestrator';
import { DatabaseStorage } from './server/storage';

async function main() {
  // Use user with both current and offer documents
  const userId = 'e85ec3b9-e354-4c49-9f68-194830e356af';
  console.log(`Running comparison for user: ${userId} (hello@vyork.dk)`);
  
  const storage = new DatabaseStorage(db);
  const orchestrator = new ComparisonOrchestrator(storage);
  
  const result = await orchestrator.runForUser({
    userId,
    forceRerun: true // Force regeneration of existing comparisons
  });
  
  console.log('Comparison completed:', JSON.stringify(result, null, 2));
  process.exit(0);
}

main().catch(console.error);
