# BedreTilbud – Comparison Debug Report

**Comparison ID:** aad677e7-fff7-4484-a614-2f614c51ac06  
**User:** hello@vyork.dk (e85ec3b9-e354-4c49-9f68-194830e356af)  
**Current company:** Privatsikring  
**Offer company:** Gjensidige  
**Created at:** 2025-11-23T09:33:41.573Z  
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
| offer | 30374ae9 | offer | Offer Insurance.pdf | Gjensidige | 2025-11-23 |
| offer | 706eb27a | offer | Offer Insurance.pdf | Gjensidige | 2025-11-21 |

## Phase 1 – Snapshots

| Snapshot ID | Doc type | Company        | policy_type | structured_policy | mainCoverages | addCoverages |
|-------------|----------|----------------|------------|-------------------|---------------|-------------|
| 2610557a | current | Privatsikring | indbo | ✅ | 9 | 7 |
| 4f1d13ae | current | Privatsikring | hus | ✅ | 12 | 4 |
| fff8dfe4 | current | Privatsikring | hus | ✅ | 5 | 1 |
| 11c6bb6a | current | Privatsikring | indbo | ✅ | 5 | 2 |
| f01e513a | current | Privatsikring | ulykke | ✅ | 3 | 2 |
| 20c6e2d4 | current | Privatsikring | ulykke | ✅ | 3 | 1 |
| 2bd4c22a | offer | Gjensidige | hus | ✅ | 4 | 4 |
| 2cdba345 | offer | Gjensidige | ulykke | ✅ | 4 | 8 |
| d6aef97a | offer | Gjensidige | indbo | ✅ | 4 | 2 |
| 6908c4ed | offer | Gjensidige | indbo | ✅ | 5 | 0 |
| 7845b4ee | offer | Gjensidige | hus | ✅ | 8 | 1 |
| cb1bebcd | offer | Gjensidige | ulykke | ✅ | 3 | 1 |

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
| 2bd4c22a | offer | Gjensidige | hus | hus | 8 | Bygningsbrand, el-skade, Bygningsbeskadigelse, ansvar | ✅ OK |
| 2cdba345 | offer | Gjensidige | ulykke | ulykke | 12 | Heltid, Varigt mén fra 5% | ✅ OK |
| d6aef97a | offer | Gjensidige | indbo | indbo | 6 | Indbo BASIS, Cykel inkl. tilbehør | ✅ OK |
| 6908c4ed | offer | Gjensidige | indbo | indbo | 5 | Indbo BASIS, Cykel inkl. tilbehør | ✅ OK |
| 7845b4ee | offer | Gjensidige | hus | hus | 9 | Bygningsbrand og el-skade, Bygningsbeskadigelse og ansvar | ✅ OK |
| cb1bebcd | offer | Gjensidige | ulykke | ulykke | 4 | Invaliditet ved varigt mén, Dødsfald | ✅ OK |

**Health Check Diagnosis**

- All health checks are consistent with policy types.


## Phase 3 – Matcher

Matched pairs:

- indbo:    current=2610557a ↔ offer=d6aef97a (matched)
- hus:    current=4f1d13ae ↔ offer=2bd4c22a (matched)
- ulykke:    current=f01e513a ↔ offer=2cdba345 (matched)

Unmatched snapshots: none

**Matcher verdict:** ✅ All 3 policy types matched.

## Phase 4 – Comparison Result (JSON Summary)

**Overall**

- totalCurrentAnnualPremium: 0 kr
- totalOfferAnnualPremium: 0 kr
- annualSavings: 0 kr (0%)
- cumulativeSavings.chartData length: 0 ❌

**Per-policy**

| policyType | label  | currentAnnual | offerAnnual | annualSavings | coverage rows | highlights | missingInfo | recommendations |
|-----------|--------|--------------|------------|--------------|--------------|-----------|-------------|-----------------|
| hus | Hus | 8734.59 kr | null | 0 kr | 19 | 4 | 2 | 3 |

**No red flags**

## Phase 5 – Auto-Detected Anomalies & Suggested Fixes

### Anomalies

4. **Pricing Extraction Issues**

**Pricing Warnings:**
- ⚠️ Missing offerAnnualPremium for hus – price could not be extracted from PDF

### Suggested Next Steps (for Replit dev)

- Check Phase 1 extraction prompt and OCR quality for policies with missing premiums.