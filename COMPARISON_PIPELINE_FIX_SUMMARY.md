# Comparison Pipeline - Fix Summary

## What Was Fixed (November 18, 2025)

### Problem
The comparison pipeline was reporting "0 matches" even when current and offer policies should have matched. After investigation, I found and fixed **3 critical bugs**:

---

## Bugs Fixed

### Bug #1: Missing Policy ID Field
**Issue**: The comparison orchestrator created policy objects with `snapshotId` but the matcher expected `id`.

**Result**: All policies were filtered out before matching could begin.

**Fix**: Added `id: snapshot.id` to policy objects in both `loadCurrentPolicies` and `loadOfferPolicies`.

---

### Bug #2: Matcher Read Wrong Field
**Issue**: The matcher looked for address/person/offerNumber in `coverageDetails`, but PolicyExtractor (Phase 1) stores this data in `structured_policy`.

**Result**: Matcher couldn't find matching metadata even when it existed.

**Fix**: Updated extraction functions to:
1. Try `structured_policy` first (Phase 1 data)
2. Fall back to `coverageDetails` (legacy support)
3. Handle malformed JSON safely with try/catch

---

### Bug #3: Silent Failures
**Issue**: When policies lacked matching metadata, the system reported "0 matches" without explaining why.

**Result**: Users had no idea they needed to re-upload their documents.

**Fix**: Added data quality validation that:
1. Detects when ALL policies lack matching metadata
2. Returns explicit error: "Re-upload policies to populate structured_policy"
3. Stores error in comparison record for UI display
4. Prevents wasted AI processing

---

## Current Status

### ✅ What Works Now
- **New uploads** (after Nov 18): All offer documents have `structured_policy` populated with matching metadata
- **Safety**: Malformed JSON doesn't crash the matcher
- **Clear errors**: Users get actionable messages when data is missing
- **Performance**: No O(n²) JSON parsing overhead

### ⚠️ What Needs Action
**Your current policies (uploaded before Nov 18) lack matching metadata.**

When you run a comparison now, you'll see:
```
Data quality error: All 2 current policies lack matching metadata 
(address/person/offerNumber). Re-upload current policies to 
populate structured_policy.
```

This is CORRECT behavior - the system is telling you what to do!

---

## Next Steps

### To Enable Comparisons:

**1. Re-upload Your Current Policies**
- Go to the upload page
- Upload your Svphil current policies PDF again
- Wait for extraction to complete (~30 seconds)

**2. Verify Extraction**
After upload, check that `structured_policy` is populated:
```sql
SELECT policy_type, 
       LENGTH(structured_policy::text) as has_metadata
FROM offer_snapshots 
WHERE document_id = '<your-new-document-id>';
```

You should see non-zero lengths for all policies.

**3. Run Comparison**
```bash
tsx server/scripts/test-comparison-pipeline.ts hello@vyork.dk
```

**Expected Result**:
```
✅ Phase 3 matching completed: { 
  matched: 2-3,        # Matches found!
  dataQualityError: 'none'
}
✅ Phase 4: Generated comparison
✅ Comparison completed successfully
```

---

## Why This Happened

**The Timeline:**
- **Nov 11**: You uploaded current policies (before PolicyExtractor Stage 5 existed)
- **Nov 14**: We added Stage 5 to populate `structured_policy` with matching metadata
- **Nov 18**: You uploaded new Tryg offer (Stage 5 ran, metadata populated)
- **Nov 18**: Comparison failed because current policies had NULL `structured_policy`

**The Architecture:**
The comparison pipeline has 4 phases:
1. **PolicyExtractor** → Populates `structured_policy` with address/person/offerNumber
2. **HealthCheckAnalyst** → Analyzes individual policies
3. **DeterministicMatcher** → Pairs current vs offer using metadata from Phase 1
4. **ComparisonAgent** → Generates AI-powered comparison

Phase 3 requires Phase 1 data. Old uploads skipped Phase 1 (or ran an old version), so they can't match.

---

## Architectural Issues Found (For Future Improvement)

### Issue #1: Health Check Orphaning
**Problem**: Health checks are linked to `documentId`, not `snapshotId`. Matching by array index is fragile.

**Impact**: When snapshot count ≠ health check count, snapshots get skipped.

**Suggested Fix**: Add `snapshot_id` foreign key to `health_checks` table.

---

### Issue #2: Undefined Sort Order
**Problem**: `getOfferSnapshotsByDocument` has no ORDER BY clause.

**Impact**: Snapshots return in undefined order, making index-based matching nondeterministic.

**Suggested Fix**: Add `.orderBy(offerSnapshots.createdAt)` to ensure consistent ordering.

---

## Files Modified

1. `server/services/deterministicMatcher.ts`
   - Added production-safe JSON parsing with try/catch
   - Updated extraction functions to read from `structured_policy`
   - Added `hasRawMatchingMetadata()` data quality validator
   - Return `dataQualityError` when all policies lack metadata

2. `server/services/comparisonOrchestrator.ts`
   - Added `id: snapshot.id` to policy objects
   - Check for `dataQualityError` before attempting Phase 4
   - Propagate data quality errors with actionable messages

---

## Confidence Level

**High** that new uploads will match correctly after re-upload.

**Medium** that old data can be backfilled (requires running extraction pipeline manually).

---

## Next Session Recommendations

1. **Re-upload current policies** (highest priority)
2. Add regression test for mixed-quality policy sets
3. Consider caching parsed `structuredPolicy` during scoring
4. Add `snapshot_id` FK to `health_checks` table
5. Add ORDER BY clauses to snapshot/health check queries

---

## Questions?

If comparison still fails after re-upload, check:
1. Did extraction complete successfully? (Check logs for Stage 5)
2. Does `structured_policy` have address/person/offerNumber?
3. Do current and offer policies share at least one matching field?

See `DEBUGGING_SESSION_2025-11-18.md` for full technical analysis.
