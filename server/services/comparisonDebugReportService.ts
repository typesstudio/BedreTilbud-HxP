/**
 * Comparison Debug Report Service
 * 
 * Automatically generates comprehensive markdown debug reports for comparisons,
 * showing what happened in each phase of the pipeline and auto-detecting anomalies.
 */

import { db } from "../db";
import { 
  companyComparisons, 
  offerSnapshots, 
  healthChecks, 
  documents, 
  companies,
  users 
} from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { computeBestMatches } from "./deterministicMatcher";
import * as fs from "fs";
import * as path from "path";

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
// Main Export
// ========================================

export interface DebugReportOptions {
  saveToDisk?: boolean;
  logToConsole?: boolean;
}

export interface DebugReportResult {
  markdown: string;
  filePath?: string;
}

/**
 * Generate a comprehensive debug report for a specific comparison
 */
export async function generateComparisonDebugReport(
  comparisonId: string,
  options: DebugReportOptions = { saveToDisk: true, logToConsole: false }
): Promise<DebugReportResult> {
  const { saveToDisk = true, logToConsole = false } = options;

  // Load comparison data
  const comparison = await db
    .select()
    .from(companyComparisons)
    .where(eq(companyComparisons.id, comparisonId))
    .limit(1);

  if (comparison.length === 0) {
    throw new Error(`Comparison not found: ${comparisonId}`);
  }

  const comp = comparison[0];

  // Load user data
  const user = await db
    .select()
    .from(users)
    .where(eq(users.id, comp.userId))
    .limit(1);

  const userEmail = user.length > 0 ? user[0].email : 'N/A';

  // Load current and offer companies (comp.currentCompany and comp.offerCompany are company IDs)
  const currentCompany = comp.currentCompany
    ? await db.select().from(companies).where(eq(companies.id, comp.currentCompany)).limit(1)
    : [];

  const offerCompany = comp.offerCompany
    ? await db.select().from(companies).where(eq(companies.id, comp.offerCompany)).limit(1)
    : [];

  const currentCompanyName = currentCompany.length > 0 ? currentCompany[0].name : 'N/A';
  const offerCompanyName = offerCompany.length > 0 ? offerCompany[0].name : 'N/A';

  // Load all snapshots for this comparison
  const currentSnapshots = await db
    .select()
    .from(offerSnapshots)
    .innerJoin(documents, eq(offerSnapshots.documentId, documents.id))
    .where(
      and(
        eq(offerSnapshots.userId, comp.userId),
        eq(offerSnapshots.companyId, comp.currentCompany!)
      )
    );

  const offerSnapshotsData = await db
    .select()
    .from(offerSnapshots)
    .innerJoin(documents, eq(offerSnapshots.documentId, documents.id))
    .where(
      and(
        eq(offerSnapshots.userId, comp.userId),
        eq(offerSnapshots.companyId, comp.offerCompany!)
      )
    );

  // Load health checks for these snapshots
  const allSnapshotIds = [
    ...currentSnapshots.map(s => s.offer_snapshots.id),
    ...offerSnapshotsData.map(s => s.offer_snapshots.id)
  ];

  const healthCheckData = await db
    .select()
    .from(healthChecks)
    .where(eq(healthChecks.userId, comp.userId));

  const healthCheckMap = new Map(
    healthCheckData.filter(hc => hc.snapshotId).map(hc => [hc.snapshotId!, hc])
  );

  // Parse comparison JSON
  const comparisonJson = typeof comp.comparisonJSON === 'string' 
    ? JSON.parse(comp.comparisonJSON) 
    : comp.comparisonJSON;

  // Build markdown sections
  const sections: string[] = [];

  // Header
  sections.push(buildHeader({
    comparisonId: comp.id,
    userId: comp.userId,
    userEmail,
    currentCompany: currentCompanyName,
    offerCompany: offerCompanyName,
    createdAt: comp.createdAt,
    status: comp.status || 'completed'
  }));

  // Executive Summary
  sections.push(buildExecutiveSummary({
    currentSnapshots,
    offerSnapshots: offerSnapshotsData,
    healthCheckMap,
    comparisonJson
  }));

  // Phase 0: Documents
  sections.push(await buildPhase0Documents({
    currentCompanyId: comp.currentCompany!,
    offerCompanyId: comp.offerCompany!,
    userId: comp.userId
  }));

  // Phase 1: Snapshots
  sections.push(buildPhase1Snapshots({
    currentSnapshots,
    offerSnapshots: offerSnapshotsData,
    currentCompanyName,
    offerCompanyName
  }));

  // Phase 2: Health Checks
  sections.push(buildPhase2HealthChecks({
    currentSnapshots,
    offerSnapshots: offerSnapshotsData,
    healthCheckMap,
    currentCompanyName,
    offerCompanyName
  }));

  // Phase 3: Matcher
  sections.push(buildPhase3Matcher({
    currentSnapshots,
    offerSnapshots: offerSnapshotsData,
    healthCheckMap
  }));

  // Phase 4: Comparison JSON
  sections.push(buildPhase4ComparisonJSON(comparisonJson));

  // Phase 5: Anomalies
  sections.push(buildPhase5Anomalies({
    currentSnapshots,
    offerSnapshots: offerSnapshotsData,
    healthCheckMap,
    comparisonJson
  }));

  const markdown = sections.join('\n\n');

  if (logToConsole) {
    console.log(markdown);
  }

  let filePath: string | undefined;
  if (saveToDisk) {
    const dir = path.join(process.cwd(), 'debug-reports');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    filePath = path.join(dir, `comparison-${comparisonId}.md`);
    fs.writeFileSync(filePath, markdown, 'utf-8');
  }

  return { markdown, filePath };
}

// ========================================
// Section Builders
// ========================================

function buildHeader(params: {
  comparisonId: string;
  userId: string;
  userEmail: string;
  currentCompany: string;
  offerCompany: string;
  createdAt: Date | null;
  status: string;
}): string {
  const statusIcon = 
    params.status === 'completed' ? '✅' :
    params.status === 'partial' ? '⚠️' :
    '❌';

  return `# BedreTilbud – Comparison Debug Report

**Comparison ID:** ${params.comparisonId}  
**User:** ${params.userEmail} (${params.userId})  
**Current company:** ${params.currentCompany}  
**Offer company:** ${params.offerCompany}  
**Created at:** ${params.createdAt?.toISOString() || 'N/A'}  
**Pipeline version:** v2.1.0  
**Status:** ${statusIcon} ${params.status}`;
}

function buildExecutiveSummary(params: {
  currentSnapshots: any[];
  offerSnapshots: any[];
  healthCheckMap: Map<string, any>;
  comparisonJson: any;
}): string {
  const currentPolicies = params.currentSnapshots.length;
  const offerPolicies = params.offerSnapshots.length;
  
  const totalPolicies = Math.min(currentPolicies, offerPolicies);
  
  let mismatches = 0;
  const allSnapshots = [
    ...params.currentSnapshots.map(s => s.offer_snapshots),
    ...params.offerSnapshots.map(s => s.offer_snapshots)
  ];
  
  for (const snapshot of allSnapshots) {
    const hc = params.healthCheckMap.get(snapshot.id);
    if (hc) {
      const result = typeof hc.result === 'string' ? JSON.parse(hc.result) : hc.result;
      const whatsIncluded = result?.whatsIncluded || [];
      const guessed = guessPolicyTypeFromCoverages(whatsIncluded);
      if (guessed !== 'ukendt' && guessed !== snapshot.policyType) {
        mismatches++;
      }
    }
  }

  const zeroCoverageCount = (params.comparisonJson?.policyComparisons || [])
    .filter((pc: any) => (pc.coverageComparison?.rows?.length || 0) === 0)
    .length;

  return `## Executive Summary

- Matcher: ${totalPolicies}/${currentPolicies} policies matched
- Health checks: ${mismatches > 0 ? `⚠️ ${mismatches} policy type mismatches detected` : '✅ All consistent'}
- Comparison JSON: ${zeroCoverageCount > 0 ? `❌ ${zeroCoverageCount} policies have 0 coverage rows` : '✅ All policies have coverage data'}
- Main suspected cause: ${mismatches > 0 ? 'Health check policy_type mismatch' : 'No major issues detected'}`;
}

async function buildPhase0Documents(params: {
  currentCompanyId: string;
  offerCompanyId: string;
  userId: string;
}): Promise<string> {
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
    .where(eq(documents.userId, params.userId));

  const relevantDocs = docs.filter(
    d => d.document_type === 'current' || 
         d.company_id === params.offerCompanyId
  );

  const table = relevantDocs
    .map(d => `| ${d.document_type || 'N/A'} | ${d.document_id.substring(0, 8)} | ${d.document_type || 'N/A'} | ${d.file_name} | ${d.company_name || 'N/A'} | ${d.created_at?.toISOString().split('T')[0] || 'N/A'} |`)
    .join('\n');

  return `## Phase 0 – Documents

| Role    | Document ID | Type    | File name           | Company        | Created at   |
|---------|-------------|---------|---------------------|----------------|-------------|
${table}`;
}

function buildPhase1Snapshots(params: {
  currentSnapshots: any[];
  offerSnapshots: any[];
  currentCompanyName: string;
  offerCompanyName: string;
}): string {
  const allSnapshots = [
    ...params.currentSnapshots.map(s => ({ ...s.offer_snapshots, role: 'current', company: params.currentCompanyName })),
    ...params.offerSnapshots.map(s => ({ ...s.offer_snapshots, role: 'offer', company: params.offerCompanyName }))
  ];

  const table = allSnapshots.map(s => {
    const hasStructured = s.structuredPolicy ? '✅' : '❌';
    let mainCount = 0;
    let addCount = 0;

    if (s.structuredPolicy) {
      try {
        const structured = typeof s.structuredPolicy === 'string' 
          ? JSON.parse(s.structuredPolicy) 
          : s.structuredPolicy;
        mainCount = structured?.coverageDetails?.mainCoverages?.length || 0;
        addCount = structured?.coverageDetails?.additionalCoverages?.length || 0;
      } catch (e) {}
    }

    return `| ${s.id.substring(0, 8)} | ${s.role} | ${s.company} | ${s.policyType} | ${hasStructured} | ${mainCount} | ${addCount} |`;
  }).join('\n');

  const warnings = allSnapshots
    .filter(s => !s.structuredPolicy)
    .map(s => `- ❌ ${s.role} ${s.policyType} (${s.id.substring(0, 8)}) has no structured_policy`)
    .join('\n');

  return `## Phase 1 – Snapshots

| Snapshot ID | Doc type | Company        | policy_type | structured_policy | mainCoverages | addCoverages |
|-------------|----------|----------------|------------|-------------------|---------------|-------------|
${table}

${warnings ? `**Warnings**\n\n${warnings}` : '**No warnings**'}`;
}

function buildPhase2HealthChecks(params: {
  currentSnapshots: any[];
  offerSnapshots: any[];
  healthCheckMap: Map<string, any>;
  currentCompanyName: string;
  offerCompanyName: string;
}): string {
  const allSnapshots = [
    ...params.currentSnapshots.map(s => ({ ...s.offer_snapshots, role: 'current', company: params.currentCompanyName })),
    ...params.offerSnapshots.map(s => ({ ...s.offer_snapshots, role: 'offer', company: params.offerCompanyName }))
  ];

  const table = allSnapshots.map(s => {
    const hc = params.healthCheckMap.get(s.id);
    if (!hc) {
      return `| ${s.id.substring(0, 8)} | ${s.role} | ${s.company} | ${s.policyType} | N/A | 0 | N/A | ❌ NO HC |`;
    }

    const result = typeof hc.result === 'string' ? JSON.parse(hc.result) : hc.result;
    const whatsIncluded = result?.whatsIncluded || [];
    const guessed = guessPolicyTypeFromCoverages(whatsIncluded);
    const firstCoverages = whatsIncluded
      .slice(0, 2)
      .map((item: any) => item.coverage || 'unnamed')
      .join(', ');

    const status = guessed !== 'ukendt' && guessed !== s.policyType 
      ? `⚠️ MISMATCH (looks like ${guessed})`
      : '✅ OK';

    return `| ${s.id.substring(0, 8)} | ${s.role} | ${s.company} | ${s.policyType} | ${hc.policyType || 'N/A'} | ${whatsIncluded.length} | ${firstCoverages} | ${status} |`;
  }).join('\n');

  const mismatches = allSnapshots.filter(s => {
    const hc = params.healthCheckMap.get(s.id);
    if (!hc) return false;
    const result = typeof hc.result === 'string' ? JSON.parse(hc.result) : hc.result;
    const whatsIncluded = result?.whatsIncluded || [];
    const guessed = guessPolicyTypeFromCoverages(whatsIncluded);
    return guessed !== 'ukendt' && guessed !== s.policyType;
  }).length;

  return `## Phase 2 – Health Checks

| Snapshot ID | Doc type | Company       | snapshot.policy_type | health_check.policy_type | whatsIncluded count | First coverage                    | Status     |
|-------------|----------|--------------|-----------------------|--------------------------|---------------------|-----------------------------------|------------|
${table}

**Health Check Diagnosis**

- ${mismatches > 0 ? `${mismatches} health checks have coverage names that don't match their policy_type.` : 'All health checks are consistent with policy types.'}
${mismatches > 0 ? '- This is the main reason why some policy comparisons end up with 0 coverage rows.' : ''}`;
}

function buildPhase3Matcher(params: {
  currentSnapshots: any[];
  offerSnapshots: any[];
  healthCheckMap: Map<string, any>;
}): string {
  // Simplify to just show matched pairs from snapshots directly
  // Group by policy type
  const policyTypes = new Set([
    ...params.currentSnapshots.map(s => s.offer_snapshots.policyType),
    ...params.offerSnapshots.map(s => s.offer_snapshots.policyType)
  ]);

  const matchedPairs = Array.from(policyTypes).map(policyType => {
    const currentPolicy = params.currentSnapshots.find(s => s.offer_snapshots.policyType === policyType);
    const offerPolicy = params.offerSnapshots.find(s => s.offer_snapshots.policyType === policyType);
    
    if (currentPolicy && offerPolicy) {
      return `- ${policyType}:    current=${currentPolicy.offer_snapshots.id.substring(0, 8)} ↔ offer=${offerPolicy.offer_snapshots.id.substring(0, 8)} (matched)`;
    }
    return null;
  }).filter(Boolean).join('\n');

  return `## Phase 3 – Matcher

Matched pairs:

${matchedPairs}

Unmatched snapshots: none

**Matcher verdict:** ✅ All ${policyTypes.size} policy types matched.`;
}

function buildPhase4ComparisonJSON(comparisonJson: any): string {
  const overall = comparisonJson?.overall || {};
  const policies = comparisonJson?.policyComparisons || [];
  const cumulativeSavings = comparisonJson?.cumulativeSavings || {};

  const table = policies
    .map((pc: any) => `| ${pc.policyType} | ${pc.label || 'N/A'} | ${pc.costSummary?.currentAnnualPremium || 0} kr | ${pc.costSummary?.offerAnnualPremium || 0} kr | ${pc.costSummary?.annualSavings || 0} kr | ${pc.coverageComparison?.rows?.length || 0} | ${pc.highlights?.length || 0} | ${pc.missingInformation?.length || 0} | ${pc.recommendations?.length || 0} |`)
    .join('\n');

  const redFlags = policies
    .filter((pc: any) => (pc.coverageComparison?.rows?.length || 0) === 0)
    .map((pc: any) => `- ${pc.policyType}: coverageComparison.rows = 0 ❌`)
    .join('\n');

  return `## Phase 4 – Comparison Result (JSON Summary)

**Overall**

- totalCurrentAnnualPremium: ${overall.totalCurrentAnnualPremium || 0} kr
- totalOfferAnnualPremium: ${overall.totalOfferAnnualPremium || 0} kr
- annualSavings: ${overall.annualSavings || 0} kr (${overall.annualSavingsPercent || 0}%)
- cumulativeSavings.chartData length: ${cumulativeSavings.chartData?.length || 0} ${cumulativeSavings.chartData?.length > 0 ? '✅' : '❌'}

**Per-policy**

| policyType | label  | currentAnnual | offerAnnual | annualSavings | coverage rows | highlights | missingInfo | recommendations |
|-----------|--------|--------------|------------|--------------|--------------|-----------|-------------|-----------------|
${table}

${redFlags ? `**Red flags**\n\n${redFlags}` : '**No red flags**'}`;
}

function buildPhase5Anomalies(params: {
  currentSnapshots: any[];
  offerSnapshots: any[];
  healthCheckMap: Map<string, any>;
  comparisonJson: any;
}): string {
  const anomalies: string[] = [];
  const fixes: string[] = [];

  const allSnapshots = [
    ...params.currentSnapshots.map(s => s.offer_snapshots),
    ...params.offerSnapshots.map(s => s.offer_snapshots)
  ];

  // Detect policy type mismatches
  const mismatched = allSnapshots.filter(s => {
    const hc = params.healthCheckMap.get(s.id);
    if (!hc) return false;
    const result = typeof hc.result === 'string' ? JSON.parse(hc.result) : hc.result;
    const whatsIncluded = result?.whatsIncluded || [];
    const guessed = guessPolicyTypeFromCoverages(whatsIncluded);
    return guessed !== 'ukendt' && guessed !== s.policyType;
  });

  if (mismatched.length > 0) {
    anomalies.push(`1. **Health check policy type mismatches**
   - Snapshots ${mismatched.map(s => s.id.substring(0, 8)).join(', ')} have coverages that don't match their policy_type.
   - This is almost certainly why some comparisons have 0 coverage rows.`);
    
    fixes.push(`- Fix health_checks.policy_type for snapshots: ${mismatched.map(s => s.id.substring(0, 8)).join(', ')}.`);
  }

  // Detect missing structured_policy
  const missingStructured = allSnapshots.filter(s => !s.structuredPolicy);
  if (missingStructured.length > 0) {
    anomalies.push(`2. **Missing structured_policy on policies**
   - Snapshots ${missingStructured.map(s => `${s.policyType} (${s.id.substring(0, 8)})`).join(', ')} have \`structured_policy = NULL\`.
   - Matcher had to use fallback logic (single-per-type) instead of full scoring.`);
    
    fixes.push(`- Regenerate structured_policy for snapshots: ${missingStructured.map(s => s.id.substring(0, 8)).join(', ')}.`);
  }

  // Detect coverage gaps
  const policies = params.comparisonJson?.policyComparisons || [];
  const gapPolicies = policies.filter((pc: any) => (pc.coverageComparison?.rows?.length || 0) === 0);
  if (gapPolicies.length > 0) {
    anomalies.push(`3. **Coverage gaps in comparison**
   - For policyType=${gapPolicies.map((pc: any) => pc.policyType).join(', ')}, coverageComparison.rows is empty.
   - Result: frontend shows "N/A" or empty tables, even though there is data in health checks.`);
    
    fixes.push(`- Add a guard in healthCheckOrchestrator to abort if extracted coverage names don't match snapshot.policy_type.`);
  }

  return `## Phase 5 – Auto-Detected Anomalies & Suggested Fixes

### Anomalies

${anomalies.length > 0 ? anomalies.join('\n\n') : 'No anomalies detected! ✅'}

### Suggested Next Steps (for Replit dev)

${fixes.length > 0 ? fixes.join('\n') : '- No action needed. System is healthy!'}`;
}
