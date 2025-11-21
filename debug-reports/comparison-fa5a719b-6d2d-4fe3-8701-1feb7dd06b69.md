# BedreTilbud – Comparison Debug Report

**Comparison ID:** fa5a719b-6d2d-4fe3-8701-1feb7dd06b69  
**User:** hello@vyork.dk (e85ec3b9-e354-4c49-9f68-194830e356af)  
**Current company:** Privatsikring  
**Offer company:** Tryg  
**Created at:** 2025-11-21T07:30:54.214Z  
**Pipeline version:** v2.1.0  
**Status:** ✅ completed

## Executive Summary

- Matcher: 6/6 policies matched
- Health checks: ✅ All consistent
- Comparison JSON: ✅ All policies have coverage data
- Main suspected cause: No major issues detected

## Phase 0 – Documents

| Role    | Document ID | Type    | File name           | Company        | Created at   |
|---------|-------------|---------|---------------------|----------------|-------------|
| current | f66209ca | current | User Insurance.pdf | N/A | 2025-10-09 |
| current | 0d67a638 | current | Offer Insurance.pdf | N/A | 2025-11-06 |
| current | 62fa8548 | current | User Insurance.pdf | N/A | 2025-11-10 |
| current | c008290f | current | User Insurance.pdf | N/A | 2025-11-11 |
| offer | 44701da4 | offer | Offer Insurance.pdf | Tryg | 2025-11-18 |
| offer | 78d293c6 | offer | Offer Insurance.pdf | Tryg | 2025-11-18 |

## Phase 1 – Snapshots

| Snapshot ID | Doc type | Company        | policy_type | structured_policy | mainCoverages | addCoverages |
|-------------|----------|----------------|------------|-------------------|---------------|-------------|
| 2610557a | current | Privatsikring | indbo | ✅ | 9 | 7 |
| 4f1d13ae | current | Privatsikring | hus | ✅ | 12 | 4 |
| fff8dfe4 | current | Privatsikring | hus | ✅ | 5 | 1 |
| 11c6bb6a | current | Privatsikring | indbo | ✅ | 5 | 2 |
| f01e513a | current | Privatsikring | ulykke | ✅ | 3 | 2 |
| 20c6e2d4 | current | Privatsikring | ulykke | ✅ | 3 | 1 |
| 9ad74ada | offer | Tryg | hus | ✅ | 5 | 5 |
| f3f376af | offer | Tryg | indbo | ✅ | 6 | 0 |
| cd3b5861 | offer | Tryg | hus | ✅ | 4 | 2 |
| 37c2ce39 | offer | Tryg | ulykke | ✅ | 4 | 4 |
| 78c85b4c | offer | Tryg | indbo | ✅ | 4 | 2 |
| 4277f7ad | offer | Tryg | ulykke | ✅ | 3 | 4 |

**No warnings**

## Phase 2 – Health Checks

| Snapshot ID | Doc type | Company       | snapshot.policy_type | health_check.policy_type | whatsIncluded count | First coverage                    | Status     |
|-------------|----------|--------------|-----------------------|--------------------------|---------------------|-----------------------------------|------------|
| 2610557a | current | Privatsikring | indbo | indbo | 16 | Ansvar, Skader af børn under 5 år | ✅ OK |
| 4f1d13ae | current | Privatsikring | hus | hus | 16 | Brand, Kasko | ✅ OK |
| fff8dfe4 | current | Privatsikring | hus | N/A | 0 | N/A | ❌ NO HC |
| 11c6bb6a | current | Privatsikring | indbo | N/A | 0 | N/A | ❌ NO HC |
| f01e513a | current | Privatsikring | ulykke | N/A | 0 | N/A | ❌ NO HC |
| 20c6e2d4 | current | Privatsikring | ulykke | ulykke | 4 | Invaliditet ved ulykker, Krisehjælp | ✅ OK |
| 9ad74ada | offer | Tryg | hus | N/A | 0 | N/A | ❌ NO HC |
| f3f376af | offer | Tryg | indbo | N/A | 0 | N/A | ❌ NO HC |
| cd3b5861 | offer | Tryg | hus | N/A | 0 | N/A | ❌ NO HC |
| 37c2ce39 | offer | Tryg | ulykke | N/A | 0 | N/A | ❌ NO HC |
| 78c85b4c | offer | Tryg | indbo | N/A | 0 | N/A | ❌ NO HC |
| 4277f7ad | offer | Tryg | ulykke | N/A | 0 | N/A | ❌ NO HC |

**Health Check Diagnosis**

- All health checks are consistent with policy types.


## Phase 3 – Matcher

Matched pairs:

- indbo:    current=2610557a ↔ offer=f3f376af (matched)
- hus:    current=4f1d13ae ↔ offer=9ad74ada (matched)
- ulykke:    current=f01e513a ↔ offer=37c2ce39 (matched)

Unmatched snapshots: none

**Matcher verdict:** ✅ All 3 policy types matched.

## Phase 4 – Comparison Result (JSON Summary)

**Overall**

- totalCurrentAnnualPremium: 8734.59 kr
- totalOfferAnnualPremium: 0 kr
- annualSavings: 8734.59 kr (100%)
- cumulativeSavings.chartData length: 120 ✅

**Per-policy**

| policyType | label  | currentAnnual | offerAnnual | annualSavings | coverage rows | highlights | missingInfo | recommendations |
|-----------|--------|--------------|------------|--------------|--------------|-----------|-------------|-----------------|
| hus | Hus | 8734.59 kr | 0 kr | 8734.59 kr | 16 | 4 | 2 | 3 |

**No red flags**

## Phase 5 – Auto-Detected Anomalies & Suggested Fixes

### Anomalies

No anomalies detected! ✅

### Suggested Next Steps (for Replit dev)

- No action needed. System is healthy!