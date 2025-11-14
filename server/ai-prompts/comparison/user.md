# USER – BedreTilbud PolicyComparisonAnalyst

## INPUT

Du får policies for to selskaber i dette format:

```json
{
  "context": {
    "currentCompany": "string",
    "offerCompany": "string",
    "currency": "DKK"
  },
  "policyPairs": [
    {
      "policyType": "hus" | "indbo" | "ulykke" | "bil" | "rejse" | "andet",
      "label": "Hus",
      "current": {
        "policyId": "string",
        "annualPremium": number,
        "healthCheck": { ... }
      },
      "offer": {
        "policyId": "string",
        "annualPremium": number,
        "healthCheck": { ... }
      }
    }
  ]
}
```

healthCheck-objekterne har bla.:

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
- totalCurrentAnnualPremium = sum af annualPremium for alle policyPairs.current.
- totalOfferAnnualPremium   = sum af annualPremium for alle policyPairs.offer.
- annualSavings = totalCurrentAnnualPremium - totalOfferAnnualPremium (kan være negativ).
- annualSavingsPercent = annualSavings / totalCurrentAnnualPremium * 100 (afrundet til 1 decimal).

### 2) Lav per-policy costSummary
- For hver policyPair:
  - currentAnnualPremium = current.annualPremium
  - offerAnnualPremium = offer.annualPremium
  - annualSavings = currentAnnualPremium - offerAnnualPremium
  - annualSavingsPercent = annualSavings / currentAnnualPremium * 100

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

For et policyPair:

- currentList = current.healthCheck.whatsIncluded
- offerList   = offer.healthCheck.whatsIncluded

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

- Start med offer.healthCheck.missingInformation (tilbuddet er det, kunden skal udfordre).
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

{{policyPairsJSON}}
