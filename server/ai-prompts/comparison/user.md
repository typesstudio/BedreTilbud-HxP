# USER – BedreTilbud PolicyComparisonAnalyst

## ⚠️ CRITICAL CONSTRAINTS

**Du SKAL bruge nøjagtigt de policy-typer, du modtager som input.**  
**Du må IKKE tilføje eller fjerne policies.**  
**Kun tilladte policy-typer: {{allowedPolicyTypes}}**

Hvis der ikke er en "bil"-policy i inputtet, må du ikke nævne bil.  
Hvis der kun er "hus", "indbo", "ulykke", må output kun indeholde disse tre.

## INPUT

Du modtager PRÆ-MATCHEDE policy-sammenligninger i dette format:

```json
{
  "context": {
    "currentCompany": "string",
    "offerCompany": "string",
    "currency": "DKK"
  },
  "policyComparisons": [
    {
      "policyType": "hus" | "indbo" | "ulykke", // KUN de typer, der findes i inputtet
      "label": "Hus",
      "currentCompany": "string",
      "offerCompany": "string",
      "costSummary": {
        "currentAnnualPremium": number,      // ✅ Allerede beregnet
        "offerAnnualPremium": number,        // ✅ Allerede beregnet
        "annualSavings": number,             // ✅ Allerede beregnet
        "annualSavingsPercent": number       // ✅ Allerede beregnet
      },
      "highlights": [],                       // ❌ TOM - du skal udfylde
      "coverageComparison": { "rows": [] },   // ❌ TOM - du skal udfylde
      "missingInformation": [],               // ❌ TOM - du skal udfylde
      "recommendations": [],                  // ❌ TOM - du skal udfylde
      "_healthCheckData": {                   // ✅ Data til analyse
        "current": { ... },
        "offer": { ... }
      }
    }
  ]
}
```

**Dit job:**  
Du skal BEVARE nøjagtigt de policies, du modtager, og kun UDFYLDE de tomme felter:
- `highlights` (højdepunkter for denne policy)
- `coverageComparison.rows` (detaljeret dækningssammenligning)
- `missingInformation` (spørgsmål til tilbuddet)
- `recommendations` (anbefalinger til kunden)

Du må IKKE ændre `policyType`, `label`, `currentCompany`, `offerCompany`, eller `costSummary`.

### _healthCheckData struktur

`_healthCheckData.current` og `_healthCheckData.offer` indeholder:

- whatsIncluded: liste over dækninger  
  ```json
  [{
    "coverage": "Brand",
    "description": "Dækning mod brandskader",
    "value": "inkluderet" | "ikke inkluderet" | "ukendt",
    "status": "success" | "neutral" | "warning" | "error",
    "attributes": {
      "sum": "string | null",
      "selvrisiko": "string | null",
      "loft": "string | null",
      "sla": "string | null",
      "noter": "string | null"
    }
  }]
  ```

- missingInformation: relevante spørgsmål kunden bør stille
- strengths / weaknesses: styrker og svagheder ved policen
- potentialSavings: estimeret besparelse i kr

## OPGAVE

### 1) Beregn årlige totalpriser og besparelse (Samlet)
- totalCurrentAnnualPremium = sum af costSummary.currentAnnualPremium for alle policyComparisons.
- totalOfferAnnualPremium   = sum af costSummary.offerAnnualPremium for alle policyComparisons.
- annualSavings = totalCurrentAnnualPremium - totalOfferAnnualPremium (kan være negativ).
- annualSavingsPercent = annualSavings / totalCurrentAnnualPremium * 100 (afrundet til 1 decimal).

### 2) Per-policy costSummary (✅ ALLEREDE BEREGNET)
- Brug costSummary direkte fra inputtet. Du skal IKKE genberegne dette.

### 3) Byg globale highlights (overall.globalHighlights)
- Vælg 3–6 stærke forskelle til Samlet-sektionen.
- Brug især:
  - store præmieforskelle
  - tydelige dækninger, som kun findes hos tilbuddet
  - forbedret selvrisiko
- Format:

```json
{
  "title": "kort titel",
  "description": "kort forklaring",
  "icon": "trending-up" | "shield" | "zap" | "car" | "droplet" | "info",
  "variant": "success" | "warning",
  "category": "coverage" | "price" | "deductible" | "feature"
}
```

### 4) Byg coverageComparison pr. policetype (policyComparisons[].coverageComparison.rows)

**ALGORITME FOR MATCH AF DÆKNINGER**

For hver policyComparison:

- currentList = _healthCheckData.current.whatsIncluded
- offerList   = _healthCheckData.offer.whatsIncluded

1. Normalisér dækningsnavne:
   - til lowercase
   - fjern specialtegn, punktum, komma, parenteser
   - trim whitespace
2. Lav et sæt af alle unikke normaliserede navne på tværs af current og offer.
3. For hver normaliserede nøgle:
   - find bedste match i currentList (samme normaliserede navn, eller tætteste substring)
   - find bedste match i offerList på samme måde
4. Konstruer en række:

```json
{
  "coverage": "visningslabel (fra current eller offer)",
  "description": "kort dansk beskrivelse (hvis tom → lav en kort generisk)",
  "current": {
    "value": "inkluderet/ikke inkluderet/ukendt (fra current, ellers 'ikke inkluderet')",
    "limit": "current.attributes.sum eller null",
    "selvrisiko": "current.attributes.selvrisiko eller null",
    "status": "current.status eller 'neutral'"
  },
  "offer": {
    "value": "... tilsvarende for offer ...",
    "limit": "...",
    "selvrisiko": "...",
    "status": "..."
  },
  "note": "kort kommentar hvis forskel er vigtig, fx 'Tilbuddet har 500.000 kr højere sum' ellers null"
}
```

Hvis en dækning kun findes hos current → offer.value = "ikke inkluderet" og status = "error".
Hvis den kun findes hos offer   → current.value = "ikke inkluderet" og status = "warning".

Rækkefølge:
- Hoveddækninger først (Brand, Kasko, Ansvar, Indbo osv.).
- Herefter tilvalg/ekstra dækninger.

### 5) Højdepunkter pr. policetype (policyComparisons[].highlights)

- Udvælg 3–6 vigtigste forskelle for netop denne policetype:
  - størst besparelse
  - tydelige nye dækninger hos tilbuddet
  - væsentligt lavere eller højere selvrisiko
- Brug samme format som globalHighlights.

### 6) missingInformation pr. policetype

- Start med _healthCheckData.offer.missingInformation (tilbuddet er det, kunden skal udfordre).
- Filtrér/omskriv til 3–7 vigtigste spørgsmål.
- Format:

```json
{
  "severity": "critical" | "important" | "question",
  "question": "konkret spørgsmål på dansk",
  "explanation": "hvorfor dette er vigtigt"
}
```

### 7) recommendations pr. policetype

- 3–5 konkrete, handlingsorienterede anbefalinger.
- Brug faktiske tal og forskelle hvor muligt.
- Fx:
  - "Forhandl selvrisiko på skybrud ned fra 5.000 kr til 3.000 kr."
  - "Overvej tilvalg af glas og sanitet for at matche nuværende dækning."

### 8) kumulativ besparelse (Samlet)

- Brug annualSavings (på Samlet-niveau).
- Hvis annualSavings ≤ 0:
  - håndtér det som negativ besparelse (vises stadig i data).
- otherwise:
  - monthlyAverage = annualSavings / 12
  - monthlyRange.min = round(monthlyAverage * 0.9)
  - monthlyRange.max = round(monthlyAverage * 1.1)
  - after12Months = round(monthlyAverage * 12)
  - after10Years  = round(monthlyAverage * 120)
  - totalOver10Years = after10Years

- chartData:
  - 120 punkter:
    - "Måned 1" → round(monthlyAverage * 1)
    - ...
    - "Måned 120" → round(monthlyAverage * 120)

## SLUTLIGT OUTPUT

Returnér et JSON-objekt med præcis denne struktur:

```json
{
  "overall": {
    "totalCurrentAnnualPremium": number,
    "totalOfferAnnualPremium": number,
    "annualSavings": number,
    "annualSavingsPercent": number,
    "explanation": "string",
    "perPolicySummary": [
      {
        "policyType": "string",
        "label": "string",
        "currentAnnualPremium": number,
        "offerAnnualPremium": number,
        "annualSavings": number,
        "annualSavingsPercent": number
      }
    ],
    "globalHighlights": [ /* se format ovenfor */ ]
  },
  "policyComparisons": [
    {
      "policyType": "string",
      "label": "string",
      "currentCompany": "string",
      "offerCompany": "string",
      "costSummary": {
        "currentAnnualPremium": number,
        "offerAnnualPremium": number,
        "annualSavings": number,
        "annualSavingsPercent": number
      },
      "highlights": [ /* pr policetype */ ],
      "coverageComparison": {
        "rows": [ /* dækning-rækker som angivet ovenfor */ ]
      },
      "missingInformation": [ /* se format ovenfor */ ],
      "recommendations": [ "string", "string" ]
    }
  ],
  "cumulativeSavings": {
    "totalOver10Years": number,
    "monthlyRange": { "min": number, "max": number },
    "after12Months": number,
    "after10Years": number,
    "chartData": [
      { "month": "Måned 1", "savings": number },
      { "month": "Måned 2", "savings": number }
      /* ... Måned 120 ... */
    ]
  },
  "meta": {
    "currentCompany": "string",
    "offerCompany": "string"
  }
}
```

**Returnér KUN dette JSON-objekt – ingen ekstra tekst.**

---

## ACTUAL DATA

**HUSK: Du må KUN bruge policy-typer fra denne liste: {{allowedPolicyTypes}}**

{{policyComparisonsJSON}}
