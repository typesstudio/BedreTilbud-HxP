# 📦 Debug Package - BedreTilbud Comparison Pipeline

**Leveret**: November 19, 2025  
**Formål**: Komplet debug-pakke til at diagnosticere og fixe tomme comparison resultater

---

## 📁 Pakke Indhold

| Fil | Beskrivelse | Brug |
|-----|-------------|------|
| **EXPERT-REPORT-DEBUG-COMPARISON.md** | Hovedrapporten med alle findings | Læs dette først |
| **QUICK-VERIFICATION-QUERIES.sql** | 10 SQL queries til at verificere issues | Kør i database tool |
| **server/scripts/debugComparison.ts** | TypeScript debug script (595 linjer) | Kør når som helst |
| **debug-comparison-summary.md** | Kort opsummering | Quick reference |
| **/tmp/debug_full_output.txt** | Rå console output fra script | Full details |
| **forensic-json-exports/** | 11 JSON filer + README | Earlier forensic data |

---

## 🚀 Hurtig Start

### 1. Læs Hovedrapporten (5 min)

```bash
# Åbn filen i din editor
cat EXPERT-REPORT-DEBUG-COMPARISON.md
```

**Hvad du får:**
- Executive summary med 3 kritiske issues
- Fuld output fra alle 6 debug steps
- Root cause analyse med diagram
- 10 specifikke snapshot IDs der skal fixes
- 3 fix-strategier (quick vs thorough)

---

### 2. Kør Debug Scriptet (30 sek)

```bash
npx tsx server/scripts/debugComparison.ts
```

**Output viser:**
- ✅ Step A: Documents overview (12 documents)
- ✅ Step B: Snapshots matrix (24 snapshots, 8 missing data)
- ⚠️  Step C: Health check consistency (10 mismatches!)
- ✅ Step D: Matcher output (3 pairs matched)
- ✅ Step E: ComparisonAgent input (all have health checks)
- ❌ Step F: Comparison JSON (indbo=0 rows, ulykke=0 rows)

---

### 3. Verificer med SQL (2 min)

```bash
# Åbn QUICK-VERIFICATION-QUERIES.sql
# Kør Query 1, 2, og 6
```

**Query 1**: Bekræfter 10 mislabeled health checks  
**Query 2**: Bekræfter 8 missing structured_policy  
**Query 6**: Viser comparison med 0 coverage rows

---

## 🔥 Kritiske Findings (TL;DR)

### Issue #1: 10 Health Check Mismatches ⚠️

**Problem**: Database `policy_type` matcher ikke faktisk coverage-indhold

**Eksempel**:
```
Snapshot 4f1d13ae:
  DB siger: "hus"
  Men indeholder: Invaliditet, Dødsfald, Tandskade (= ulykke!)
```

**Impact**: ComparisonAgent får forkert coverage data → kan ikke matche → 0 rows

---

### Issue #2: 8 Missing structured_policy ⚠️

**Problem**: Extraction pipeline ikke kørt for 8 snapshots

**Kritisk**:
- Current `indbo`: NO structured_policy
- Current `ulykke`: NO structured_policy

**Impact**: Matcher mangler metadata (address, person, offerNumber)

---

### Issue #3: 2/3 Policy Types Har Tomme Comparisons ❌

**Problem**: Final comparison JSON i database har 0 coverage rows

```json
{
  "policyType": "hus",    "rows": 1  ✅
  "policyType": "indbo",  "rows": 0  ❌
  "policyType": "ulykke", "rows": 0  ❌
}
```

**User Impact**: UI viser tomme comparisons for indbo og ulykke

---

## 🛠️ Fix Strategier

### Option A: Quick Fix (5 min)

**Hvad**: Manuelt retype de 3 kritiske snapshots i database

```sql
-- Fix snapshot 4f1d13ae (current)
UPDATE offer_snapshots 
SET policy_type = 'ulykke' 
WHERE id = '4f1d13ae';

-- Fix snapshot 9ad74ada (offer)
UPDATE offer_snapshots 
SET policy_type = 'indbo' 
WHERE id = '9ad74ada';

-- Fix snapshot 2aefbdb7 (offer)
UPDATE offer_snapshots 
SET policy_type = 'indbo' 
WHERE id = '2aefbdb7';

-- Regenerer comparison
DELETE FROM company_comparisons 
WHERE user_id = 'e85ec3b9-e354-4c49-9f68-194830e356af'
  AND offer_company_id = 'abd44932-e5b2-4fda-a463-e75fd46c1ccc';

-- Upload document igen eller trigger comparison orchestrator
```

**Pros**: Hurtig løsning, kan testes med det samme  
**Cons**: Fixer ikke root cause, kun symptoms

---

### Option B: Regenerer Health Checks (15 min)

**Hvad**: Kør health check orchestrator igen for alle snapshots

```typescript
// In server code or API endpoint
const documentId = 'c93ed2b7-e397-46c3-a2da-32d3f8074166'; // Alm. Brand offer
await healthCheckOrchestrator.processDocument(documentId, {
  forceRegenerate: true
});
```

**Pros**: Får fresh data, kan opdage nye issues  
**Cons**: Bruger API credits, tager tid

---

### Option C: Fix Root Cause (1-2 timer)

**Hvad**: Find og fix bug i health check orchestrator

**Steps**:
1. Review `server/services/healthCheckOrchestrator.ts`
2. Find hvor `snapshot_id` assignes til health checks
3. Add validation:
   ```typescript
   // Before creating health check
   const extractedType = detectPolicyType(coverages);
   if (extractedType !== snapshot.policy_type) {
     logger.warn(`Type mismatch: snapshot=${snapshot.id}`);
     snapshot.policy_type = extractedType; // Use extracted as truth
   }
   ```
4. Regenerer alle health checks for user
5. Test med debug script igen

**Pros**: Forhindrer fremtidige issues, clean løsning  
**Cons**: Mest arbejde

---

## 📊 Verificering Efter Fix

### Test 1: Kør Debug Script Igen

```bash
npx tsx server/scripts/debugComparison.ts
```

**Forventet output**:
```
[HEALTH CHECK CONSISTENCY]
Total health checks: 23
Mismatches detected: 0  ✅ (before: 10)

[COMPARISON JSON]
policyType=hus    coverageRows=5  ✅
policyType=indbo  coverageRows=4  ✅ (before: 0)
policyType=ulykke coverageRows=3  ✅ (before: 0)
```

---

### Test 2: Check UI

```bash
# Login as hello@vyork.dk
# Navigate to comparison for Alm. Brand
# Verify all 3 policy types show coverage rows
```

---

### Test 3: Run SQL Query 6

```sql
-- Should show rows > 0 for all 3 policy types
SELECT ...
```

---

## 🎯 Snapshot IDs Reference

### Critical Current Snapshots (User's Policies)

| ID | Policy Type | Status | Notes |
|----|-------------|--------|-------|
| `4f1d13ae` | hus (WRONG: should be ulykke) | ⚠️ Mislabeled | Contains ulykke coverages |
| `2610557a` | indbo | ❌ Missing structured_policy | Need extraction |
| `20c6e2d4` | ulykke | ❌ Missing structured_policy | Need extraction |

---

### Critical Offer Snapshots (Alm. Brand)

| ID | Policy Type | Status | Notes |
|----|-------------|--------|-------|
| `9ad74ada` | ulykke (WRONG: should be indbo) | ⚠️ Mislabeled | Contains indbo coverages |
| `f28e4d53` | ulykke (WRONG: should be indbo) | ⚠️ Mislabeled | Contains indbo coverages |
| `2aefbdb7` | ulykke (WRONG: should be indbo) | ⚠️ Mislabeled | Contains indbo coverages |

---

## 📞 Support Data

### Environment

```
User ID: e85ec3b9-e354-4c49-9f68-194830e356af
Email: hello@vyork.dk
Test Company: Alm. Brand (abd44932-e5b2-4fda-a463-e75fd46c1ccc)
Comparison ID: df03ca4d-8203-4193-9b47-3a75b2d6327a
Document ID: c93ed2b7-e397-46c3-a2da-32d3f8074166
```

---

### Quick Commands

```bash
# Run debug script
npx tsx server/scripts/debugComparison.ts

# View full output
cat /tmp/debug_full_output.txt

# Check if workflow running
# (The application should be running on port 5000)

# Access database
# Use Replit DB tool or psql with DATABASE_URL
```

---

## 📈 Next Steps

1. ✅ **Immediate**: Review EXPERT-REPORT-DEBUG-COMPARISON.md (5 min)
2. ✅ **Verify**: Run SQL queries from QUICK-VERIFICATION-QUERIES.sql (2 min)
3. 🔧 **Decide**: Choose fix strategy (A, B, or C)
4. 🛠️ **Execute**: Apply chosen fix
5. ✅ **Test**: Re-run debug script to verify
6. 🎉 **Deploy**: User sees working comparisons

---

## 🏆 Success Criteria

After fix, you should see:

- ✅ **Debug script**: 0 health check mismatches
- ✅ **Database**: All 3 policy types have coverage rows > 0
- ✅ **UI**: User sees populated comparison tables for hus, indbo, ulykke
- ✅ **Logs**: No warnings about policy type mismatches

---

## 📚 Additional Resources

- **Architecture docs**: See `replit.md` for system overview
- **Forensic data**: Check `forensic-json-exports/` for earlier analysis
- **Source code**: Review services in `server/services/`
  - `healthCheckOrchestrator.ts`
  - `deterministicMatcher.ts`
  - `comparisonOrchestrator.ts`
  - `comparisonAgent.ts`
  - `coverageMatcher.ts`

---

**Pakke Status**: ✅ Complete og klar til review  
**Leveret af**: Replit Agent  
**Dato**: November 19, 2025

---

*Denne debug-pakke giver 100% visibility ind i comparison pipeline og præcise action items til at fixe de fundne issues.*
