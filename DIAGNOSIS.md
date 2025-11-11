# Health Check Data Loss - Root Cause Analysis

## Summary
**The detailed coverage data IS being extracted correctly, but the health check prompt is only selecting 3 items instead of all 12 coverages.**

## Data Flow Analysis

### Stage 1: Extraction (OfferSnapshot.coverageDetails) ✅ GOOD
**Status:** All detailed data is present and correct

HUS Policy has 12 main coverages with detailed selvrisiko:
```
Brand: Limit=62.344 kr, Deductible=2.834 kr
Kasko: Limit=62.344 kr, Deductible=2.834 kr  
Skybrud: Deductible=5.000 kr
Hus og grundejeransvar: Deductible=0 kr
Retshjælp: Deductible=10% (min. 2.500 kr)
Glas og sanitet: Deductible=0 kr
Insekt: Deductible=2.834 kr
Svamp: Deductible=2.834 kr
Råd: Deductible=2.834 kr
Skjulte rør og kabler: Deductible=2.834 kr
Stikledning: Deductible=2.834 kr
Indbo: Deductible=1.417 kr
```

### Stage 2: Health Check Analysis (whatsIncluded array) ❌ PROBLEM
**Status:** Only 3 items out of 12 coverages appear in whatsIncluded

Health check payload shows only:
```json
"whatsIncluded": [
  {
    "coverage": "Brand",
    "description": "Dækning mod brandskader",
    "value": "inkluderet",
    "status": "success",
    "attributes": {"sum": "62.344 kr", "selvrisiko": "2.834 kr", ...}
  },
  {
    "coverage": "Skybrud",
    "description": "Dækning mod skader fra skybrud",
    "value": "inkluderet",
    "status": "warning",
    "attributes": {"sum": null, "selvrisiko": "5.000 kr", ...}
  },
  {
    "coverage": "Hus og grundejeransvar",
    "description": "Ansvarsdækning som husejer",
    "value": "inkluderet",
    "status": "success",
    "attributes": {"sum": null, "selvrisiko": "0 kr", ...}
  }
]
```

**Missing 9 coverages:** Kasko, Retshjælp, Glas og sanitet, Insekt, Svamp, Råd, Skjulte rør og kabler, Stikledning, Indbo

## Manual Test Comparison

The manual test shows ALL coverages with detailed attributes:
```
| Dækning                 | Status     | Note / sum                                 |
| ----------------------- | ---------- | ------------------------------------------ |
| Brand                   | Inkluderet | Selvrisiko 2.834 kr.                       |
| Kasko                   | Inkluderet | Selvrisiko 2.834 kr. (skybrud 5.000 kr.)   |
| Hus- og grundejeransvar | Inkluderet | 10.000.000 kr. person / 2.000.000 kr. ting |
| Retshjælp               | Inkluderet | 225.000 kr.                                |
| Glas og sanitet         | Inkluderet | 0 kr. selvrisiko                           |
| Insekt / svamp / råd    | Inkluderet | Selvrisiko 2.834 kr.                       |
| Skjulte rør og kabler   | Inkluderet | Selvrisiko 2.834 kr.                       |
| Stikledning             | Inkluderet | Selvrisiko 2.834 kr.                       |
| Indbo (fritidshus)      | Inkluderet | Selvrisiko 1.417 kr.                       |
```

Plus special sums like:
- Bygning/kasko-niveau: 410.901 kr.
- Solceller: 184.197 kr.
- Udsmykning: 410.901 kr.

## Root Cause

The health check prompt (`server/ai-prompts/health-check/analysis.md`) tells the AI to do "dynamic coverage discovery" but the AI model is being too selective and only picking 3 "representative" items instead of ALL items.

The prompt says:
> "Udfør dynamisk dækning­sopdagelse (ingen prædefineret liste). Lav en samlet liste over features..."

But it doesn't explicitly tell the AI to **include EVERY coverage from coverageDetails.mainCoverages array**.

## Solution

Update the health check prompt to:
1. **Explicitly instruct:** "Include ALL items from coverageDetails.mainCoverages[] in whatsIncluded array"
2. **Map directly:** For each coverage in mainCoverages, create one whatsIncluded entry
3. **Preserve attributes:** Copy limit → sum, deductible → selvrisiko directly
4. **Add special sums:** Extract and display special limit values (building coverage, collections, etc.)

## Expected Outcome

After fix, whatsIncluded should contain all 12 items for HUS:
- All coverages from mainCoverages[] (12 items for HUS, 9 items for INDBO, 3 for ULYKKE)
- Each with proper selvrisiko attribute (formatted with thousands separator)
- Special sums displayed prominently
- Same level of detail as manual test
