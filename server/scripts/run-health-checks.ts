import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from '../../shared/schema';
import { DatabaseStorage } from '../storage';
import { HealthCheckOrchestrator } from '../services/healthCheckOrchestrator';

const DOCUMENT_ID = 'c008290f-d4e3-4461-82a2-7c985dcffe3c'; // User Insurance.pdf (current)
const USER_ID = 'e85ec3b9-e354-4c49-9f68-194830e356af';

async function runHealthChecks() {
  try {
    console.log(`\n🔄 Running health checks for document: ${DOCUMENT_ID}\n`);
    
    const sql = neon(process.env.DATABASE_URL!);
    const db = drizzle(sql, { schema });
    const storage = new DatabaseStorage(db);
    const orchestrator = new HealthCheckOrchestrator(storage);
    
    const result = await orchestrator.runForDocument(DOCUMENT_ID, {
      source: 'manual_script',
      userId: USER_ID,
      forceRerun: true
    });
    
    console.log('\n✅ Health Check Orchestration Complete!\n');
    console.log('Results:', JSON.stringify(result, null, 2));
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

runHealthChecks();
