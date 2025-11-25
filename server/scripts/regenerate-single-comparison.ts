import { storage } from "../storage";
import { ComparisonOrchestrator } from "../services/comparisonOrchestrator";

async function regenerateComparison() {
  const userId = 'e85ec3b9-e354-4c49-9f68-194830e356af';
  const comparisonId = '0f0d18ad-174f-4ca5-a4bf-b70a7d64c1a1';
  
  console.log('[Regenerate] Starting comparison regeneration...');
  console.log('[Regenerate] User ID:', userId);
  console.log('[Regenerate] Comparison ID:', comparisonId);
  
  try {
    // Get the existing comparison to find the company
    const existing = await storage.getCompanyComparison(comparisonId);
    if (!existing) {
      console.error('[Regenerate] Comparison not found');
      process.exit(1);
    }
    
    console.log('[Regenerate] Found existing comparison');
    console.log('[Regenerate] Current Company:', existing.currentCompany);
    console.log('[Regenerate] Offer Company:', existing.offerCompany);
    
    // Run comparison orchestrator with forceRerun
    const orchestrator = new ComparisonOrchestrator(storage);
    const result = await orchestrator.runForUser({
      userId,
      forceRerun: true,
    });
    
    console.log('[Regenerate] Comparison regeneration completed');
    console.log('[Regenerate] Comparisons created:', result.comparisonsCreated);
    console.log('[Regenerate] Comparisons failed:', result.comparisonsFailed);
    console.log('[Regenerate] Skipped:', result.skipped);
    
    process.exit(0);
  } catch (error) {
    console.error('[Regenerate] Error:', error);
    process.exit(1);
  }
}

regenerateComparison();
