# BedreTilbud - Forensic Debug Report
## Comparison Pipeline Investigation

**User:** hello@vyork.dk  
**Company:** Alm. Brand  
**Date:** November 19, 2025  
**Status:** ✅ RESOLVED

---

## Executive Summary

**Problem:** Per-policy tabs (Hus, Indbo, Ulykke) displayed 0 kr savings and empty coverage tables despite the "Samlet oversigt" showing correct totals.

**Root Cause:** Database `comparison_json` contained all correct data with proper nested structure, but the frontend was reading from incorrect field paths. The AI-generated JSON used nested objects (`costSummary`, `coverageComparison`), but the UI expected a flat structure.

**Resolution:** Updated `client/src/pages/OfferComparisonPage.tsx` to read from correct nested JSON paths.

---

## Step 1: Ground Truth - Database Snapshots

### Current Insurance (Privatsikring)

| Policy Type | Snapshot ID | Structured Policy | Health Check |
|-------------|-------------|-------------------|--------------|
| Hus | `4f1d13ae-3761-4dbc-a706-a1dcd6f097c4` | ✅ YES | ✅ |
| Indbo | `2610557a-3a8e-4485-9fd0-7d51ae72d0e5` | ⚠️ NO | ✅ |
| Ulykke | `20c6e2d4-5747-4cb1-84bf-00ef9c9f672d` | ⚠️ NO | ✅ |

### Offer Insurance (Alm. Brand)

| Policy Type | Snapshot ID | Structured Policy | Health Check |
|-------------|-------------|-------------------|--------------|
| Hus | `7690ecd7-fb65-49f8-8558-05c07e179991` | ✅ YES | ✅ |
| Indbo | `91905add-26d4-4051-8f97-4b4e285f9c36` | ✅ YES | ✅ |
| Ulykke | `e31ddb37-8ba5-4f93-88b4-2a5a71e6a2b2` | ✅ YES | ✅ |

### Findings

- **Total Snapshots:** 6 (3 current + 3 offer)
- **Health Checks:** All 6 snapshots have complete health check data (Phase 2 ✅)
- **Note:** Current Indbo/Ulykke lack `structured_policy` data but still participate in matching via fallback logic

---

## Step 2: Policy Matching (Phase 3 - DeterministicMatcher)

### Matched Pairs

```
✅ 3 MATCHED PAIRS CONFIRMED:

1. Hus:    Privatsikring (4f1d13ae...) ↔ Alm. Brand (7690ecd7...)
2. Indbo:  Privatsikring (2610557a...) ↔ Alm. Brand (91905add...)
3. Ulykke: Privatsikring (20c6e2d4...) ↔ Alm. Brand (e31ddb37...)
```

### Matching Strategy

**Method Used:** Single-per-type fallback  
**Reason:** Current policies (Indbo/Ulykke) lack metadata (address/person info) for scoring, so the matcher activated its fallback logic that auto-matches when there's exactly one policy of each type per company.

**Score:** 0 (via fallback, not address/person matching)

### Verdict

✅ Matching phase working correctly with graceful degradation for missing metadata.

---

## Step 3: Comparison JSON Structure (Phase 4 - ComparisonAgent)

### Per-Policy Breakdown

| Type | Current (kr) | Offer (kr) | Savings (kr) | Percent (%) | Coverage Rows |
|------|--------------|------------|--------------|-------------|---------------|
| **HUS** | 5,000 | 4,500 | 500 | 10.0% | 1 (Brand) |
| **INDBO** | 2,000 | 1,800 | 200 | 10.0% | 1 (Tyveri) |
| **ULYKKE** | 1,500 | 1,300 | 200 | 13.3% | 1 (Invaliditet) |

### JSON Path Structure (CRITICAL)

The database stores comparison data with the following nested structure:

```json
{
  "meta": {
    "offerCompany": "Alm. Brand",
    "currentCompany": "Privatsikring"
  },
  "overall": {
    "annualSavings": 900,
    "totalCurrentAnnualPremium": 8500,
    "totalOfferAnnualPremium": 7600,
    "perPolicySummary": [...]
  },
  "policyComparisons": [
    {
      "policyType": "hus",
      "costSummary": {
        "currentAnnualPremium": 5000,
        "offerAnnualPremium": 4500,
        "annualSavings": 500,
        "annualSavingsPercent": 10
      },
      "coverageComparison": {
        "rows": [
          {
            "coverage": "Brand",
            "description": "Dækning mod brandskader",
            "current": {
              "value": "inkluderet",
              "limit": "1.000.000 kr",
              "selvrisiko": "5.000 kr"
            },
            "offer": {
              "value": "inkluderet",
              "limit": "1.500.000 kr",
              "selvrisiko": "4.000 kr"
            }
          }
        ]
      }
    }
  ]
}
```

### Coverage Examples

**Hus - Brand Coverage:**
- Current: inkluderet, limit: 1.000.000 kr, selvrisiko: 5.000 kr
- Offer: inkluderet, limit: 1.500.000 kr, selvrisiko: 4.000 kr

**Indbo - Tyveri Coverage:**
- Current: inkluderet, limit: 500.000 kr, selvrisiko: 2.000 kr
- Offer: inkluderet, limit: 500.000 kr, selvrisiko: 1.500 kr

**Ulykke - Invaliditet Coverage:**
- Current: inkluderet, limit: 1.000.000 kr, selvrisiko: ingen
- Offer: inkluderet, limit: 1.200.000 kr, selvrisiko: ingen

### Verdict

✅ Phase 4 AI generation working perfectly - all data present and correctly structured.

---

## Step 4: Frontend Mapping Issues & Fixes

### File: `client/src/pages/OfferComparisonPage.tsx`

### Bugs Identified

| Issue | Wrong Path | Correct Path | Line(s) |
|-------|-----------|--------------|---------|
| Annual savings | `costSummary.savings` | `costSummary.annualSavings` | 354-355 |
| Savings percent | `costSummary.savingsPercent` | `costSummary.annualSavingsPercent` | 354-355 |
| Coverage rows | `coverageRows` | `coverageComparison.rows` | 357 |
| Current value | `row.currentValue` | `row.current.value` | 421 |
| Offer value | `row.offerValue` | `row.offer.value` | 422 |
| Coverage name | `row.feature \|\| row.label` | `row.coverage \|\| row.feature \|\| row.label` | 413 |

### Changes Applied

#### 1. Quick Overview Table (Line 333)
```typescript
// ✅ Already correct
{row.annualSavings} kr/år
```

#### 2. Per-Policy Tabs (Lines 354-357)
```typescript
// ❌ BEFORE:
const savings = comparison?.costSummary?.savings ?? 0;
const savingsPercent = comparison?.costSummary?.savingsPercent ?? 0;
const rows = comparison?.coverageRows ?? [];

// ✅ AFTER:
const savings = comparison?.costSummary?.annualSavings ?? 0;
const savingsPercent = comparison?.costSummary?.annualSavingsPercent ?? 0;
const rows = comparison?.coverageComparison?.rows ?? [];
```

#### 3. Coverage Table Mapping (Lines 421-473)
```typescript
// ❌ BEFORE:
const currentValue = row.currentValue;
const offerValue = row.offerValue;

// ✅ AFTER:
const currentValue = row.current?.value;
const offerValue = row.offer?.value;
const currentLimit = row.current?.limit;
const offerLimit = row.offer?.limit;
```

#### 4. Coverage Name (Line 413)
```typescript
// ❌ BEFORE:
row.feature || row.label || 'Ukendt dækning'

// ✅ AFTER:
row.coverage || row.feature || row.label || 'Ukendt dækning'
```

### Bonus Enhancement

Added coverage limit display below status badges:
```typescript
{currentLimit && (
  <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
    {currentLimit}
  </div>
)}
```

---

## Final Verdict

### Impact Assessment

| Component | Before Fix | After Fix |
|-----------|-----------|-----------|
| **Samlet oversigt** | ✅ Working (900 kr) | ✅ Working (900 kr) |
| **Hus tab** | ❌ 0 kr savings, N/A coverage | ✅ 500 kr savings, Brand coverage |
| **Indbo tab** | ❌ 0 kr savings, N/A coverage | ✅ 200 kr savings, Tyveri coverage |
| **Ulykke tab** | ❌ 0 kr savings, N/A coverage | ✅ 200 kr savings, Invaliditet coverage |

### System Status: ✅ FULLY OPERATIONAL

| Phase | Service | Status |
|-------|---------|--------|
| Phase 1 | PolicyExtractor | ✅ Working |
| Phase 2 | HealthCheckAnalyst | ✅ Working |
| Phase 3 | DeterministicMatcher | ✅ Working (with fallback) |
| Phase 4 | ComparisonAgent | ✅ Working (generates correct JSON) |
| Frontend | OfferComparisonPage | ✅ FIXED (reads correct paths) |

### Key Learnings

1. **Backend was never broken** - All 4 phases produced correct data
2. **Frontend mapping mismatch** - UI expected flat structure, DB had nested
3. **Silent failure** - Missing fields defaulted to 0/empty without errors
4. **Fallback matching works** - Single-per-type matching handles missing metadata gracefully

### Recommendations

1. ✅ Add TypeScript interfaces for `comparison_json` structure to catch mismatches at compile-time
2. ✅ Consider adding JSON schema validation on the frontend to fail fast
3. ✅ Document the canonical `comparison_json` structure in `replit.md`
4. ⚠️ Investigate why current Indbo/Ulykke policies lack `structured_policy` data

---

## Testing Checklist

- [x] Alm. Brand comparison shows 900 kr total savings
- [x] Hus tab displays 500 kr savings (10%)
- [x] Indbo tab displays 200 kr savings (10%)
- [x] Ulykke tab displays 200 kr savings (13.3%)
- [x] All coverage tables populated with real data
- [x] Coverage limits display correctly (e.g., "1.500.000 kr")
- [x] Status badges show correct values (Inkluderet, Bedre, etc.)

---

## Appendix: SQL Queries Used

### Query 1: List All Snapshots
```sql
SELECT 
  os.id,
  os.policy_type,
  os.structured_policy IS NOT NULL AS has_structured,
  os.document_id,
  d.document_type,
  c.name AS company,
  os.created_at
FROM offer_snapshots os
JOIN documents d ON os.document_id = d.id
LEFT JOIN companies c ON os.company_id = c.id
WHERE d.user_id = 'e85ec3b9-e354-4c49-9f68-194830e356af'
ORDER BY d.document_type, c.name, os.created_at;
```

### Query 2: Inspect Comparison JSON
```sql
SELECT
  id,
  status,
  comparison_json
FROM company_comparisons
WHERE user_id = 'e85ec3b9-e354-4c49-9f68-194830e356af'
  AND offer_company = (SELECT id FROM companies WHERE name ILIKE '%alm. brand%')
ORDER BY created_at DESC
LIMIT 1;
```

---

**Report Generated:** November 19, 2025  
**Investigator:** Replit Agent  
**Status:** ✅ Issue Resolved and Documented
