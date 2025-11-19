import { db } from "../db";
import { documents, offerSnapshots, healthChecks, companyComparisons, companies } from "@shared/schema";
import { eq, and, ilike, desc } from "drizzle-orm";
import { computeBestMatches } from "../services/deterministicMatcher";

// ========================================
// Configuration
// ========================================
const USER_ID = 'e85ec3b9-e354-4c49-9f68-194830e356af';
const OFFER_COMPANY_PATTERN = '%alm%'; // Use Alm. Brand which has offer data for this user

// ========================================
// Helper: Guess policy type from coverages
// ========================================
function guessPolicyTypeFromCoverages(whatsIncluded: any[]): string {
  if (!Array.isArray(whatsIncluded) || whatsIncluded.length === 0) {
    return 'ukendt';
  }

  const coverageNames = whatsIncluded
    .map(item => (item.coverage || '').toLowerCase())
    .join(' ');

  // Hus keywords
  const husKeywords = [
    'brand', 'bygningsbrand', 'bygningsbeskadigelse', 
    'råd', 'svamp', 'insekt', 'stikledning', 'kabel',
    'el-skade', 'bygning'
  ];
  
  // Indbo keywords
  const indboKeywords = [
    'indbo', 'cykel', 'ansvar tingskade', 'ansvar personskade',
    'id-tyveri', 'psykologisk krisehjælp', 'retshjælp',
    'gæstebud', 'lånte', 'ejede ting'
  ];
  
  // Ulykke keywords
  const ulykkeKeywords = [
    'invaliditet', 'dødsfald', 'behandlingsudgifter',
    'tyggeskade', 'tandskade', 'strakserstatning',
    'dobbelterstatning', 'krisehjælp ved ulykke'
  ];

  const husScore = husKeywords.filter(kw => coverageNames.includes(kw)).length;
  const indboScore = indboKeywords.filter(kw => coverageNames.includes(kw)).length;
  const ulykkeScore = ulykkeKeywords.filter(kw => coverageNames.includes(kw)).length;

  if (husScore > indboScore && husScore > ulykkeScore) return 'hus';
  if (indboScore > husScore && indboScore > ulykkeScore) return 'indbo';
  if (ulykkeScore > husScore && ulykkeScore > indboScore) return 'ulykke';

  return 'ukendt';
}

// ========================================
// Step 3.1: Resolve company ID
// ========================================
async function resolveOfferCompanyId(): Promise<string | null> {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`RESOLVING OFFER COMPANY`);
  console.log(`${'='.repeat(80)}`);
  
  const matchingCompanies = await db
    .select()
    .from(companies)
    .where(ilike(companies.name, OFFER_COMPANY_PATTERN));

  if (matchingCompanies.length === 0) {
    console.error(`❌ No companies found matching pattern: ${OFFER_COMPANY_PATTERN}`);
    return null;
  }

  console.log(`\nFound ${matchingCompanies.length} matching companies:`);
  matchingCompanies.forEach(c => {
    console.log(`  - ${c.id}: ${c.name}`);
  });

  // If multiple matches, try to find the one with recent documents for this user
  if (matchingCompanies.length > 1) {
    for (const company of matchingCompanies) {
      const docsWithCompany = await db
        .select()
        .from(documents)
        .where(
          and(
            eq(documents.userId, USER_ID),
            eq(documents.companyId, company.id),
            eq(documents.documentType, 'offer')
          )
        )
        .limit(1);

      if (docsWithCompany.length > 0) {
        console.log(`\n✅ Selected company (has documents): ${company.id} - ${company.name}`);
        return company.id;
      }
    }
  }

  const selected = matchingCompanies[0];
  console.log(`\n✅ Selected company: ${selected.id} - ${selected.name}`);
  return selected.id;
}

// ========================================
// Step A: Documents Overview
// ========================================
async function stepA_DocumentsOverview() {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`STEP A: DOCUMENTS OVERVIEW`);
  console.log(`${'='.repeat(80)}\n`);

  const docs = await db
    .select({
      document_id: documents.id,
      document_type: documents.documentType,
      file_name: documents.fileName,
      company_id: documents.companyId,
      company_name: companies.name,
      created_at: documents.createdAt,
    })
    .from(documents)
    .leftJoin(companies, eq(documents.companyId, companies.id))
    .where(eq(documents.userId, USER_ID))
    .orderBy(documents.createdAt);

  if (docs.length === 0) {
    console.log('❌ No documents found for this user');
    return;
  }

  console.table(
    docs.map(d => ({
      document_id: d.document_id.substring(0, 8),
      type: d.document_type,
      file_name: d.file_name,
      company: d.company_name || 'N/A',
      created_at: d.created_at?.toISOString().split('T')[0] || 'N/A'
    }))
  );

  console.log(`\nTotal documents: ${docs.length}`);
  console.log(`  - Current: ${docs.filter(d => d.document_type === 'current').length}`);
  console.log(`  - Offer: ${docs.filter(d => d.document_type === 'offer').length}`);
}

// ========================================
// Step B: Snapshots Matrix
// ========================================
async function stepB_SnapshotsMatrix() {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`STEP B: SNAPSHOTS MATRIX`);
  console.log(`${'='.repeat(80)}\n`);

  const snapshots = await db
    .select({
      snapshot_id: offerSnapshots.id,
      doc_type: documents.documentType,
      company_name: companies.name,
      policy_type: offerSnapshots.policyType,
      structured_policy: offerSnapshots.structuredPolicy,
    })
    .from(offerSnapshots)
    .innerJoin(documents, eq(offerSnapshots.documentId, documents.id))
    .leftJoin(companies, eq(offerSnapshots.companyId, companies.id))
    .where(eq(offerSnapshots.userId, USER_ID))
    .orderBy(documents.documentType, companies.name, offerSnapshots.policyType);

  if (snapshots.length === 0) {
    console.log('❌ No snapshots found for this user');
    return;
  }

  const matrix = snapshots.map(s => {
    let mainCoverageCount = 0;
    let additionalCoverageCount = 0;
    let firstCoverages: string[] = [];
    let hasStructuredPolicy = false;

    if (s.structured_policy) {
      hasStructuredPolicy = true;
      try {
        const structured = typeof s.structured_policy === 'string' 
          ? JSON.parse(s.structured_policy) 
          : s.structured_policy;
        
        const mainCoverages = structured?.coverageDetails?.mainCoverages || [];
        const additionalCoverages = structured?.coverageDetails?.additionalCoverages || [];
        
        mainCoverageCount = mainCoverages.length;
        additionalCoverageCount = additionalCoverages.length;
        
        firstCoverages = mainCoverages
          .slice(0, 2)
          .map((c: any) => c.name || 'unnamed')
          .filter(Boolean);
      } catch (error) {
        console.warn(`⚠️  Failed to parse structured_policy for snapshot ${s.snapshot_id.substring(0, 8)}`);
      }
    }

    return {
      snapshot_id: s.snapshot_id.substring(0, 8),
      doc_type: s.doc_type,
      company: (s.company_name || 'N/A').substring(0, 20),
      policy_type: s.policy_type,
      has_structured: hasStructuredPolicy ? '✓' : '✗',
      main_cov: mainCoverageCount,
      add_cov: additionalCoverageCount,
      first_coverages: firstCoverages.join(', ').substring(0, 40)
    };
  });

  console.table(matrix);

  console.log(`\nTotal snapshots: ${snapshots.length}`);
  console.log(`  - With structured_policy: ${matrix.filter(m => m.has_structured === '✓').length}`);
  console.log(`  - Without structured_policy: ${matrix.filter(m => m.has_structured === '✗').length}`);
  
  // Group by doc_type and policy_type
  const grouped = new Map<string, Map<string, number>>();
  snapshots.forEach(s => {
    const docType = s.doc_type || 'unknown';
    const policyType = s.policy_type || 'unknown';
    
    if (!grouped.has(docType)) {
      grouped.set(docType, new Map());
    }
    const policyMap = grouped.get(docType)!;
    policyMap.set(policyType, (policyMap.get(policyType) || 0) + 1);
  });

  console.log(`\nGrouped by document type and policy type:`);
  for (const [docType, policyMap] of Array.from(grouped.entries())) {
    console.log(`  ${docType}:`);
    for (const [policyType, count] of Array.from(policyMap.entries())) {
      console.log(`    - ${policyType}: ${count}`);
    }
  }
}

// ========================================
// Step C: Health Check Consistency
// ========================================
async function stepC_HealthCheckConsistency() {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`STEP C: HEALTH CHECK CONSISTENCY`);
  console.log(`${'='.repeat(80)}\n`);

  const healthCheckData = await db
    .select({
      hc_id: healthChecks.id,
      snapshot_id: offerSnapshots.id,
      doc_type: documents.documentType,
      company_name: companies.name,
      policy_type: offerSnapshots.policyType,
      result: healthChecks.result,
    })
    .from(healthChecks)
    .innerJoin(offerSnapshots, eq(healthChecks.snapshotId, offerSnapshots.id))
    .innerJoin(documents, eq(offerSnapshots.documentId, documents.id))
    .leftJoin(companies, eq(offerSnapshots.companyId, companies.id))
    .where(eq(healthChecks.userId, USER_ID))
    .orderBy(documents.documentType, offerSnapshots.policyType);

  if (healthCheckData.length === 0) {
    console.log('❌ No health checks found for this user');
    return;
  }

  let mismatchCount = 0;

  healthCheckData.forEach(hc => {
    const result = typeof hc.result === 'string' ? JSON.parse(hc.result) : hc.result;
    const whatsIncluded = result?.whatsIncluded || [];
    const guessedType = guessPolicyTypeFromCoverages(whatsIncluded);
    const dbType = hc.policy_type || 'unknown';
    
    const firstCoverages = whatsIncluded
      .slice(0, 3)
      .map((item: any) => item.coverage || 'unnamed')
      .join(', ')
      .substring(0, 60);

    const isMismatch = guessedType !== 'ukendt' && guessedType !== dbType;
    
    console.log(
      `[HEALTH] snapshot=${hc.snapshot_id.substring(0, 8)} ` +
      `doc_type=${hc.doc_type} ` +
      `company=${(hc.company_name || 'N/A').substring(0, 20).padEnd(20)} ` +
      `policy_type(db)=${dbType.padEnd(6)} ` +
      `policy_type(guessed)=${guessedType.padEnd(6)} ` +
      `whatsIncludedCount=${whatsIncluded.length} ` +
      `firstCoverages=[${firstCoverages}]`
    );

    if (isMismatch) {
      console.log(`  ⚠️  MISMATCH: snapshot ${hc.snapshot_id.substring(0, 8)} is typed as '${dbType}' but looks like '${guessedType}' from coverages`);
      mismatchCount++;
    }
  });

  console.log(`\nTotal health checks: ${healthCheckData.length}`);
  console.log(`Mismatches detected: ${mismatchCount}`);
}

// ========================================
// Step D: Deterministic Matcher Output
// ========================================
async function stepD_MatcherOutput(offerCompanyId: string) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`STEP D: DETERMINISTIC MATCHER OUTPUT`);
  console.log(`${'='.repeat(80)}\n`);

  // Load current snapshots (all current docs for this user)
  const currentSnapshots = await db
    .select()
    .from(offerSnapshots)
    .innerJoin(documents, eq(offerSnapshots.documentId, documents.id))
    .where(
      and(
        eq(offerSnapshots.userId, USER_ID),
        eq(documents.documentType, 'current')
      )
    );

  // Load offer snapshots for the specific company
  const offerSnapshotsData = await db
    .select()
    .from(offerSnapshots)
    .innerJoin(documents, eq(offerSnapshots.documentId, documents.id))
    .where(
      and(
        eq(offerSnapshots.userId, USER_ID),
        eq(documents.documentType, 'offer'),
        eq(offerSnapshots.companyId, offerCompanyId)
      )
    );

  console.log(`Current snapshots loaded: ${currentSnapshots.length}`);
  console.log(`Offer snapshots loaded: ${offerSnapshotsData.length}`);

  if (currentSnapshots.length === 0 || offerSnapshotsData.length === 0) {
    console.log('⚠️  Cannot run matcher: missing current or offer snapshots');
    return { pairs: [] };
  }

  // Convert to Policy-like objects for matcher
  const currentPolicies = currentSnapshots.map(s => ({
    id: s.offer_snapshots.id,
    policyType: s.offer_snapshots.policyType,
    coverageDetails: s.offer_snapshots.coverageDetails,
    structuredPolicy: s.offer_snapshots.structuredPolicy,
  }));

  const offerPolicies = offerSnapshotsData.map(s => ({
    id: s.offer_snapshots.id,
    policyType: s.offer_snapshots.policyType,
    coverageDetails: s.offer_snapshots.coverageDetails,
    structuredPolicy: s.offer_snapshots.structuredPolicy,
  }));

  console.log(`\nCalling computeBestMatches...`);
  const matchResult = computeBestMatches(currentPolicies as any, offerPolicies as any);

  console.log(`\n[MATCHES]`);
  if (matchResult.pairs.length === 0) {
    console.log('  ⚠️  No matched pairs found');
  } else {
    matchResult.pairs.forEach(pair => {
      console.log(
        `  policyType=${pair.policyType.padEnd(6)} ` +
        `currentSnapshot=${pair.currentPolicyId?.substring(0, 8) || 'N/A'} ` +
        `offerSnapshot=${pair.offerPolicyId?.substring(0, 8) || 'N/A'}`
      );
    });
  }

  if (matchResult.dataQualityError) {
    console.log(`\n❌ DATA QUALITY ERROR: ${matchResult.dataQualityError}`);
  }

  console.log(`\nTotal matched pairs: ${matchResult.pairs.length}`);
  console.log(`Unmatched current: ${matchResult.unmatchedCurrent.length}`);
  console.log(`Unmatched offer: ${matchResult.unmatchedOffer.length}`);

  // Check for missing expected types
  const expectedTypes = ['hus', 'indbo', 'ulykke'];
  const matchedTypes = new Set(matchResult.pairs.map((p: any) => p.policyType as string));
  const missingTypes = expectedTypes.filter(t => !matchedTypes.has(t));

  if (missingTypes.length > 0) {
    console.log(`\n⚠️  WARNING: Expected policy types missing from matches: ${missingTypes.join(', ')}`);
  }

  return matchResult;
}

// ========================================
// Step E: ComparisonAgent Input
// ========================================
async function stepE_ComparisonAgentInput(matchResult: any, offerCompanyId: string) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`STEP E: COMPARISON AGENT INPUT`);
  console.log(`${'='.repeat(80)}\n`);

  if (!matchResult || matchResult.pairs.length === 0) {
    console.log('⚠️  No matched pairs to build ComparisonAgent input');
    return;
  }

  // Load health checks for all involved snapshots
  const allSnapshotIds = [
    ...matchResult.pairs.map((p: any) => p.currentPolicyId),
    ...matchResult.pairs.map((p: any) => p.offerPolicyId),
  ];

  const healthCheckResults = await db
    .select()
    .from(healthChecks)
    .where(eq(healthChecks.userId, USER_ID));

  const healthCheckMap = new Map();
  healthCheckResults.forEach(hc => {
    if (hc.snapshotId) {
      healthCheckMap.set(hc.snapshotId, hc.result);
    }
  });

  // Build policyComparisons array (simplified version of what orchestrator does)
  const policyComparisons = matchResult.pairs.map((pair: any) => {
    const currentHealthCheck = healthCheckMap.get(pair.currentPolicyId);
    const offerHealthCheck = healthCheckMap.get(pair.offerPolicyId);

    return {
      policyType: pair.policyType,
      label: pair.label,
      _healthCheckData: {
        current: currentHealthCheck || null,
        offer: offerHealthCheck || null,
      },
      currentPolicyId: pair.currentPolicyId,
      offerPolicyId: pair.offerPolicyId,
    };
  });

  console.log(`Built ComparisonAgent input with ${policyComparisons.length} policy comparisons:\n`);

  policyComparisons.forEach((pc: any) => {
    const currentHasHealthCheck = pc._healthCheckData.current !== null ? '✓' : '✗';
    const offerHasHealthCheck = pc._healthCheckData.offer !== null ? '✓' : '✗';
    
    console.log(
      `  policyType=${pc.policyType.padEnd(6)} ` +
      `currentHealthCheck=${currentHasHealthCheck} ` +
      `offerHealthCheck=${offerHasHealthCheck} ` +
      `currentId=${pc.currentPolicyId.substring(0, 8)} ` +
      `offerId=${pc.offerPolicyId.substring(0, 8)}`
    );
  });

  console.log(`\nFull agent input structure (depth limited for readability):`);
  const agentInput = {
    context: {
      userId: USER_ID,
      offerCompanyId: offerCompanyId,
    },
    policyComparisons: policyComparisons.map((pc: any) => ({
      policyType: pc.policyType,
      label: pc.label,
      hasCurrentHealthCheck: pc._healthCheckData.current !== null,
      hasOfferHealthCheck: pc._healthCheckData.offer !== null,
    })),
  };

  console.dir(agentInput, { depth: 3 });
}

// ========================================
// Step F: Comparison JSON in DB
// ========================================
async function stepF_ComparisonJSON(offerCompanyId: string) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`STEP F: COMPARISON JSON IN DATABASE`);
  console.log(`${'='.repeat(80)}\n`);

  const comparisons = await db
    .select()
    .from(companyComparisons)
    .where(
      and(
        eq(companyComparisons.userId, USER_ID),
        eq(companyComparisons.offerCompany, offerCompanyId),
        eq(companyComparisons.status, 'completed')
      )
    )
    .orderBy(desc(companyComparisons.createdAt))
    .limit(1);

  if (comparisons.length === 0) {
    console.log('❌ No completed comparisons found for this user and offer company');
    return;
  }

  const comparison = comparisons[0];
  const comparisonJSON = typeof comparison.comparisonJSON === 'string'
    ? JSON.parse(comparison.comparisonJSON)
    : comparison.comparisonJSON;

  console.log(`Comparison ID: ${comparison.id}`);
  console.log(`Status: ${comparison.status}`);
  console.log(`Created at: ${comparison.createdAt?.toISOString()}`);
  console.log(`Updated at: ${comparison.updatedAt?.toISOString()}`);

  const policyComparisons = comparisonJSON?.policyComparisons || [];
  console.log(`\nPolicy comparisons count: ${policyComparisons.length}`);

  if (policyComparisons.length > 0) {
    console.log(`\nPer-policy details:`);
    policyComparisons.forEach((pc: any) => {
      const rowsCount = pc.coverageComparison?.rows?.length || 0;
      console.log(
        `  policyType=${(pc.policyType || 'unknown').padEnd(6)} ` +
        `coverageRows=${rowsCount} ` +
        `label="${pc.label || 'N/A'}"`
      );
    });
  }

  console.log(`\nSummary for ComparisonJSON:`);
  console.log(JSON.stringify({
    id: comparison.id.substring(0, 8),
    status: comparison.status,
    policyCount: policyComparisons.length,
    policies: policyComparisons.map((p: any) => ({
      policyType: p.policyType,
      rows: p.coverageComparison?.rows?.length || 0,
    })),
  }, null, 2));
}

// ========================================
// Main Entry Point
// ========================================
async function main() {
  console.log(`\n${'█'.repeat(80)}`);
  console.log(`█  DEBUG COMPARISON PIPELINE - BedreTilbud`);
  console.log(`█  User: ${USER_ID}`);
  console.log(`█  Offer Company Pattern: ${OFFER_COMPANY_PATTERN}`);
  console.log(`${'█'.repeat(80)}\n`);

  try {
    // Step 3.1: Resolve company ID
    const offerCompanyId = await resolveOfferCompanyId();
    if (!offerCompanyId) {
      console.error('\n❌ FATAL: Could not resolve offer company ID. Aborting.');
      process.exit(1);
    }

    // Step A: Documents Overview
    await stepA_DocumentsOverview();

    // Step B: Snapshots Matrix
    await stepB_SnapshotsMatrix();

    // Step C: Health Check Consistency
    await stepC_HealthCheckConsistency();

    // Step D: Matcher Output
    const matchResult = await stepD_MatcherOutput(offerCompanyId);

    // Step E: ComparisonAgent Input
    await stepE_ComparisonAgentInput(matchResult, offerCompanyId);

    // Step F: Comparison JSON in DB
    await stepF_ComparisonJSON(offerCompanyId);

    console.log(`\n${'█'.repeat(80)}`);
    console.log(`█  DEBUG COMPLETE`);
    console.log(`${'█'.repeat(80)}\n`);

  } catch (error) {
    console.error('\n❌ FATAL ERROR:', error);
    console.error(error instanceof Error ? error.stack : String(error));
    process.exit(1);
  } finally {
    // Close DB connection
    process.exit(0);
  }
}

// Run the script
main();
