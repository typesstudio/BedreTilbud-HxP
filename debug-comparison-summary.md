# Debug Comparison Pipeline - Summary Report

**Date**: November 19, 2025  
**User**: e85ec3b9-e354-4c49-9f68-194830e356af (hello@vyork.dk)  
**Offer Company**: Alm. Brand (abd44932-e5b2-4fda-a463-e75fd46c1ccc)

---

## ✅ Script Implementation Complete

Successfully created `server/scripts/debugComparison.ts` implementing all 6 debug steps (A-F) as specified by your expert.

**How to Run:**
```bash
npx tsx server/scripts/debugComparison.ts
```

Full output saved to: `/tmp/debug_comparison_pipeline.txt`

---

## 🔍 Critical Findings

### 1. **10 Health Check Mismatches** ⚠️

The script's `guessPolicyTypeFromCoverages()` helper detected **10 snapshots** where the database `policy_type` doesn't match the actual coverage data:

**Examples:**
- Snapshot `4f1d13ae`: DB says `hus`, but coverages show `ulykke` (Invaliditet, Dødsfald, Tandskade, Krisehjælp)
- Snapshot `9ad74ada`: DB says `ulykke`, but coverages show `indbo` (Indbo BASIS, Cykel, Ansvar tingskade)
- Snapshot `f28e4d53`: DB says `ulykke`, but coverages show `indbo` (Indbo BASIS, Cykel, Ansvar personskade)

This confirms the mislabeling issue you suspected from the forensic JSON exports.

### 2. **8 Snapshots Missing structured_policy** ⚠️

Out of 24 total snapshots:
- ✅ 16 have `structured_policy` (Phase 1 extraction completed)
- ❌ **8 are missing `structured_policy`** (extraction failed or not run)

**Critical Missing Data:**
- Current `indbo` snapshot: No structured_policy
- Current `ulykke` snapshot: No structured_policy

This explains why the matcher had to use score=0 fallback logic.

### 3. **Incomplete Comparison Results** ⚠️

The final `company_comparisons` JSON shows:
- **hus**: 1 coverage row ✅ (working)
- **indbo**: 0 coverage rows ❌ (broken)
- **ulykke**: 0 coverage rows ❌ (broken)

The comparison exists but is empty for 2 out of 3 policy types because:
1. Health checks are mislabeled → wrong coverage data fed to AI
2. Missing structured_policy → matcher has incomplete metadata

### 4. **Matcher Successfully Paired All 3 Types** ✅

Despite missing metadata, the deterministic matcher created:
- 3 matched pairs (hus ↔ hus, indbo ↔ indbo, ulykke ↔ ulykke)
- 0 unmatched current policies
- 0 unmatched offer policies

The fallback logic (auto-match when 1 current + 1 offer per type) worked correctly.

---

## 📊 Step-by-Step Output Summary

### Step A: Documents Overview
- **Total documents**: 12
  - Current: 4
  - Offer: 8 (Alm. Brand, Codan, Privatsikring, IF Forsikring, Tryg, etc.)

### Step B: Snapshots Matrix
- **Total snapshots**: 24
  - 16 with `structured_policy` ✓
  - 8 without `structured_policy` ✗
  
**Grouped by type:**
- Current: 3 snapshots (hus, indbo, ulykke)
- Offer: 21 snapshots (multiple companies × policy types)

### Step C: Health Check Consistency
- **Total health checks**: 23
- **Mismatches detected**: 10

All mismatches logged with format:
```
policy_type(db)=hus, policy_type(guessed)=ulykke, firstCoverages=[Invaliditet, Dødsfald, ...]
```

### Step D: Matcher Output
- Current snapshots loaded: 3
- Offer snapshots loaded: 3
- **Matched pairs**: 3
  - `hus`: current=4f1d13ae ↔ offer=f28e4d53
  - `indbo`: current=2610557a ↔ offer=9ad74ada
  - `ulykke`: current=20c6e2d4 ↔ offer=2aefbdb7

### Step E: ComparisonAgent Input
Built input with **3 policy comparisons**:
- `hus`: ✅ has current health check, ✅ has offer health check
- `indbo`: ✅ has current health check, ✅ has offer health check
- `ulykke`: ✅ has current health check, ✅ has offer health check

All 3 pairs have health check data on both sides (good!), but the data is mislabeled.

### Step F: Comparison JSON in DB
- **Comparison ID**: df03ca4d-8203-4193-9b47-3a75b2d6327a
- **Status**: completed
- **Policy comparisons**: 3
  - `hus`: 1 coverage row
  - `indbo`: 0 coverage rows ⚠️
  - `ulykke`: 0 coverage rows ⚠️

---

## 🎯 Root Cause Analysis

**Why are comparisons incomplete?**

1. **Mislabeled Health Checks** → Wrong coverage data sent to ComparisonAgent
   - Current `hus` health check contains `ulykke` coverages
   - Offer `ulykke` health check contains `indbo` coverages
   - When AI tries to match coverages, it finds no overlaps → 0 rows

2. **Missing structured_policy** → Matcher has no metadata
   - Current `indbo` and `ulykke` snapshots lack structured_policy
   - Matcher relies on score=0 fallback (single-pair auto-match)
   - This works for pairing but doesn't help with coverage matching

3. **FK Join Issues** → Health checks linked to wrong snapshots
   - Possible cause: `health_checks.snapshot_id` pointing to wrong snapshot
   - Or: Health check orchestrator using incorrect snapshot when creating health checks

---

## 🛠️ Next Steps (Recommended by Architect)

### Immediate Fixes

1. **Clean up mislabeled health checks**:
   - Option A: Retype affected snapshots in DB (manual SQL UPDATE)
   - Option B: Rerun health-check pipeline with corrected policy hints
   - Focus on snapshots: `4f1d13ae`, `9ad74ada`, `f28e4d53`, etc.

2. **Regenerate missing structured_policy**:
   - Re-extract 8 snapshots missing structured_policy
   - **Priority**: Current `indbo` and `ulykke` (needed for matcher metadata)
   - This should populate address/person/offerNumber fields

3. **Rerun comparison pipeline**:
   - After fixes, trigger new comparison for user + Alm. Brand
   - Verify all 3 policy types produce coverage rows

### Optional Improvements

1. **Add Quick Summary section** to debug script:
   - Mismatch count summary
   - Missing structured_policy tally
   - Empty comparison rows count

2. **Add error handling** in Step C:
   - Wrap JSON.parse in try/catch to handle bad health check payloads
   - Emit counts of missing structured policies per policy type

3. **Add sanity checks** in upload pipeline:
   - Validate health_check.snapshot_id points to correct policy_type
   - Alert if structured_policy is missing after extraction

---

## 📁 Files Created

1. **`server/scripts/debugComparison.ts`** - Main debug script (595 lines)
2. **`/tmp/debug_comparison_pipeline.txt`** - Full console output
3. **`debug-comparison-summary.md`** - This summary report
4. **`forensic-json-exports/`** - 11 JSON files + README from earlier export

---

## 🏃 How to Use This Data

**For your expert:**
Share the full output from `/tmp/debug_comparison_pipeline.txt` showing:
- Exact snapshot IDs with mismatches
- Which snapshots are missing structured_policy
- Matcher behavior (score=0 fallback working)
- ComparisonAgent input structure
- Final comparison JSON with 0 rows for indbo/ulykke

**For targeted fixes:**
Use the snapshot IDs from Step C (health check mismatches) to:
1. Query those specific health_checks in DB
2. Trace back to offer_snapshots.snapshot_id
3. Check if FK relationship is correct
4. Fix or regenerate as needed

---

## ✅ Architect Review

**Status**: PASS ✅

The script successfully meets all acceptance criteria and provides actionable visibility into the comparison pipeline. All 6 steps (A-F) produce clean, reproducible output with proper invariant checks and data quality warnings.

**Visibility Strengths:**
- Clear ASCII framing for each step
- console.table for tabular data
- Mismatch warnings with exact coverage names
- Health check presence logged per-policy
- Coverage row counts exposed

**Next Priority**: Fix mislabeled health checks and regenerate missing structured_policy data.

---

*Debug script ready for production use. Run `npx tsx server/scripts/debugComparison.ts` anytime to diagnose comparison pipeline issues.*
