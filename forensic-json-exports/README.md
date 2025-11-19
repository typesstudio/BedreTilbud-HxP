# Forensic JSON Export - BedreTilbud AI Pipeline Data

**Export Date**: November 19, 2025  
**Test User**: hello@vyork.dk (ID: e85ec3b9-e354-4c49-9f68-194830e356af)  
**Purpose**: Complete JSON data from all 4 phases of the AI pipeline for expert analysis

---

## 📁 File Structure

### Phase 1: Structured Policy Extraction (Policy Extractor)

**Current Policies (User's existing insurance)**:
- ✅ `current_hus_structured_policy.json` - Privatsikring Fritidshus (8.734,59 kr/år)
- ❌ `current_indbo_structured_policy.json` - **NOT AVAILABLE** (missing in database)
- ❌ `current_ulykke_structured_policy.json` - **NOT AVAILABLE** (missing in database)

**Offer Policies (From Lærerstandens Brandforsikring)**:
- ✅ `offer_hus_structured_policy.json` - Fritidshusforsikring (offer #4400104896672/000)
- ✅ `offer_indbo_structured_policy.json` - Indboforsikring (offer #3000104896671/000)
- ✅ `offer_ulykke_structured_policy.json` - Ulykkesforsikring (offer #2000104896673/000, 995,10 kr/år)

**Schema**: Phase 1 extracts pure OCR data into structured JSON with:
- `meta`: Index year, raw policy type label
- `company`, `policyName`, `policyType`, `offerNumber`, `annualPremium`
- `coverageDetails.mainCoverages[]`: Array of coverage items with `name`, `limit`, `deductible`, `included`
- `coverageDetails.additionalCoverages[]`: Extra coverage items
- `defaultDeductible`: Policy-wide default

---

### Phase 2: Health Check Analysis (Health Check Analyst)

**Current Policies**:
- ✅ `current_hus_health_check.json` - ⚠️ **DATA QUALITY ISSUE**: Contains ulykke-related coverage (mislabeled)
- ✅ `current_indbo_health_check.json` - Correct indbo health check (score: 7/10)
- ❌ `current_ulykke_health_check.json` - **NOT AVAILABLE**

**Offer Policies**:
- ✅ `offer_hus_health_check.json` - Fritidshus health check
- ✅ `offer_indbo_health_check.json` - Indbo health check (score: 7/10)
- ✅ `offer_ulykke_health_check.json` - ⚠️ **DATA QUALITY ISSUE**: Contains indbo-related coverage (mislabeled)

**Schema**: Phase 2 generates UI-ready health check JSON with:
- `overallScore`: 0-10 health rating
- `scoreExplanation`: Danish explanation text
- `highlights[]`: 4 selling points with icons (clock, zap, star, check-circle)
- `whatsIncluded[]`: 1:1 coverage mapping with `coverage`, `value`, `status` (success/warning/error/neutral), `attributes.sum`, `attributes.selvrisiko`
- `missingInformation`: Data gaps categorized
- `potentialSavings`: Conservative/realistic/optimistic estimates
- `cumulativeSavings`: 10-year savings projection with chartData (120 months)

---

### Phase 4: Comparison Generation (Comparison Agent)

- ✅ `comparison_lb_vs_privatsikring.json` - Alm. Brand vs Lærerstandens Brandforsikring comparison

**Schema**: Phase 4 generates complete comparison JSON with:
- `overall`: Total savings summary, global highlights, per-policy summary
- `policyComparisons[]`: Array of policy-by-policy comparisons
  - `costSummary`: Premium comparison and savings
  - `highlights[]`: Top insights (price, new coverage, higher limits, lower deductibles, removed coverage)
  - `coverageComparison.rows[]`: Side-by-side coverage table with current vs offer
  - `recommendations[]`: AI-generated recommendations
  - `missingInformation[]`: Questions to ask insurance company
- `cumulativeSavings`: 10-year savings chart with monthly breakdown

---

## 🔍 Data Quality Notes

### Issues Found

1. **Missing Current Policies**:
   - Test user only has **current Hus** policy in database
   - **Current Indbo** and **Current Ulykke** policies are missing
   - This limits the comparison to only Hus policies

2. **Mislabeled Health Checks**:
   - `current_hus_health_check.json` contains ulykke-related coverages ("Invaliditet ved ulykke", "Krisehjælp", "Tandskade")
   - `offer_ulykke_health_check.json` contains indbo-related coverages ("Indbo BASIS", "Cykel", "Ansvar tingskade/personskade")
   - Likely caused by incorrect FK joins in health_checks table or snapshot_id mismatch

3. **Duplicate Offer Snapshots**:
   - Database contains 5 versions of offer_hus and 5 versions of offer_indbo
   - Exported files use the most complete version (with indexYear="2025" and proper meta)

4. **Missing Annual Premiums**:
   - Many offer policies have `annualPremium: null`
   - This prevents accurate savings calculations in health checks

---

## 🧪 Anti-Hallucination Architecture

This data demonstrates the **deterministic code-first approach**:

1. **Phase 1 (PolicyExtractor)**: Pure extraction preserves exact deductible strings (`"2.834 kr"`, `"1/3 af skadesudgiften dog min. 4.277,99 kr"`)
2. **Phase 2 (HealthCheckAnalyst)**: 1:1 coverage mapping ensures all extracted coverages appear in `whatsIncluded[]`
3. **Phase 3 (DeterministicMatcher)**: Code builds matched pairs BEFORE AI enrichment
4. **Phase 4 (ComparisonAgent)**: AI only fills narrative fields (`recommendations`, `missingInformation`)

**Coverage Matching Algorithm** (Phase 3):
- Normalize: lowercase, strip punctuation/hyphens
- Synonym map: `brand` → `bygningsbrand` → `el-skade`
- Exact match: canonical form comparison
- Fuzzy match: word overlap ≥40% threshold
- Unmatched → "ikke inkluderet" status

**Highlights Generation** (deterministic):
- Priority: 0=price, 1=newCoverage, 2=higherLimit, 3=lowerDeductible, 4=removedCoverage
- Top 4 limit enforced
- Icons mapped: trending-up/down, piggy-bank, truck, droplet, shield, etc.

---

## 📊 Test Data Summary

| Policy Type | Current Available | Offer Available | Health Checks |
|-------------|-------------------|-----------------|---------------|
| **Hus** | ✅ 1 policy | ✅ 5 versions (exported 1) | ✅ Both (⚠️ current mislabeled) |
| **Indbo** | ❌ Missing | ✅ 5 versions (exported 1) | ✅ Both |
| **Ulykke** | ❌ Missing | ✅ 1 policy | ⚠️ Offer only (mislabeled) |

**Comparison Status**: 1 comparison generated (Alm. Brand vs Lærerstandens Brandforsikring) for Hus only

---

## 🛠️ How to Use This Data

### For AI Prompt Analysis:
1. Review `*_structured_policy.json` files to see **Phase 1 extraction quality**
2. Compare input (`structuredPolicy`) vs output (`whatsIncluded` in health checks) for **Phase 2 1:1 mapping**
3. Examine `comparison_lb_vs_privatsikring.json` to validate **Phase 4 AI enrichment** (recommendations, missing info)

### For Coverage Matching Forensics:
1. Compare `current_hus_structured_policy.json` coverages with `offer_hus_structured_policy.json`
2. Cross-reference matched pairs in `comparison_lb_vs_privatsikring.json` → `policyComparisons[0].coverageComparison.rows[]`
3. Check for synonym matches (e.g., "Brand" ↔ "Bygningsbrand, herunder el-skade")

### For Debugging Mislabeled Data:
1. Run SQL query: `SELECT hc.id, os.policy_type, hc.result->>'whatsIncluded' FROM health_checks hc JOIN offer_snapshots os ON hc.snapshot_id = os.id`
2. Verify `snapshot_id` FK relationships in health_checks table
3. Check if health check orchestrator is using correct snapshot when creating health checks

---

## 📚 Related Documentation

- **AI Prompts**: `server/ai-prompts/` directory (OCR, extraction, health-check, comparison, emails)
- **Service Files**: 
  - `server/services/policyExtractorService.ts` (Phase 1)
  - `server/services/insuranceCheckService.ts` (Phase 2)
  - `server/services/deterministicMatcher.ts` (Phase 3)
  - `server/services/comparisonAgentService.ts` (Phase 4)
- **Architecture**: `replit.md` (complete system architecture)
- **Forensic Report**: `forensic-debug-report.md` (detailed debugging guide)

---

## ✅ Export Checklist

- [x] 4 structured_policy files (1 current + 3 offer)
- [x] 6 health_check files (2 current + 3 offer, with data quality notes)
- [x] 1 comparison file
- [x] README.md with schema documentation
- [x] Data quality issues documented
- [ ] Fix mislabeled health checks (future task)
- [ ] Add missing current indbo/ulykke policies (requires PDF upload)

**Total Files**: 11 JSON files + 1 README

---

*Generated automatically from PostgreSQL database for test user e85ec3b9-e354-4c49-9f68-194830e356af*
