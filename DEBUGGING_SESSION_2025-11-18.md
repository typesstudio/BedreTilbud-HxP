# Debugging Session: Comparison Pipeline - November 18, 2025

## Executive Summary
Fixed critical bugs preventing comparison pipeline from matching policies. Two code fixes deployed:
1. ✅ **DeterministicMatcher**: Now reads metadata from `structured_policy` (Phase 1 data) instead of `coverageDetails`
2. ✅ **ComparisonOrchestrator**: Now includes `id` field in policy objects (matcher requirement)

**Remaining Limitation**: Current policies uploaded before Nov 18 have NULL `structured_policy` and cannot match. **Solution**: Re-upload current policies to populate metadata.

---

## Problem: Matcher Returned 0 Matches Despite Having Policies

### Symptoms
```
[ComparisonOrchestrator] Comparing Svphil → Tryg { currentPolicies: 2, offerPolicies: 6 }
[ComparisonOrchestrator] Phase 3 matching completed: { matched: 0, unmatchedCurrent: 0, unmatchedOffer: 0 }
❌ No matched policy pairs found
```

### Root Causes Identified

#### 1. Matcher Expected `policy.id`, Orchestrator Provided `snapshotId`
**Location**: `server/services/comparisonOrchestrator.ts:270-278, :333-342`

**Bug**: Orchestrator created policy objects with `snapshotId` but matcher filtered them out:
```typescript
// deterministicMatcher.ts:85-86
for (const policy of currentPolicies) {
  if (!policy.policyType || !policy.id) continue; // ← Filtered ALL policies!
}
```

**Fix**: Added `id: snapshot.id` to policy objects in both `loadCurrentPolicies` and `loadOfferPolicies`.

---

#### 2. Matcher Read from `coverageDetails`, Metadata Lives in `structured_policy`
**Location**: `server/services/deterministicMatcher.ts:24-80`

**Bug**: Extraction functions looked for address/person/offerNumber in `coverageDetails`:
```typescript
function extractAddress(policy: Policy): string {
  const details = policy.coverageDetails as any; // ← Wrong field!
  const address = details.insuredAddress || details.address || '';
  return normalizeString(address);
}
```

**Reality**: PolicyExtractor (Phase 1, Stage 5) stores matching metadata in `structured_policy`:
```json
{
  "address": "Kornvænget 19, 3230 Græsted",
  "person": "John Doe",
  "offerNumber": "4400104896672/000"
}
```

**Fix**: Updated `extractAddress`, `extractPersonName`, `extractOfferNumber` to:
1. Try `structured_policy` first (Phase 1 data)
2. Fallback to `coverageDetails` (legacy support)

---

## Data Analysis: Why Current Policies Can't Match

### Test Data Status

#### New Tryg Offer (uploaded Nov 18, 9:01 AM)
**Document ID**: `44701da4-11d1-4cf1-826d-e2b0f05815dc`

| Snapshot ID | Policy Type | structured_policy | Address |
|------------|-------------|-------------------|---------|
| cd3b5861... | hus | ✅ 1137 chars | "Kornvænget 19, 3230 Græsted" |
| 37c2ce39... | ulykke | ✅ 1311 chars | null |
| 78c85b4c... | indbo | ✅ 1299 chars | "Kong Oscars Gade 4, 02. tv., 2100 København Ø" |

**Status**: ✅ All snapshots have `structured_policy` populated with matching metadata.

---

#### Current Svphil Policies (uploaded Nov 11, pre-Stage 5 fix)
**Document ID**: `c008290f-d4e3-4461-82a2-7c985dcffe3c`

| Snapshot ID | Policy Type | structured_policy | Address | Loaded by Orchestrator? |
|------------|-------------|-------------------|---------|------------------------|
| 4f1d13ae... | hus | ✅ YES | "Kornvænget 19..." | ❌ Skipped (no health check) |
| 2610557a... | indbo | ❌ NULL | - | ✅ Loaded |
| 20c6e2d4... | ulykke | ❌ NULL | - | ✅ Loaded |

**Status**: ❌ Only 2/3 snapshots loaded, both have NULL `structured_policy`. No matching metadata available.

---

## Architectural Issues Discovered

### Issue #1: Health Check Orphaning (Index-Based Matching)
**Location**: `server/services/comparisonOrchestrator.ts:253-260`

**Problem**: Health checks are linked to `documentId`, not `snapshotId`. Orchestrator matches by sorted index:
```typescript
for (let i = 0; i < snapshots.length; i++) {
  const snapshot = snapshots[i];
  const healthCheck = uniqueHealthChecks[i]; // ← Fragile!
  if (!healthCheck) {
    console.warn(`No health check for snapshot ${snapshot.id}, skipping`);
    continue; // ← Snapshot excluded from comparison!
  }
}
```

**Data**: 3 snapshots, 2 unique health checks → Snapshot #3 skipped.

**Impact**: The `hus` snapshot (which HAS `structured_policy`) was excluded, leaving only 2 snapshots with NULL metadata.

**Suggested Fix** (out of scope for today):
1. Add `snapshot_id` field to `health_checks` table
2. Store `snapshotId` in health check `result` JSON (already claimed but not working)
3. Match by explicit foreign key instead of index

---

### Issue #2: Undefined Sort Order in Database Queries
**Location**: `server/storage.ts:1361-1365`

**Problem**: No ORDER BY in `getOfferSnapshotsByDocument`:
```typescript
async getOfferSnapshotsByDocument(documentId: string): Promise<OfferSnapshot[]> {
  return db.select().from(offerSnapshots).where(eq(offerSnapshots.documentId, documentId));
  // ← No .orderBy() clause!
}
```

**Impact**: Snapshots return in undefined order (insertion order in practice, but not guaranteed). Combined with index-based health check matching, this creates nondeterministic pairing.

**Suggested Fix**:
```typescript
.orderBy(offerSnapshots.createdAt) // Deterministic sort
```

---

## Files Modified

### 1. `server/services/deterministicMatcher.ts`
**Changes**:
- ✅ `extractAddress()`: Try `structured_policy.address` first, fallback to `coverageDetails`
- ✅ `extractPersonName()`: Try `structured_policy.person` first, fallback to `coverageDetails`
- ✅ `extractOfferNumber()`: Try `structured_policy.offerNumber` first, fallback to `coverageDetails`
- ✅ Added debug logging to track extraction sources

**Impact**: Matcher can now read matching metadata from PolicyExtractor Phase 1 output.

---

### 2. `server/services/comparisonOrchestrator.ts`
**Changes**:
- ✅ Line 274: Added `id: snapshot.id` to `loadCurrentPolicies` output
- ✅ Line 337: Added `id: snapshot.id` to `loadOfferPolicies` output
- ✅ Kept `snapshotId` for backward compatibility

**Impact**: Policies no longer filtered out by matcher's `if (!policy.id)` check.

---

## Test Results

### Before Fixes
```
[ComparisonOrchestrator] Phase 3 matching completed: { 
  matched: 0, 
  unmatchedCurrent: 0,  // ← All filtered out
  unmatchedOffer: 0     // ← All filtered out
}
```

### After Fix #1 (Added `id` field)
```
[ComparisonOrchestrator] Phase 3 matching completed: { 
  matched: 0, 
  unmatchedCurrent: 2,  // ← Policies now processed
  unmatchedOffer: 6     // ← Policies now processed
}
```

### After Fix #2 (Read `structured_policy`)
```
[Matcher] extractAddress for 2610557a...: no address found  // ← Current indbo (NULL structured_policy)
[Matcher] extractAddress for 20c6e2d4...: no address found  // ← Current ulykke (NULL structured_policy)
[Matcher] extractAddress from structuredPolicy for 78c85b4c...: "kong oscars gade 4..."  // ← Offer indbo (HAS metadata)
```

**Result**: Still 0 matches because current policies have no metadata.

---

## Path Forward

### Option 1: Re-Upload Current Policies (Recommended)
**Action**: User re-uploads their Svphil current policies via UI.

**Expected Result**:
- PolicyExtractor Stage 5 runs
- `structured_policy` populated with address/person/offerNumber
- Deterministic matcher finds matches based on address

**Timeline**: ~2 minutes per upload.

---

### Option 2: Backfill structured_policy via Extraction API (Alternative)
**Action**: Trigger extraction pipeline for existing document with `forceReprocess: true`.

**Command**:
```bash
curl -X POST https://<replit-url>/api/documents/c008290f-d4e3-4461-82a2-7c985dcffe3c/extract
```

**Risk**: Requires API authentication and may duplicate snapshots if not handled correctly.

---

### Option 3: Accept Limitation for Old Data (Low Priority)
**Action**: Document that pre-Nov-18 uploads cannot match.

**Mitigation**: All new uploads (post-fix) will have `structured_policy` and work correctly.

---

## Validation Plan

### Step 1: Re-Upload Current Policies
1. User uploads Svphil current PDF via UI
2. Monitor logs: `Stage 5: PolicyExtractor` completes
3. Query database: Verify `structured_policy` populated

### Step 2: Run Comparison Test
```bash
tsx server/scripts/test-comparison-pipeline.ts hello@vyork.dk
```

**Expected Output**:
```
[ComparisonOrchestrator] Phase 3 matching completed: { 
  matched: 2-3,        // ← Matches found!
  unmatchedCurrent: 0-1, 
  unmatchedOffer: 3-4 
}
[ComparisonAgent] Generated comparison for 2-3 policy pairs
✅ Comparison completed successfully
```

### Step 3: Verify Comparison UI
1. Navigate to `/sammenligning` page
2. Verify comparison cards display:
   - Company names (Svphil vs Tryg)
   - Policy pairs (hus→hus, indbo→indbo, etc.)
   - Savings calculations
   - Coverage highlights

---

## Lessons Learned

### 1. Multi-Phase Architecture Requires Explicit Data Flow
**Issue**: Phase 1 (PolicyExtractor) populated `structured_policy`, but Phase 3 (Matcher) didn't know to read from it.

**Learning**: Document field semantics clearly:
- `structured_policy`: Matching metadata (Phase 1 output)
- `coverageDetails`: Coverage data (Phase 2 input)
- `healthCheck`: Health analysis (Phase 2 output)

---

### 2. Index-Based Matching is Fragile
**Issue**: Health checks matched to snapshots by array index, failed when counts mismatched.

**Learning**: Use explicit foreign keys (`snapshot_id`) for relationships, not implicit array ordering.

---

### 3. Database Queries Need Explicit Ordering
**Issue**: `getOfferSnapshotsByDocument` returned snapshots in undefined order.

**Learning**: Always use `.orderBy()` for queries used in matching logic.

---

## Recommendations

### Immediate (This Session)
1. ✅ Fix deterministicMatcher to read `structured_policy`
2. ✅ Fix orchestrator to include `id` field
3. ✅ Document findings
4. 🔄 User re-uploads current policies

### Short-Term (Next Sprint)
1. Add `snapshot_id` field to `health_checks` table
2. Update health check orchestrator to store `snapshotId` in DB
3. Add `.orderBy(createdAt)` to `getOfferSnapshotsByDocument`
4. Add `.orderBy(createdAt)` to `getHealthChecksByDocument`

### Long-Term (Architecture)
1. Consider making health checks optional for comparison (use confidence scores instead)
2. Add data validation layer to detect missing `structured_policy` early
3. Implement backfill script to re-extract old documents on demand

---

## Conclusion

**Status**: ✅ Code fixes deployed and tested.

**Blocker**: Current policies uploaded before Stage 5 fix have NULL `structured_policy`.

**Next Step**: User re-uploads current policies → Comparison pipeline should work end-to-end.

**Files Changed**: 2 files, ~50 lines modified.

**Confidence**: High that new uploads will match correctly. Medium confidence that re-upload is the fastest path to validation.
