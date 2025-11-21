# BedreTilbud – Comparison Debug Report

**Comparison ID:** 94bd1995-14ae-4efe-96dd-e47b7f404694  
**User:** hello@vyork.dk (e85ec3b9-e354-4c49-9f68-194830e356af)  
**Current company:** Privatsikring  
**Offer company:** Alka Forsikring  
**Created at:** 2025-11-21T07:30:51.982Z  
**Pipeline version:** v2.1.0  
**Status:** ✅ completed

## Executive Summary

- Matcher: 3/6 policies matched
- Health checks: ✅ All consistent
- Comparison JSON: ✅ All policies have coverage data
- Main suspected cause: No major issues detected

## Phase 0 – Documents

| Role    | Document ID | Type    | File name           | Company        | Created at   |
|---------|-------------|---------|---------------------|----------------|-------------|
| current | f66209ca | current | User Insurance.pdf | N/A | 2025-10-09 |
| offer | 218722b7 | offer | Offer Insurance.pdf | Alka Forsikring | 2025-11-21 |
| current | 0d67a638 | current | Offer Insurance.pdf | N/A | 2025-11-06 |
| current | 62fa8548 | current | User Insurance.pdf | N/A | 2025-11-10 |
| current | c008290f | current | User Insurance.pdf | N/A | 2025-11-11 |

## Phase 1 – Snapshots

| Snapshot ID | Doc type | Company        | policy_type | structured_policy | mainCoverages | addCoverages |
|-------------|----------|----------------|------------|-------------------|---------------|-------------|
| 2610557a | current | Privatsikring | indbo | ✅ | 9 | 7 |
| 4f1d13ae | current | Privatsikring | hus | ✅ | 12 | 4 |
| fff8dfe4 | current | Privatsikring | hus | ✅ | 5 | 1 |
| 11c6bb6a | current | Privatsikring | indbo | ✅ | 5 | 2 |
| f01e513a | current | Privatsikring | ulykke | ✅ | 3 | 2 |
| 20c6e2d4 | current | Privatsikring | ulykke | ✅ | 3 | 1 |
| e39251df | offer | Alka Forsikring | hus | ✅ | 8 | 0 |
| d89bff46 | offer | Alka Forsikring | ulykke | ✅ | 10 | 1 |
| 3dc2bc02 | offer | Alka Forsikring | indbo | ✅ | 7 | 0 |

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
| e39251df | offer | Alka Forsikring | hus | hus | 8 | Bygningsbrand og el-skade, Bygningsbeskadigelse og ansvar | ✅ OK |
| d89bff46 | offer | Alka Forsikring | ulykke | ulykke | 11 | Heltid, Erstatning for varigt mén | ✅ OK |
| 3dc2bc02 | offer | Alka Forsikring | indbo | indbo | 7 | Indbo BASIS, Cykel inkl. tilbehør | ✅ OK |

**Health Check Diagnosis**

- All health checks are consistent with policy types.


## Phase 3 – Matcher

Matched pairs:

- indbo:    current=2610557a ↔ offer=3dc2bc02 (matched)
- hus:    current=4f1d13ae ↔ offer=e39251df (matched)
- ulykke:    current=f01e513a ↔ offer=d89bff46 (matched)

Unmatched snapshots: none

**Matcher verdict:** ✅ All 3 policy types matched.

## Phase 4 – Comparison Result (JSON Summary)

**Overall**

- totalCurrentAnnualPremium: 11872.7 kr
- totalOfferAnnualPremium: 995.1 kr
- annualSavings: 10877.6 kr (91.6%)
- cumulativeSavings.chartData length: 120 ✅

**Per-policy**

| policyType | label  | currentAnnual | offerAnnual | annualSavings | coverage rows | highlights | missingInfo | recommendations |
|-----------|--------|--------------|------------|--------------|--------------|-----------|-------------|-----------------|
| hus | Hus | 8734.59 kr | 0 kr | 8734.59 kr | 20 | 4 | 2 | 4 |
| indbo | Indbo | 2078.53 kr | 0 kr | 2078.53 kr | 20 | 4 | 1 | 4 |
| ulykke | Ulykke | 1059.58 kr | 995.1 kr | 64.4799999999999 kr | 13 | 4 | 1 | 4 |

**No red flags**

## Phase 5 – Auto-Detected Anomalies & Suggested Fixes

### Anomalies

No anomalies detected! ✅

### Suggested Next Steps (for Replit dev)

- No action needed. System is healthy!